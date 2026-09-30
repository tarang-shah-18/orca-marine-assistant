/**
 * Collaborative orchestration runtime.
 *
 * This is the loop that makes ORCA a *multi-agent* system rather than a chain
 * of function calls:
 *
 *   parse → detect language → plan (task graph) → execute roster in
 *   dependency order → follow-up round for any agent that requested
 *   collaboration → synthesize → safety-critique → memory update
 *
 * Every stage emits a typed event, which is what `/api/chat/stream` forwards to
 * the browser as SSE. The same function drives both the streaming and the
 * non-streaming endpoint, so the two can never disagree.
 */

import {
  AgentResult,
  AgentType,
  ConversationMemory,
  LanguageCode,
  OrchestrationResult,
  RiskLevel,
  TimeHorizon,
} from '../types';
import { AgentContext, AgentDefinition, Artifacts, runAgent } from './base';
import { gisAgent } from './gisAgent';
import { pfzAgent } from './pfzAgent';
import { weatherAgent } from './weatherAgent';
import { oceanAgent } from './oceanAgent';
import { tideAgent } from './tideAgent';
import { alertAgent } from './alertAgent';
import { geofencingAgent } from './geofencingAgent';
import { routeAgent } from './routeAgent';
import { riskAgent } from './riskAgent';
import { historicalAgent } from './historicalAgent';
import { visualizationAgent } from './visualizationAgent';
import { criticAgent, critiqueAnswer } from './critic';
import { buildPlan } from './planner';
import { parseQuery } from '../core/intent';
import { HARBORS, HARBOR_BY_ID, VESSEL_BY_ID, DEFAULT_VESSEL_ID } from '../core/dataset';
import { refreshLive } from '../core/live';
import { getPhrasebook } from '../core/i18n';
import type { LatLon } from '../core/geo';
import { collectEvidence, collectSources, synthesizeOffline } from './synthesizer';

/* ------------------------------------------------------------------ *
 * Roster
 * ------------------------------------------------------------------ */

export const AGENT_REGISTRY_IMPL: Record<AgentType, AgentDefinition> = {
  // The planner is not a runtime agent: `orchestrate()` builds the task graph
  // itself, so this entry exists only to keep `AgentType` total and to give the
  // registry a definition for the type. It must never produce a finding, because
  // `collectRequested` deletes it before any follow-up round.
  PLANNER_AGENT: {
    type: 'PLANNER_AGENT',
    run: (context) => ({
      status: 'OK',
      findings: [],
      summary: context.book.ui.plannerRuntimeWord,
      requestedAgents: [],
      dataSources: [],
    }),
  },
  GIS_AGENT: gisAgent,
  PFZ_AGENT: pfzAgent,
  WEATHER_AGENT: weatherAgent,
  OCEAN_AGENT: oceanAgent,
  TIDE_AGENT: tideAgent,
  MARINE_ALERT_AGENT: alertAgent,
  GEOFENCING_AGENT: geofencingAgent,
  ROUTE_OPTIMIZATION_AGENT: routeAgent,
  RISK_VALIDATION_AGENT: riskAgent,
  HISTORICAL_ANALYSIS_AGENT: historicalAgent,
  VISUALIZATION_AGENT: visualizationAgent,
  CRITIC_AGENT: criticAgent,
};

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export type OrchestratorEvent =
  | { type: 'language'; language: LanguageCode; confidence: number; script: string }
  | { type: 'plan'; plan: OrchestrationResult['plan'] }
  | { type: 'step-start'; stepId: string; goal: string; agent: AgentType }
  | {
      type: 'step-done';
      stepId: string;
      agent: AgentType;
      status: AgentResult['status'];
      summary: string;
      durationMs: number;
      findingCount: number;
    }
  | { type: 'agent-finding'; agent: AgentType; statement: string; confidence: number; riskLevel?: RiskLevel }
  | { type: 'collaboration'; from: AgentType; to: AgentType[] }
  | { type: 'round'; round: number; agents: AgentType[] }
  | { type: 'risk'; level: RiskLevel; safetyScore: number }
  | { type: 'synthesis'; text: string; aiGenerated: boolean }
  | { type: 'critique'; corrections: string[]; escalated: boolean }
  | { type: 'done'; result: OrchestrationResult }
  | { type: 'error'; message: string };

export type Emit = (event: OrchestratorEvent) => void;

export interface OrchestratorOptions {
  preferredLanguage?: LanguageCode;
  memory?: ConversationMemory;
  onEvent?: Emit;
  /** Optional Gemini bridge; the runtime never requires it. */
  gemini?: GeminiBridge;
  /**
   * Anchor harbour override. A phone that knows its own harbour is a better
   * source of truth than the phrasebook default, and it is what makes a shared
   * handset useful to two fishers from different ports.
   */
  harborId?: string;
  /**
   * Explicit reference position (a GPS fix or a planned track point). When
   * present, every spatial agent reasons about *this* point rather than the
   * harbour — the difference between "is it safe at the dock" and "is it safe
   * at the fishing ground".
   */
  position?: LatLon;
  /** Optional fixed clock, used by tests to keep the run deterministic. */
  now?: () => Date;
}

/** The narrow surface `server/gemini.ts` must satisfy. */
export interface GeminiBridge {
  available(): boolean;
  refinePlan(input: {
    utterance: string;
    language: LanguageCode;
    plan: OrchestrationResult['plan'];
  }): Promise<{ roster?: AgentType[]; reasoning?: string; horizon?: TimeHorizon } | null>;
  synthesize(input: {
    utterance: string;
    language: LanguageCode;
    offlineDraft: string;
    riskLevel: RiskLevel;
    evidence: OrchestrationResult['evidence'];
    agentSummaries: Array<{ agent: AgentType; summary: string }>;
  }): Promise<string | null>;
}

export const EMPTY_MEMORY: ConversationMemory = {
  lastHorizon: 'TODAY',
  lastVesselType: DEFAULT_VESSEL_ID,
  mentionedLocations: [],
  turnCount: 0,
};

export function freshMemory(seed?: Partial<ConversationMemory>): ConversationMemory {
  return { ...EMPTY_MEMORY, ...seed, mentionedLocations: [...(seed?.mentionedLocations ?? [])] };
}

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

/**
 * Run a full multi-agent turn.
 *
 * @returns the orchestration result plus the updated conversation memory, so
 *          the caller can persist both without a second round trip.
 */
export async function orchestrate(
  utterance: string,
  options: OrchestratorOptions = {},
): Promise<{ result: OrchestrationResult; memory: ConversationMemory }> {
  const emit: Emit = options.onEvent ?? (() => {});
  const memory = options.memory ?? freshMemory();
  const preferred = options.preferredLanguage ?? 'en-IN';

  try {
    /* --- 1. Understand ---------------------------------------------- */
    const parsed = parseQuery(utterance, preferred, memory);
    emit({
      type: 'language',
      language: parsed.language,
      confidence: parsed.languageDetection.confidence,
      script: parsed.languageDetection.script,
    });

    /* --- 2. Plan ---------------------------------------------------- */
    let override: { roster?: AgentType[]; reasoning?: string; horizon?: TimeHorizon } | undefined;
    if (options.gemini?.available()) {
      try {
        const probe = buildPlan(parsed, memory, undefined, { anchorHarborId: options.harborId });
        override = (await options.gemini.refinePlan({
          utterance,
          language: parsed.language,
          plan: probe.plan,
        })) ?? undefined;
      } catch {
        // A planner failure is never fatal: the deterministic plan stands.
        override = undefined;
      }
    }

    const outcome = buildPlan(parsed, memory, override, { anchorHarborId: options.harborId });
    const { plan } = outcome;

    // A caller-supplied anchor wins over the inferred one: a phone with a GPS
    // fix, or a shared handset set to a different harbour, is ground truth.
    const harbor = options.harborId
      ? HARBOR_BY_ID[options.harborId] ?? outcome.harbor
      : outcome.harbor;
    // The reference position must follow the same anchor. The planner may have
    // resolved a *different* harbour out of the utterance or the default (the
    // capital harbour), so when the caller named a harbour explicitly — but did
    // not supply a GPS fix or track point — reason about that harbour, not the
    // planner's guess. Otherwise the label says "Goa" while every spatial agent
    // still thinks in miles from Mumbai.
    const position =
      options.position ??
      (options.harborId
        ? { latitude: harbor.latitude, longitude: harbor.longitude }
        : outcome.position);

    // Same rule for the label side: the headline names the harbour the user
    // picked ("at Goa."), never the generic "at Zone." placeholder the planner
    // falls back to when the utterance does not spell out a gazetteer name.
    if (options.harborId) parsed.harborName = harbor.shortName;

    // Warm the real-time snapshot for this harbour before any agent runs, so
    // every finding is computed from the live feed. Never throws: a source that
    // cannot be reached degrades to the reference snapshot, flagged per product.
    await refreshLive(harbor.id, position);

    const { book, vesselId } = outcome;

    emit({ type: 'plan', plan });

    const artifacts: Artifacts = {};

    const context: AgentContext = {
      parsed,
      language: parsed.language,
      book,
      horizon: plan.horizon,
      harbor,
      position,
      anchor: {
        harborId: harbor.id,
        label: harbor.shortName,
        basis: options.harborId
          ? 'explicit'
          : parsed.harborId
            ? 'explicit'
            : parsed.referencesContext
              ? 'memory'
              : 'default',
      },
      vessel: VESSEL_BY_ID[vesselId] ?? VESSEL_BY_ID[DEFAULT_VESSEL_ID],
      memory,
      round: 1,
      artifacts,
      executed: [],
    };

    /* --- 3. Execute round 1 ---------------------------------------- */
    const results: AgentResult[] = [];
    const stepsById = new Map(plan.steps.map((s) => [s.id, s]));

    emit({ type: 'round', round: 1, agents: plan.agents });

    for (const agent of orderedRoster(plan.agents, plan.steps)) {
      const definition = AGENT_REGISTRY_IMPL[agent];
      if (!definition) continue;

      const stepId = plan.steps.find((s) => s.agents.includes(agent))?.id ?? agent;
      const goal = stepsById.get(stepId)?.goal ?? agent.replace(/_/g, ' ').toLowerCase();

      emit({ type: 'step-start', stepId, goal, agent });

      const result = runAgent(definition, context);
      results.push(result);
      context.executed.push(agent);

      for (const f of result.findings) {
        emit({
          type: 'agent-finding',
          agent,
          statement: f.statement,
          confidence: f.confidence,
          riskLevel: f.riskLevel,
        });
      }
      if (result.requestedAgents.length > 0) {
        emit({ type: 'collaboration', from: agent, to: result.requestedAgents });
      }

      emit({
        type: 'step-done',
        stepId,
        agent,
        status: result.status,
        summary: result.summary,
        durationMs: result.durationMs,
        findingCount: result.findings.length,
      });
    }

    /* --- 4. Follow-up round ----------------------------------------- */
    if (outcome.needsRound2) {
      const requested = collectRequested(results, context.executed);
      if (requested.length > 0) {
        context.round = 2;
        emit({ type: 'round', round: 2, agents: requested });

        for (const agent of requested) {
          const definition = AGENT_REGISTRY_IMPL[agent];
          if (!definition) continue;
          const result = runAgent(definition, context);
          // Round 2 is a refinement: keep only its summary so the evidence
          // ledger does not show the same numbers twice.
          results.push({ ...result, round: 2, findings: [] });
          context.executed.push(agent);

          emit({
            type: 'step-done',
            stepId: `followup-${agent.toLowerCase()}`,
            agent,
            status: result.status,
            summary: result.summary,
            durationMs: result.durationMs,
            findingCount: 0,
          });
        }
      }
    }

    /* --- 5. Synthesize ---------------------------------------------- */
    const riskLevel: RiskLevel = artifacts.riskLevel ?? 'LOW';
    const safetyScore = artifacts.safetyScore ?? 100;
    emit({ type: 'risk', level: riskLevel, safetyScore });

    const offline = synthesizeOffline({
      parsed,
      book,
      horizon: plan.horizon,
      artifacts,
      results,
      riskLevel,
      safetyScore,
    });

    let answer = offline.answer;
    let aiGenerated = false;

    if (options.gemini?.available()) {
      try {
        const enhanced = await options.gemini.synthesize({
          utterance,
          language: parsed.language,
          offlineDraft: offline.answer,
          riskLevel,
          evidence: collectEvidence(results),
          agentSummaries: results
            .filter((r) => r.status !== 'ERROR' && r.summary)
            .map((r) => ({ agent: r.agent, summary: r.summary })),
        });
        if (enhanced && enhanced.trim().length > 40) {
          answer = enhanced.trim();
          aiGenerated = true;
        }
      } catch {
        answer = offline.answer;
      }
    }

    emit({ type: 'synthesis', text: answer, aiGenerated });

    /* --- 6. Safety critique ------------------------------------------ */
    artifacts.draftAnswer = answer;
    const critique = critiqueAnswer(answer, context, riskLevel);
    answer = critique.text;
    context.artifacts.draftAnswer = answer;

    const criticResult = runAgent(criticAgent, context);
    results.push(criticResult);
    emit({ type: 'critique', corrections: critique.corrections, escalated: critique.escalated });
    emit({
      type: 'step-done',
      stepId: 'critique',
      agent: 'CRITIC_AGENT',
      status: criticResult.status,
      summary: criticResult.summary,
      durationMs: criticResult.durationMs,
      findingCount: criticResult.findings.length,
    });

    /* --- 7. Package --------------------------------------------------- */
    const nextMemory: ConversationMemory = {
      ...memory,
      activeHarborId: harbor.id,
      activeZone: artifacts.activeZone ?? memory.activeZone,
      lastHorizon: plan.horizon,
      lastVesselType: vesselId,
      lastIntent: parsed.intent,
      mentionedLocations: [
        ...new Set([...memory.mentionedLocations, harbor.shortName, ...(artifacts.activeZone ? [artifacts.activeZone.name] : [])]),
      ].slice(-6),
      turnCount: memory.turnCount + 1,
    };

    const result: OrchestrationResult = {
      answer,
      recommendation: offline.recommendation,
      detectedLanguage: parsed.language,
      aiGenerated,
      plan,
      selectedAgents: context.executed,
      agentResults: results,
      riskLevel,
      safetyScore,
      riskTrajectory: artifacts.riskTrajectory,
      weatherData: artifacts.weather,
      oceanData: artifacts.ocean,
      tideReport: artifacts.tideReport,
      marineAlerts: artifacts.alerts ?? [],
      pfzZone: artifacts.activeZone,
      hotspots: artifacts.hotspots,
      distanceKm: artifacts.distanceKm,
      routeData: artifacts.routeData,
      geofencingData: artifacts.geofencingData,
      historicalData: artifacts.historicalData,
      visualizations: artifacts.visualizations ?? [],
      memory: nextMemory,
      sources: collectSources(results),
      evidence: collectEvidence(results),
      timestamp: (options.now?.() ?? new Date()).toISOString(),
      disclaimer: book.disclaimer,
    };

    emit({ type: 'done', result });
    return { result, memory: nextMemory };
  } catch (error) {
    const book = getPhrasebook(preferred);
    // A non-Error throw is a programmer bug rather than bad input, but the
    // message is put on screen, so it is written in the user's language.
    const message = error instanceof Error ? error.message : book.ui.errOrchestrationWord;
    emit({ type: 'error', message });

    const result: OrchestrationResult = {
      answer: `${book.intro}\n\n${book.disclaimer}`,
      recommendation: book.recommendations.generic,
      detectedLanguage: preferred,
      aiGenerated: false,
      plan: {
        intent: 'GENERAL_MARINE',
        intentConfidence: 0,
        horizon: 'TODAY',
        reasoning: `${book.ui.errPlanningWord}: ${message}`,
        steps: [],
        agents: [],
        followUps: [],
      },
      selectedAgents: [],
      agentResults: [],
      riskLevel: 'LOW',
      safetyScore: 0,
      marineAlerts: [],
      visualizations: [],
      memory,
      sources: [],
      evidence: [],
      timestamp: new Date().toISOString(),
      disclaimer: book.disclaimer,
    };

    return { result, memory };
  }
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

/**
 * Topologically order the roster by the plan's declared dependencies, with the
 * planner's own order as the tie-break. A cycle in the graph degrades to the
 * declared order rather than deadlocking.
 */
export function orderedRoster(agents: AgentType[], steps: OrchestrationResult['plan']['steps']): AgentType[] {
  const stepById = new Map(steps.map((s) => [s.id, s]));

  // Map each agent to the first plan step that names it.
  const stepIdOfAgent = new Map<AgentType, string>();
  for (const step of steps) {
    for (const agent of step.agents) {
      if (!stepIdOfAgent.has(agent)) stepIdOfAgent.set(agent, step.id);
    }
  }

  const remaining = [...agents];
  const completedSteps = new Set<string>();
  const ordered: AgentType[] = [];

  while (remaining.length > 0) {
    let chosenIndex = remaining.length - 1;

    for (let i = 0; i < remaining.length; i++) {
      const stepId = stepIdOfAgent.get(remaining[i]);
      const deps = stepId ? (stepById.get(stepId)?.dependsOn ?? []) : [];
      // A dependency is satisfied once its own step has completed, or when the
      // agent that owns it is not in this roster at all.
      const ready = deps.every((dep) => {
        if (dep === stepId) return true;
        if (completedSteps.has(dep)) return true;
        return !agents.some((a) => stepIdOfAgent.get(a) === dep);
      });
      if (ready) {
        chosenIndex = i;
        break;
      }
    }

    const [chosen] = remaining.splice(chosenIndex, 1);
    ordered.push(chosen);
    const stepId = stepIdOfAgent.get(chosen);
    if (stepId) completedSteps.add(stepId);
  }

  return ordered;
}

/** Agents that asked for collaboration and have not yet run this turn. */
function collectRequested(results: AgentResult[], executed: AgentType[]): AgentType[] {
  const requested = new Set<AgentType>();
  for (const result of results) {
    for (const agent of result.requestedAgents) {
      if (!executed.includes(agent)) requested.add(agent);
    }
  }
  // The planner is not a runtime agent; the critic runs separately.
  requested.delete('PLANNER_AGENT');
  requested.delete('CRITIC_AGENT');
  requested.delete('VISUALIZATION_AGENT');
  requested.delete('RISK_VALIDATION_AGENT');
  return [...requested].filter((agent) => Boolean(AGENT_REGISTRY_IMPL[agent]));
}

/* ------------------------------------------------------------------ *
 * Proactive briefing (no utterance involved)
 * ------------------------------------------------------------------ */

/**
 * Situation report for a harbour, used by the home screen and the alert banner.
 * Reuses the same engine, so the proactive card and the conversational answer
 * can never contradict each other.
 */
export async function buildSituationReport(
  harborId: string,
  language: LanguageCode = 'en-IN',
  onEvent?: Emit,
): Promise<OrchestrationResult> {
  const harbor = HARBORS.find((h) => h.id === harborId) ?? HARBORS[0];

  const { result } = await orchestrate(
    `Give me the full marine situation report for ${harbor.shortName}`,
    {
      preferredLanguage: language,
      memory: freshMemory({ activeHarborId: harbor.id, turnCount: 1 }),
      // Explicit anchor: the planner must not fall back to the default harbour
      // when "for ${harbor.shortName}" does not match a gazetteer name.
      harborId: harbor.id,
      onEvent,
    },
  );

  return result;
}
