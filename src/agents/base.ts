/**
 * Agent contract and shared execution context.
 *
 * Every ORCA specialist is a pure-ish function `(context) => AgentResult`.
 * The orchestrator supplies the context, times the call, traps exceptions and
 * records the collaboration trace, so an individual agent never has to think
 * about telemetry, error reporting or cross-agent hand-off.
 *
 * `artifacts` is the blackboard: agents publish typed data products there and
 * downstream agents read them back. That is the whole of the "multi-agent"
 * mechanism — explicit typed hand-off rather than agents calling each other,
 * which keeps the trace renderable in the UI and debuggable in a log.
 */

import {
  AgentFinding,
  AgentResult,
  AgentType,
  ConversationMemory,
  EvidenceItem,
  HarborLocation,
  LanguageCode,
  MarineAlert,
  OceanData,
  PFZZone,
  ProductivityHotspot,
  RiskLevel,
  RouteData,
  RiskTrajectory,
  TidalData,
  TideReport,
  TimeHorizon,
  WeatherData,
} from '../types';
import type {
  GeofencingData,
  HistoricalData,
  VisualizationData,
  VisualizationType,
} from '../types';
import { Phrasebook } from '../core/i18n';
import { ParsedQuery } from '../core/intent';
import { VesselProfile } from '../core/dataset';
import { LatLon } from '../core/geo';

/** Blackboard shared between agents within a single orchestration run. */
export interface Artifacts {
  weather?: WeatherData;
  ocean?: OceanData;
  tideReport?: TideReport;
  tideEvents?: TidalData[];
  alerts?: MarineAlert[];
  pfzZones?: PFZZone[];
  activeZone?: PFZZone;
  hotspots?: ProductivityHotspot[];
  routeData?: RouteData;
  geofencingData?: GeofencingData;
  historicalData?: HistoricalData;
  visualizations?: VisualizationData[];
  riskLevel?: RiskLevel;
  safetyScore?: number;
  /** Departure-window risk series, when forecast slots are available. */
  riskTrajectory?: RiskTrajectory;
  distanceKm?: number;
  /** Draft answer text, passed to the critic after synthesis. */
  draftAnswer?: string;
  /** Corrections the critic applied, surfaced in the audit panel. */
  criticCorrections?: string[];
  /** Risk contributions each agent asked to be recorded for the verdict. */
  riskNotes?: Array<{ agent: AgentType; level: RiskLevel; reason: string }>;
}

export interface Anchor {
  harborId: string;
  label: string;
  basis: 'explicit' | 'memory' | 'default';
}

export interface AgentContext {
  parsed: ParsedQuery;
  language: LanguageCode;
  book: Phrasebook;
  horizon: TimeHorizon;
  harbor: HarborLocation;
  /** Reference position: the fishing ground when known, else the harbour. */
  position: LatLon;
  anchor: Anchor;
  vessel: VesselProfile;
  memory: ConversationMemory;
  round: number;
  artifacts: Artifacts;
  /** Ids of agents that have already run this turn, for collaboration trace. */
  executed: AgentType[];
}

export type AgentHandler = (context: AgentContext) => Omit<AgentResult, 'agent' | 'round' | 'durationMs'>;

export interface AgentDefinition {
  type: AgentType;
  run: AgentHandler;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** Build an `AgentFinding` with sensible defaults so agents stay terse. */
export function finding(
  statement: string,
  options: { confidence?: number; evidence?: EvidenceItem[]; riskLevel?: RiskLevel } = {},
): AgentFinding {
  return {
    statement,
    confidence: options.confidence ?? 0.7,
    evidence: options.evidence ?? [],
    riskLevel: options.riskLevel,
  };
}

/** Convenience evidence helper: `ev('Wind', '18 kt', 'IMD')`. */
export const ev = (label: string, value: string, source: string): EvidenceItem => ({
  label,
  value,
  source,
});

export function ok(
  findings: AgentFinding[],
  summary: string,
  dataSources: string[],
  requestedAgents: AgentType[] = [],
): Omit<AgentResult, 'agent' | 'round' | 'durationMs'> {
  return { status: 'OK', findings, summary, requestedAgents, dataSources };
}

export function partial(
  findings: AgentFinding[],
  summary: string,
  dataSources: string[],
  requestedAgents: AgentType[] = [],
): Omit<AgentResult, 'agent' | 'round' | 'durationMs'> {
  return { status: 'PARTIAL', findings, summary, requestedAgents, dataSources };
}

/** Register an agent. Exists so the roster is validated in one place. */
export function defineAgent(type: AgentType, run: AgentHandler): AgentDefinition {
  return { type, run };
}

/**
 * Run one agent with timing, error trapping and status normalisation.
 *
 * A failing agent degrades the answer rather than breaking it: ORCA is a
 * decision-support tool on a boat, and a partial brief is far more useful than
 * an error page.
 */
export function runAgent(definition: AgentDefinition, context: AgentContext): AgentResult {
  const started = now();
  try {
    const raw = definition.run(context);
    return {
      agent: definition.type,
      status: raw.status ?? 'OK',
      round: context.round,
      findings: raw.findings ?? [],
      summary: raw.summary ?? '',
      requestedAgents: raw.requestedAgents ?? [],
      dataSources: raw.dataSources ?? [],
      durationMs: Math.max(0, Math.round(now() - started)),
    };
  } catch (error) {
    return {
      agent: definition.type,
      status: 'ERROR',
      round: context.round,
      findings: [
        finding(`${definition.type} could not complete: ${describeError(error)}`, {
          confidence: 0,
        }),
      ],
      summary: `The ${definition.type.replace(/_/g, ' ').toLowerCase()} did not return a result for this turn.`,
      requestedAgents: [],
      dataSources: [],
      durationMs: Math.max(0, Math.round(now() - started)),
    };
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

/* ------------------------------------------------------------------ *
 * Shared numeric helpers used across agents
 * ------------------------------------------------------------------ */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const fmt = (value: number, decimals = 1): string => value.toFixed(decimals);

/** Fishermen-facing risk from a wave height, per IMD/INCOIS thresholds. */
export function riskFromWaveHeight(meters: number): RiskLevel {
  if (meters >= 4) return 'SEVERE';
  if (meters >= 3) return 'HIGH';
  if (meters >= 2) return 'MODERATE';
  return 'LOW';
}

/** Fishermen-facing risk from sustained wind in knots. */
export function riskFromWind(knots: number): RiskLevel {
  if (knots >= 45) return 'SEVERE';
  if (knots >= 30) return 'HIGH';
  if (knots >= 20) return 'MODERATE';
  return 'LOW';
}

export const worst = (...levels: RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>(
    (acc, level) => (RISK_RANK[level] > RISK_RANK[acc] ? level : acc),
    'LOW',
  );

export const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

/** Pick the forecast slots that belong to the requested horizon. */
export function slotsForHorizon<T extends { validHours: number }>(
  slots: T[],
  horizon: TimeHorizon,
): T[] {
  switch (horizon) {
    case 'NOW':
      return slots.filter((s) => s.validHours <= 6);
    case 'TODAY':
      return slots.filter((s) => s.validHours <= 24);
    case 'TOMORROW':
      return slots.filter((s) => s.validHours > 24 && s.validHours <= 48);
    case 'NEXT_3_DAYS':
      return slots.filter((s) => s.validHours <= 72);
    case 'WEEK':
      return slots.slice();
    default:
      return slots;
  }
}

/** Register a visualization on the blackboard and return it. */
export function publish(
  context: AgentContext,
  viz: Omit<VisualizationData, 'id' | 'categories' | 'series'> &
    Partial<Pick<VisualizationData, 'categories' | 'series'>> & { id?: string },
): VisualizationData {
  const full: VisualizationData = {
    id: viz.id ?? `viz-${context.executed.length}-${context.horizon}-${viz.type}`,
    type: (viz.type ?? 'chart') as VisualizationType,
    title: viz.title,
    subtitle: viz.subtitle,
    categories: viz.categories ?? [],
    series: viz.series ?? [],
    geo: viz.geo,
  };
  context.artifacts.visualizations = [...(context.artifacts.visualizations ?? []), full];
  return full;
}
