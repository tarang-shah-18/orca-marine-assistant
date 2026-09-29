import React, { useMemo } from 'react';
import {
  Brain,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Network,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { AGENT_REGISTRY, AgentResult, AgentType, OrchestrationResult, RiskLevel, LanguageCode } from '../types';
import type { OrchestratorEvent } from '../agents/orchestrator';
import { getPhrasebook } from '../core/i18n';

/**
 * Live agent trace.
 *
 * This is not a scripted animation: it is fed the orchestrator's own SSE
 * events, so every line the user sees corresponds to something an agent
 * actually did. A failed agent shows as failed, and a follow-up round shows
 * because an agent genuinely asked for one.
 */

export interface TraceStep {
  id: string;
  agent: AgentType;
  goal: string;
  status: 'pending' | 'running' | 'done' | 'error';
  summary?: string;
  durationMs?: number;
  findingCount?: number;
}

export interface CollaborationLink {
  from: AgentType;
  to: AgentType;
}

export interface TraceState {
  steps: TraceStep[];
  links: CollaborationLink[];
  round: number;
  plan?: OrchestrationResult['plan'];
  language?: string;
  risk?: { level: RiskLevel; safetyScore: number };
  critique?: { corrections: string[]; escalated: boolean };
  findings: Array<{ agent: AgentType; statement: string; confidence: number; riskLevel?: RiskLevel }>;
  aiGenerated?: boolean;
  finished: boolean;
}

export function emptyTrace(): TraceState {
  return { steps: [], links: [], round: 1, findings: [], finished: false };
}

/**
 * Fold one orchestrator event into the trace. Pure, so the same function works
 * for a live stream and for replaying a finished turn.
 */
export function reduceTrace(state: TraceState, event: OrchestratorEvent): TraceState {
  switch (event.type) {
    case 'language':
      return { ...state, language: event.language };

    case 'plan':
      return {
        ...state,
        plan: event.plan,
        steps: event.plan.steps.map((step) => ({
          id: step.id,
          agent: step.agents[0],
          goal: step.goal,
          status: 'pending' as const,
        })),
      };

    case 'step-start':
      return {
        ...state,
        steps: upsert(state.steps, {
          id: event.stepId,
          agent: event.agent,
          goal: event.goal,
          status: 'running',
        }),
      };

    case 'step-done':
      return {
        ...state,
        steps: upsert(state.steps, {
          id: event.stepId,
          agent: event.agent,
          goal: state.steps.find((s) => s.id === event.stepId)?.goal ?? event.agent,
          status: event.status === 'ERROR' ? 'error' : 'done',
          summary: event.summary,
          durationMs: event.durationMs,
          findingCount: event.findingCount,
        }),
      };

    case 'collaboration':
      return {
        ...state,
        links: [
          ...state.links,
          ...event.to
            .filter((to) => !state.links.some((l) => l.from === event.from && l.to === to))
            .map((to) => ({ from: event.from, to })),
        ],
      };

    case 'round':
      return { ...state, round: event.round };

    case 'risk':
      return { ...state, risk: { level: event.level, safetyScore: event.safetyScore } };

    case 'agent-finding':
      return {
        ...state,
        findings: [
          ...state.findings,
          {
            agent: event.agent,
            statement: event.statement,
            confidence: event.confidence,
            riskLevel: event.riskLevel,
          },
        ],
      };

    case 'critique':
      return { ...state, critique: { corrections: event.corrections, escalated: event.escalated } };

    case 'synthesis':
      return { ...state, aiGenerated: event.aiGenerated };

    case 'done':
      return { ...state, finished: true };

    default:
      return state;
  }
}

function upsert(steps: TraceStep[], step: TraceStep): TraceStep[] {
  const index = steps.findIndex((s) => s.id === step.id || (s.agent === step.agent && s.status === 'running'));
  if (index === -1) return [...steps, step];
  const next = [...steps];
  next[index] = { ...next[index], ...step };
  return next;
}

interface AgentTraceProps {
  trace: TraceState;
  /** Compact mode for the inline "why" strip under an answer. */
  compact?: boolean;
  results?: AgentResult[];
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ trace, compact = false, results = [] }) => {
  const summaries = useMemo(() => {
    const map = new Map<AgentType, AgentResult>();
    for (const r of results) map.set(r.agent, r);
    return map;
  }, [results]);

  const book = useMemo(
    () => getPhrasebook((trace.language as LanguageCode | undefined) ?? 'en-IN'),
    [trace.language],
  );
  const ui = book.ui;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {trace.steps.map((step) => {
          const info = AGENT_REGISTRY[step.agent];
          return (
            <span
              key={step.id}
              title={`${info?.name ?? step.agent} — ${step.goal}${step.summary ? `\n${step.summary}` : ''}`}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                step.status === 'error'
                  ? 'bg-red-950/60 text-red-300 border-red-800'
                  : step.status === 'done'
                    ? 'bg-slate-800 text-cyan-300 border-slate-700'
                    : step.status === 'running'
                      ? 'bg-cyan-950/60 text-cyan-200 border-cyan-800 animate-pulse'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              {info?.name ?? step.agent}
              {step.findingCount ? ` · ${step.findingCount}` : ''}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Plan */}
      {trace.plan && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 font-bold text-cyan-400 mb-1">
            <Brain className="w-4 h-4" />
            <span>{ui.tracePlanWord}</span>
            <span className="ml-auto text-[10px] font-medium text-slate-500">
              {trace.plan.intent} · {trace.plan.horizon} ·{' '}
              {Math.round(trace.plan.intentConfidence * 100)}% {ui.confidenceWord}
            </span>
          </div>
          <p className="text-slate-300 leading-snug">{trace.plan.reasoning}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1.5">
        {trace.steps.map((step) => {
          const info = AGENT_REGISTRY[step.agent];
          const result = summaries.get(step.agent);
          return (
            <div
              key={step.id}
              className="flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2"
            >
              <span className="mt-0.5 shrink-0">
                {step.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : step.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : step.status === 'error' ? (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                ) : (
                  <CircleDashed className="w-4 h-4 text-slate-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-200">{info?.name ?? step.agent}</span>
                  {step.durationMs !== undefined && (
                    <span className="text-[10px] text-slate-500">{step.durationMs} ms</span>
                  )}
                  {step.findingCount ? (
                    <span className="text-[10px] text-slate-500">
                      {step.findingCount} {ui.findingsWord}
                    </span>
                  ) : null}
                </div>
                <div className="text-slate-400 leading-snug">{step.summary || step.goal}</div>
                {result && result.dataSources.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.dataSources.map((source) => (
                      <span
                        key={source}
                        className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-500 border border-slate-800"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Collaboration */}
      {trace.links.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 font-bold text-violet-300 mb-1.5">
            <Network className="w-4 h-4" />
            <span>{ui.collaborationWord}</span>
          </div>
          <div className="space-y-1">
            {trace.links.map((link) => (
              <div key={`${link.from}-${link.to}`} className="text-slate-400">
                <span className="text-slate-200">{AGENT_REGISTRY[link.from]?.name ?? link.from}</span>
                <span className="mx-1.5 text-violet-400">→ {ui.askedWord}</span>
                <span className="text-slate-200">{AGENT_REGISTRY[link.to]?.name ?? link.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round 2 */}
      {trace.round > 1 && (
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" />
          {ui.followUpWord.replace('{n}', String(trace.round))}
        </div>
      )}

      {/* Risk verdict */}
      {trace.risk && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between">
          <span className="font-bold text-slate-300">{ui.compositeVerdictWord}</span>
          <span className="flex items-center gap-2">
            <span className="text-slate-400">{ui.safetyShortWord} {trace.risk.safetyScore}/100</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                trace.risk.level === 'SEVERE'
                  ? 'bg-red-500/20 text-red-300 border-red-500/50'
                  : trace.risk.level === 'HIGH'
                    ? 'bg-red-500/15 text-red-300 border-red-500/40'
                    : trace.risk.level === 'MODERATE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {trace.risk.level}
            </span>
          </span>
        </div>
      )}

      {/* Safety critic */}
      {trace.critique && trace.critique.corrections.length > 0 && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 font-bold text-amber-300 mb-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>{ui.criticAppliedWord.replace('{n}', String(trace.critique.corrections.length))}</span>
            {trace.critique.escalated && (
              <span className="ml-auto text-[10px] font-bold text-red-300">{ui.verdictEscalatedWord}</span>
            )}
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-200/80">
            {trace.critique.corrections.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AgentTrace;
