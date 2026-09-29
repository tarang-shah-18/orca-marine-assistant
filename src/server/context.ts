/**
 * Request → agent-context adapter.
 *
 * The conversational endpoint builds a context through the real planner, but
 * the data endpoints (`/api/weather`, `/api/route`, …) need to run a *single*
 * agent without going through a full turn. Both paths go through
 * `buildContext` so a direct API call and a chat answer are computed from
 * exactly the same inputs and can never disagree.
 */

import {
  AgentType,
  ConversationMemory,
  HarborLocation,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TimeHorizon,
} from '../types';
import { AgentContext, Artifacts, runAgent } from '../agents/base';
import { AGENT_REGISTRY_IMPL, freshMemory } from '../agents/orchestrator';
import { buildPlan, PlanOutcome } from '../agents/planner';
import { parseQuery, ParsedQuery, IntentType } from '../core/intent';
import { isSupportedLanguage } from '../core/language';
import { HARBOR_BY_ID, HARBORS, VESSEL_BY_ID, DEFAULT_VESSEL_ID } from '../core/dataset';
import { LatLon } from '../core/geo';

const HORIZONS: TimeHorizon[] = ['NOW', 'TODAY', 'TOMORROW', 'NEXT_3_DAYS', 'WEEK'];
const INTENTS: IntentType[] = [
  'FIND_PFZ',
  'PFZ_HOTSPOTS',
  'SAFETY_ASSESSMENT',
  'TIDE_WEATHER_SEA',
  'HAZARD_ALERTS',
  'SAFE_ROUTE',
  'PRODUCTIVITY_DIAGNOSIS',
  'AVOID_ZONES',
  'GEOFENCE_PROXIMITY',
  'OCEAN_STATE',
  'WEATHER_BRIEF',
  'GENERAL_MARINE',
];

/* ------------------------------------------------------------------ *
 * Coercion — query strings are untrusted, so nothing is assumed
 * ------------------------------------------------------------------ */

const LANGUAGE_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);

export function asLanguage(value: unknown, fallback: LanguageCode = 'en-IN'): LanguageCode {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (isSupportedLanguage(trimmed)) return trimmed;
  // Accept the bare subtag too, e.g. "hi" -> "hi-IN".
  const short = trimmed.split(/[-_]/)[0]?.toLowerCase();
  const match = short ? LANGUAGE_CODES.find((code) => code.split('-')[0] === short) : undefined;
  return match ?? fallback;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asHarborId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (HARBOR_BY_ID[trimmed]) return trimmed;
  const direct = HARBORS.find(
    (h) =>
      h.id.toLowerCase() === trimmed ||
      h.shortName.toLowerCase() === trimmed ||
      h.name.toLowerCase() === trimmed,
  );
  return direct?.id;
}

export function asVesselId(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_VESSEL_ID;
  const trimmed = value.trim();
  return VESSEL_BY_ID[trimmed] ? trimmed : DEFAULT_VESSEL_ID;
}

/**
 * The point a data endpoint is measured from: an explicit lat/lon if the caller
 * gave one, otherwise a named harbour.
 *
 * This exists as one function because two endpoints needed it and each had
 * written its own version. The obvious inline form —
 *
 *     const anchor = atExplicitPosition ? { latitude, longitude } : harbour;
 *     name: atExplicitPosition ? 'query position' : harbour.shortName
 *
 * — does not type-check: a separate boolean cannot narrow `anchor`, so the
 * `shortName` read is a property access on a union that may not have it.
 * Resolving the name in the same branch that picks the coordinates is both
 * correct and cheaper.
 */
export function resolveAnchor(query: Record<string, unknown>): {
  name: string;
  latitude: number;
  longitude: number;
} {
  const latitude = asNumber(query.lat ?? query.latitude);
  const longitude = asNumber(query.lon ?? query.longitude);
  if (latitude !== undefined && longitude !== undefined) {
    return { name: 'query position', latitude, longitude };
  }
  const harborId = asHarborId(query.harbor ?? query.harborId);
  const harbor = HARBOR_BY_ID[harborId ?? HARBORS[0].id] ?? HARBORS[0];
  return { name: harbor.name, latitude: harbor.latitude, longitude: harbor.longitude };
}

export function asHorizon(value: unknown, fallback: TimeHorizon = 'TODAY'): TimeHorizon {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase().replace(/[\s-]/g, '_');
  return HORIZONS.includes(upper as TimeHorizon) ? (upper as TimeHorizon) : fallback;
}

export function asIntent(value: unknown, fallback: IntentType = 'GENERAL_MARINE'): IntentType {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase();
  return INTENTS.includes(upper as IntentType) ? (upper as IntentType) : fallback;
}

/* ------------------------------------------------------------------ *
 * Context construction
 * ------------------------------------------------------------------ */

export interface ContextRequest {
  /** Natural-language query; synthetic strings are fine for data endpoints. */
  query?: string;
  language?: unknown;
  harborId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  horizon?: unknown;
  vessel?: unknown;
  intent?: unknown;
  memory?: ConversationMemory;
  /** Overrides used by the routing endpoint, which knows both ends. */
  originHarborId?: unknown;
  destination?: LatLon;
  seedArtifacts?: Artifacts;
}

export interface BuiltContext {
  context: AgentContext;
  parsed: ParsedQuery;
  outcome: PlanOutcome;
  artifacts: Artifacts;
  harbor: HarborLocation;
  position: LatLon;
}

export function buildContext(request: ContextRequest): BuiltContext {
  const language = asLanguage(request.language);
  // `ContextRequest.memory` is optional, but `AgentContext.memory` is not — and
  // agents dereference it freely (`memory.activeHarborId`). Defaulting here
  // keeps the two types honest instead of trusting every caller to pass one.
  const memory = request.memory ?? freshMemory();
  const query = (request.query ?? '').trim() || 'marine situation report';

  const parsed = parseQuery(query, language, memory);

  // The planner resolves the harbour from the parsed query and the memory; for
  // the data endpoints the caller may pin it explicitly.
  const pinnedHarborId = asHarborId(request.harborId);
  if (pinnedHarborId) {
    parsed.harborId = pinnedHarborId;
    parsed.harborName = HARBOR_BY_ID[pinnedHarborId]?.shortName;
  }
  if (request.intent !== undefined) {
    const intent = asIntent(request.intent, parsed.intent);
    parsed.intent = intent;
    parsed.intentConfidence = 1;
    parsed.matchedTerms = ['api-request'];
  }
  if (request.originHarborId !== undefined) {
    const origin = asHarborId(request.originHarborId);
    if (origin) parsed.originHarborId = origin;
  }
  const vesselId = request.vessel !== undefined ? asVesselId(request.vessel) : parsed.vesselId;
  parsed.vesselId = vesselId;

  const outcome = buildPlan(parsed, memory);
  const { plan, harbor, book } = outcome;

  // An explicit coordinate pair overrides the harbour-anchored position, so
  // `/api/weather?lat=…&lon=…` reports the sea at that point, not at the dock.
  const latitude = asNumber(request.latitude);
  const longitude = asNumber(request.longitude);
  const hasCoords =
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const position: LatLon = hasCoords
    ? { latitude, longitude }
    : outcome.position;

  const horizon = request.horizon !== undefined ? asHorizon(request.horizon, plan.horizon) : plan.horizon;

  const artifacts: Artifacts = { ...(request.seedArtifacts ?? {}) };

  const context: AgentContext = {
    parsed,
    language: parsed.language,
    book,
    horizon,
    harbor,
    position,
    anchor: {
      harborId: harbor.id,
      label: harbor.shortName,
      basis: parsed.harborId ? 'explicit' : parsed.referencesContext ? 'memory' : 'default',
    },
    vessel: VESSEL_BY_ID[vesselId] ?? VESSEL_BY_ID[DEFAULT_VESSEL_ID],
    memory,
    round: 1,
    artifacts,
    executed: [],
  };

  return { context, parsed, outcome, artifacts, harbor, position };
}

/**
 * Run a chain of agents against a prepared context, in the order given.
 *
 * Used by the data endpoints so that, for example, `/api/route` really does run
 * the PFZ agent before the route agent rather than faking the hand-off.
 */
export function runChain(
  built: BuiltContext,
  agents: AgentType[],
): ReturnType<typeof runAgent>[] {
  const results: ReturnType<typeof runAgent>[] = [];
  for (const agent of agents) {
    const definition = AGENT_REGISTRY_IMPL[agent];
    if (!definition) continue;
    const result = runAgent(definition, built.context);
    results.push(result);
    built.context.executed.push(agent);
  }
  return results;
}
