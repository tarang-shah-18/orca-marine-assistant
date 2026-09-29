/**
 * Live agent trace.
 *
 * The orchestrator emits typed events as it works; this folds them into a
 * single accumulating state and renders it. The same reducer shape as the web
 * client so a trace reads identically on a phone and a desktop, and so a
 * finished turn can be replayed from its own `agentResults` without the
 * server re-running anything.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { Badge } from './ui';

export const emptyTrace = () => ({
  language: null,
  script: null,
  plan: null,
  steps: [],
  links: [],
  findings: [],
  round: 1,
  risk: null,
  aiGenerated: false,
  critique: null,
  finished: false,
});

/**
 * Replace a step in place, or append it.
 *
 * The second clause matters: a plan step can list several agents, and the
 * orchestrator reports them all under the same `stepId`. Keying on the agent
 * while a step is still running is what stops three specialists from collapsing
 * into one row.
 */
function upsert(steps, step) {
  const index = steps.findIndex(
    (s) => s.id === step.id || (s.agent === step.agent && s.status === 'running'),
  );
  if (index === -1) return [...steps, step];
  const next = [...steps];
  next[index] = { ...next[index], ...step };
  return next;
}

/** Fold one orchestrator event into the trace. Pure, so it is trivially testable. */
export function reduceTrace(state, event) {
  switch (event.type) {
    case 'language':
      return { ...state, language: event.language, script: event.script };

    case 'plan':
      return {
        ...state,
        plan: event.plan,
        // Seed every planned step up front so the fisher sees the whole roster
        // before any of it has run, not just the part that happened to finish.
        steps: event.plan.steps.map((step) => ({
          id: step.id,
          agent: step.agents[0],
          goal: step.goal,
          status: 'pending',
          summary: '',
          durationMs: 0,
          findingCount: 0,
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
          summary: '',
          durationMs: 0,
          findingCount: 0,
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

    case 'synthesis':
      return { ...state, aiGenerated: event.aiGenerated };

    case 'critique':
      return {
        ...state,
        critique: { corrections: event.corrections, escalated: event.escalated },
      };

    case 'done':
      return { ...state, finished: true };

    default:
      return state;
  }
}

/** Rebuild a finished turn's trace from the result it produced. */
export function traceFromResult(result) {
  if (!result) return emptyTrace();
  return {
    ...emptyTrace(),
    language: result.detectedLanguage,
    plan: result.plan,
    round: Math.max(1, ...result.agentResults.map((r) => r.round ?? 1)),
    steps: result.agentResults.map((r, i) => ({
      id: `replay-${r.agent}-${i}`,
      agent: r.agent,
      goal: r.goal ?? r.agent,
      status: r.status === 'ERROR' ? 'error' : 'done',
      summary: r.summary,
      durationMs: r.durationMs,
      findingCount: (r.findings ?? []).length,
    })),
    links: result.agentResults.flatMap((r) =>
      (r.requestedAgents ?? []).map((to) => ({ from: r.agent, to })),
    ),
    findings: result.agentResults.flatMap((r) =>
      (r.findings ?? []).map((f) => ({
        agent: r.agent,
        statement: f.statement,
        confidence: f.confidence,
        riskLevel: f.riskLevel,
      })),
    ),
    risk: { level: result.riskLevel, safetyScore: result.safetyScore },
    aiGenerated: result.aiGenerated,
    finished: true,
  };
}

const STEP_COLOUR = {
  pending: colors.surfaceHigh,
  running: colors.cyan,
  done: colors.emerald,
  error: colors.red,
};

/** Short agent label — `WEATHER_AGENT` reads better as `Weather`. */
const shortAgent = (id = '') =>
  id
    .replace('_AGENT', '')
    .split('_')
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(' ');

export default function AgentTrace({ trace, compact = false, live = false }) {
  const shown = compact ? trace.steps.slice(0, 6) : trace.steps;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {live ? 'Agents working' : `Agent trace · ${trace.steps.length} specialists`}
        </Text>
        {trace.round > 1 ? <Badge label={`round ${trace.round}`} color={colors.violet} /> : null}
        {trace.aiGenerated ? <Badge label="GEMINI" color={colors.violet} /> : null}
      </View>

      {trace.plan ? (
        <Text style={styles.plan}>
          {trace.plan.intent} · {trace.plan.reasoning}
        </Text>
      ) : null}

      {shown.map((step) => (
        <View key={step.id} style={styles.step}>
          <View style={[styles.dot, { backgroundColor: STEP_COLOUR[step.status] ?? colors.cyan }]} />
          <View style={styles.stepBody}>
            <View style={styles.stepHead}>
              <Text style={styles.stepAgent}>{shortAgent(step.agent)}</Text>
              {step.durationMs ? (
                <Text style={styles.stepTime}>{Math.round(step.durationMs)} ms</Text>
              ) : null}
            </View>
            <Text style={styles.stepGoal} numberOfLines={3}>
              {step.summary || step.goal || 'queued'}
            </Text>
          </View>
        </View>
      ))}

      {!compact && trace.links.length > 0 ? (
        <Text style={styles.collaboration}>
          Collaboration:{' '}
          {trace.links
            .map((l) => `${shortAgent(l.from)} → ${l.to.map(shortAgent).join(', ')}`)
            .join(' · ')}
        </Text>
      ) : null}

      {!compact && trace.findings.length > 0 ? (
        <ScrollView style={styles.findings} nestedScrollEnabled>
          {trace.findings.map((f, i) => (
            <Text key={`${f.agent}-${i}`} style={styles.finding}>
              • {f.statement}
            </Text>
          ))}
        </ScrollView>
      ) : null}

      {trace.critique ? (
        <Text style={styles.critique}>
          Critic:{' '}
          {trace.critique.corrections.length === 0
            ? 'answer already safe and correctly hedged.'
            : `${trace.critique.corrections.length} correction(s) applied${
                trace.critique.escalated ? ' · advisory escalated' : ''
              }.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.void,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  headerTitle: { color: colors.cyan, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  plan: { color: colors.textFaint, fontSize: 10, marginTop: 4, lineHeight: 14 },
  step: { flexDirection: 'row', gap: 8, marginTop: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  stepBody: { flex: 1 },
  stepHead: { flexDirection: 'row', justifyContent: 'space-between' },
  stepAgent: { color: colors.text, fontSize: 11, fontWeight: '700' },
  stepTime: { color: colors.textFaint, fontSize: 9 },
  stepGoal: { color: colors.textDim, fontSize: 10, lineHeight: 14, marginTop: 1 },
  collaboration: { color: colors.violet, fontSize: 10, marginTop: space.sm, lineHeight: 14 },
  findings: { maxHeight: 150, marginTop: space.sm },
  finding: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginBottom: 2 },
  critique: { color: colors.amber, fontSize: 10, marginTop: space.sm, lineHeight: 14 },
});
