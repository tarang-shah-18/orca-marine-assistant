/**
 * The web client's single network boundary.
 *
 * Everything the UI knows about the engine goes through here, which preserves
 * two properties that matter for a judging demo on a flaky network:
 *
 *  1. **One code path.** The client never re-implements intent parsing, risk
 *     scoring or geodesy. It renders what the server computed.
 *  2. **It still works with the server down.** The deterministic engine is pure
 *     TypeScript with no Node dependencies, so if a request fails — no network,
 *     captive portal, a laptop in a boat — the same `orchestrate()` runs locally
 *     in the browser and produces the same answer, agent trace and evidence.
 *     Such an answer is labelled offline so nobody mistakes it for a live
 *     advisory.
 */

import {
  AGENT_REGISTRY,
  AgentInfo,
  ChatMessage,
  FleetOverview,
  GeofenceZone,
  GeofencingData,
  HarborLocation,
  HistoricalData,
  LanguageCode,
  MarineAlert,
  OceanData,
  OrchestrationResult,
  PFZZone,
  ProductivityHotspot,
  RouteData,
  WeatherData,
  VisualizationData,
} from '../types';
import type { OrchestratorEvent } from '../agents/orchestrator';
import { buildSituationReport, orchestrate, freshMemory } from '../agents/orchestrator';
import type { ConversationMemory } from '../types';
import {
  GEOFENCES,
  HARBORS,
  HARBOR_BY_ID,
  findNearestHarbor,
  getPfzZonesNear,
} from '../core/dataset';
import { haversineKm, roundTo } from '../core/geo';
import type { LatLon } from '../core/geo';
import { getPhrasebook } from '../core/i18n';
import { getLiveHotspotsNear } from '../core/dataAccess';
import { pickHeadlineAlert } from '../core/alerts';
import { headlineFor } from '../agents/synthesizer';
import { CANONICAL_SCENARIOS } from '../server/scenarios';

/* ------------------------------------------------------------------ *
 * Shapes mirrored from the API
 * ------------------------------------------------------------------ */

export interface SituationBrief {
  language: LanguageCode;
  riskLevel: OrchestrationResult['riskLevel'];
  riskLabel: string;
  safetyScore: number;
  headline: string;
  recommendation: string;
  alert: {
    id: string;
    type: string;
    title: string;
    advisoryLevel: MarineAlert['advisoryLevel'];
    severity: MarineAlert['severity'];
    distanceKm: number;
    bearing: string;
    action: string;
    validUntil: string;
    source: string;
  } | null;
  fishingZone: {
    id: string;
    name: string;
    distanceKm: number;
    bearing: string;
    productivityIndex: number;
    status: string;
    species: string[];
    validTill: string;
  } | null;
  weather: {
    windKnots: number;
    windDirection: string;
    gustKnots: number;
    visibilityKm: number;
    rainProbability: number;
    lightningRisk: string;
    condition: string;
    squallWarning: boolean;
  } | null;
  ocean: {
    waveHeightMeters: number;
    wavePeriodSeconds: number;
    seaCondition: string;
    sstCelsius: number;
    swellDirection: string;
    currentKnots: number;
  } | null;
  tide: {
    currentLevelMeters: number;
    isRising: boolean;
    rangeMeters: number;
    nextEvent?: { label: string; time: string; heightMeters: number; type: string };
    recommendedWindow?: {
      startLabel: string;
      endLabel: string;
      durationHours: number;
      quality: string;
      reason: string;
    };
  } | null;
  geofencing: {
    violations: GeofencingData['violations'];
    nearbyCount: number;
    warnings: string[];
  } | null;
  agents: string[];
  sources: string[];
  disclaimer: string;
  timestamp: string;
}

/** The map screen only needs position and label, not the full gazetteer entry. */
export type MapHarbor = Pick<
  HarborLocation,
  'id' | 'name' | 'shortName' | 'state' | 'region' | 'basin' | 'latitude' | 'longitude'
>;

export interface MapBundle {
  harbor: MapHarbor;
  harbours: Array<Pick<HarborLocation, 'id' | 'name' | 'shortName' | 'state' | 'latitude' | 'longitude'>>;
  fishingZones: PFZZone[];
  activeZone?: PFZZone;
  alerts: MarineAlert[];
  geofences: GeofenceZone[];
  geofencing?: GeofencingData;
  route?: RouteData;
  weather?: WeatherData;
  ocean?: OceanData;
  /** Live productivity hotspots (satellite proxy grid) for the map overlay. */
  hotspots?: ProductivityHotspot[];
  /** Present when the server is aligned to a live data cycle. */
  dataCycle?: { label: string; cycle: string; sources: string[] };
  riskLevel: OrchestrationResult['riskLevel'];
  safetyScore?: number;
  visualizations: VisualizationData[];
  agentTrace: Array<{ agent: string; status: string; summary: string }>;
}

export interface EngineStatus {
  version: string;
  ai: { configured: boolean; model: string; fallback: string };
  /** Engine inventory: agents, intents, languages, harbours, zones, profiles. */
  counts: Record<string, number>;
  agents: AgentInfo[];
  /** Model run the marine snapshot is aligned to (server only). */
  dataCycle?: { label: string; cycle: string; sources: string[] };
  /** Live conversation sessions held by the server (absent when offline). */
  sessions?: number;
  /** True when this status came from the in-browser fallback. */
  offline: boolean;
}

/* ------------------------------------------------------------------ *
 * Session state
 * ------------------------------------------------------------------ */

const SESSION_KEY = 'orca.session-id';
const MEMORY_KEY = 'orca.memory';

/**
 * Conversation memory lives in the server session, with a local mirror so the
 * offline path still resolves "is it safe *there* tomorrow" after the network
 * drops part-way through a conversation.
 */
let memory: ConversationMemory = freshMemory(readStoredMemory());

function readStoredMemory(): Partial<ConversationMemory> | undefined {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? (JSON.parse(raw) as Partial<ConversationMemory>) : undefined;
  } catch {
    return undefined;
  }
}

function rememberMemory(next: ConversationMemory): void {
  memory = next;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Private-browsing mode: memory simply stays in this tab.
  }
}

export function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 's-ephemeral';
  }
}

/* Configured API origin: same-origin by default. When the web client and the
 * engine are hosted separately (e.g. Vercel client + Render/Railway engine),
 * build the client with VITE_API_BASE=https://<engine-host>/api. Always a full
 * origin — trailing slashes are stripped, and a bare value falls back to '/api'. */
const API_BASE =
  ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '') || '/api';

export function resetConversation(): void {
  rememberMemory(freshMemory());
  void fetch(`${API_BASE}/session/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId() }),
  }).catch(() => undefined);
}

let lastCallWasOffline = false;
export const isOffline = (): boolean => lastCallWasOffline;

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

interface Envelope<T> {
  status: string;
  data: T;
  error?: string;
  [key: string]: unknown;
}

async function getEnvelope<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<Envelope<T>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  const response = await fetch(`${API_BASE}${path}${query ? `?${query}` : ''}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  const payload = (await response.json()) as Envelope<T>;
  if (payload?.status === 'error') throw new Error(payload.error ?? 'API error');
  return payload;
}

const getJson = <T,>(path: string, params: Record<string, string | number | undefined> = {}) =>
  getEnvelope<T>(path, params).then((p) => p.data);

/** Reference data is also bundled, so these need no network at all. */
export const harbours = (): HarborLocation[] => HARBORS;
export const scenarios = CANONICAL_SCENARIOS;

/* ------------------------------------------------------------------ *
 * Conversation
 * ------------------------------------------------------------------ */

export interface AskOptions {
  message: string;
  language: LanguageCode;
  harborId?: string;
  latitude?: number;
  longitude?: number;
  /** Called for every orchestrator event while the answer is being produced. */
  onEvent?: (event: OrchestratorEvent) => void;
}

export interface AskOutcome {
  result: OrchestrationResult;
  /** True when the answer came from the in-browser engine, not the server. */
  offline: boolean;
}

export async function ask(options: AskOptions): Promise<AskOutcome> {
  const body = JSON.stringify({
    message: options.message,
    language: options.language,
    sessionId: sessionId(),
    harbor: options.harborId,
    latitude: options.latitude,
    longitude: options.longitude,
  });

  if (options.onEvent) {
    try {
      const streamed = await streamChat(body, options.onEvent);
      if (streamed) {
        lastCallWasOffline = false;
        rememberMemory(streamed.memory);
        return { result: streamed.result, offline: false };
      }
    } catch {
      // Fall through to the local engine.
    }
  }

  lastCallWasOffline = true;
  const local = await orchestrateOffline(options);
  return { result: local.result, offline: true };
}

async function streamChat(
  body: string,
  onEvent: (event: OrchestratorEvent) => void,
): Promise<{ result: OrchestrationResult; memory: ConversationMemory } | null> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body,
  });

  if (!response.ok || !response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: OrchestrationResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (line) {
        try {
          const event = JSON.parse(line.slice(6)) as OrchestratorEvent;
          onEvent(event);
          if (event.type === 'done') finalResult = event.result;
        } catch {
          // A truncated frame must never cost a fisher their answer.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  if (!finalResult) return null;
  return { result: finalResult, memory: finalResult.memory };
}

/** Run the deterministic engine in the browser, with no network at all. */
export async function orchestrateOffline(options: AskOptions): Promise<{
  result: OrchestrationResult;
  memory: ConversationMemory;
}> {
  const { result, memory: next } = await orchestrate(options.message, {
    preferredLanguage: options.language,
    memory,
    harborId: options.harborId,
    position:
      options.latitude !== undefined && options.longitude !== undefined
        ? { latitude: options.latitude, longitude: options.longitude }
        : undefined,
    onEvent: options.onEvent,
  });

  rememberMemory(next);
  return { result, memory: next };
}

/* ------------------------------------------------------------------ *
 * Proactive briefing
 * ------------------------------------------------------------------ */

/**
 * Which port the engine actually built the report about, and why.
 *
 * This is not decoration. The server resolves a GPS fix to the nearest harbour,
 * which is frequently *not* the harbour the user has selected on screen, and the
 * prototype simply assumed its own request had won. A user who turned location
 * on and saw the badge light up while the dashboard kept describing the old port
 * had no way to tell a stale render from a broken feature. The engine now
 * reports the anchor it used, and the client reconciles its selection to it.
 */
export interface SituationAnchor {
  harborId: string;
  harborName: string;
  source: 'gps' | 'selection';
  /** Straight-line distance from the fix to the port it resolved to. */
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SituationOutcome {
  brief: SituationBrief;
  result: OrchestrationResult;
  offline: boolean;
  /**
   * When this payload was received, on the client's clock. Not the server's
   * `timestamp`: the number a user reads as "updated" has to be measured from the
   * moment their screen actually changed, otherwise a two-minute-old cached
   * response would claim to be fresh.
   */
  receivedAt: number;
  anchor: SituationAnchor | null;
}

/**
 * The banner on the home screen. Uses the same pipeline as the chat, so the
 * proactive card and a conversational answer can never contradict each other.
 *
 * A `fix` is sent when — and only when — the user has asked for location. It
 * takes precedence over `harborId` server-side, so passing both is the honest
 * description of "the boat is here, not at the port you have selected".
 */
export async function situation(
  harborId: string,
  language: LanguageCode,
  fix?: LatLon | null,
): Promise<SituationOutcome> {
  try {
    const payload = await getEnvelope<SituationBrief>('/situation', {
      harbor: harborId,
      language,
      lat: fix?.latitude,
      lon: fix?.longitude,
    });
    lastCallWasOffline = false;
    return {
      brief: payload.data,
      result: payload.result as OrchestrationResult,
      offline: false,
      receivedAt: Date.now(),
      anchor: (payload.anchor as SituationAnchor | undefined) ?? null,
    };
  } catch {
    // Offline: the bundled reference snapshot is anchored to a harbour, never to
    // a live position. Resolving the fix here — with the same rule the server
    // uses — keeps the two paths honest about which port the words describe.
    const harbor = fix
      ? findNearestHarbor(fix.latitude, fix.longitude)
      : (HARBOR_BY_ID[harborId] ?? HARBORS[0]);
    const local = await orchestrateOffline({
      message: 'Give me the full marine situation report',
      language,
      harborId: harbor.id,
    });
    lastCallWasOffline = true;
    return {
      brief: briefFromResult(local.result),
      result: local.result,
      offline: true,
      receivedAt: Date.now(),
      anchor: {
        harborId: harbor.id,
        harborName: harbor.name,
        source: fix ? ('gps' as const) : ('selection' as const),
        distanceKm: fix ? roundTo(haversineKm(fix, harbor), 1) : null,
        latitude: fix?.latitude ?? null,
        longitude: fix?.longitude ?? null,
      },
    };
  }
}

const RISK_ORDER_LOCAL: Record<OrchestrationResult['riskLevel'], number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

/** Same compact shape the server sends, derived locally for the offline path. */
function briefFromResult(result: OrchestrationResult): SituationBrief {
  const book = getPhrasebook(result.detectedLanguage);
  const zone = result.pfzZone;
  // Shared with the server (`summariseForBanner`): severity-ranked advisory in
  // force, otherwise the nearest alert inside a strictly local horizon. The
  // two paths can never disagree about which alert heads the banner.
  const alert = pickHeadlineAlert(result.marineAlerts);
  const tide = result.tideReport;
  const geofencing = result.geofencingData;

  return {
    language: result.detectedLanguage,
    riskLevel: result.riskLevel,
    riskLabel: book.riskWords[RISK_ORDER_LOCAL[result.riskLevel]] ?? result.riskLevel,
    safetyScore: result.safetyScore,
    // Rendered through the exact helper the server banner uses, so the offline
    // fallback and a live connection can never disagree about the headline.
    headline: headlineFor(
      {
        intent: result.plan.intent,
        horizon: result.plan.horizon,
        harborName:
          HARBOR_BY_ID[result.memory.activeHarborId ?? '']?.name ??
          result.tideReport?.station.name ??
          HARBORS[0].name,
        riskLevel: result.riskLevel,
        safetyScore: result.safetyScore,
        alerts: result.marineAlerts,
        pfzZone: result.pfzZone,
        hotspots: result.hotspots,
        routeData: result.routeData,
        historicalData: result.historicalData,
        tideReport: result.tideReport,
        ocean: result.oceanData,
        weather: result.weatherData,
        geofencingData: result.geofencingData,
      },
      book,
    ),
    recommendation: result.recommendation,
    alert: alert
      ? {
          id: alert.id,
          type: alert.type,
          title: alert.title,
          advisoryLevel: alert.advisoryLevel,
          severity: alert.severity,
          distanceKm: alert.distanceKm,
          bearing: alert.bearing,
          action: alert.action,
          validUntil: alert.validUntil,
          source: alert.source,
        }
      : null,
    fishingZone: zone
      ? {
          id: zone.id,
          name: zone.name,
          distanceKm: zone.distanceKm,
          bearing: zone.bearing,
          productivityIndex: zone.productivityIndex,
          status: zone.status,
          species: zone.targetFishSpecies,
          validTill: zone.validTill,
        }
      : null,
    weather: result.weatherData
      ? {
          windKnots: result.weatherData.windSpeedKnots,
          windDirection: result.weatherData.windDirection,
          gustKnots: result.weatherData.gustKnots,
          visibilityKm: result.weatherData.visibilityKm,
          rainProbability: result.weatherData.rainProbability,
          lightningRisk: result.weatherData.lightningRisk,
          condition: result.weatherData.condition,
          squallWarning: result.weatherData.squallWarning,
        }
      : null,
    ocean: result.oceanData
      ? {
          waveHeightMeters: result.oceanData.waveHeightMeters,
          wavePeriodSeconds: result.oceanData.wavePeriodSeconds,
          seaCondition: result.oceanData.seaCondition,
          sstCelsius: result.oceanData.seaSurfaceTempCelsius,
          swellDirection: result.oceanData.swellDirection,
          currentKnots: result.oceanData.currentKnots,
        }
      : null,
    tide: tide
      ? {
          currentLevelMeters: tide.currentLevel,
          isRising: tide.isRising,
          rangeMeters: tide.maxRangeMeters,
          nextEvent: tide.events?.[0],
          recommendedWindow: tide.recommendedWindow,
        }
      : null,
    geofencing: geofencing
      ? {
          violations: geofencing.violations,
          nearbyCount: geofencing.nearbyBoundaries.length,
          warnings: geofencing.warnings,
        }
      : null,
    agents: result.selectedAgents,
    sources: result.sources,
    disclaimer: result.disclaimer,
    timestamp: result.timestamp,
  };
}

/* ------------------------------------------------------------------ *
 * Map & status
 * ------------------------------------------------------------------ */

export async function mapBundle(harborId: string, language: LanguageCode): Promise<MapBundle> {
  try {
    const data = await getJson<MapBundle>('/map-data', { harbor: harborId, language });
    lastCallWasOffline = false;
    return data;
  } catch {
    // The map is the one screen a fisher opens *before* deciding to leave, so
    // it must not go blank because a boat has no signal.
    lastCallWasOffline = true;
    return await mapBundleOffline(harborId, language);
  }
}

/** Same bundle, assembled in the browser from the bundled knowledge base. */
export async function mapBundleOffline(
  harborId: string,
  language: LanguageCode,
): Promise<MapBundle> {
  const harbor = HARBOR_BY_ID[harborId] ?? HARBORS[0];
  const result = await buildSituationReport(harbor.id, language);

  return {
    harbor: {
      id: harbor.id,
      name: harbor.name,
      shortName: harbor.shortName,
      state: harbor.state,
      region: harbor.region,
      basin: harbor.basin,
      latitude: harbor.latitude,
      longitude: harbor.longitude,
    },
    harbours: HARBORS.map((h) => ({
      id: h.id,
      name: h.name,
      shortName: h.shortName,
      state: h.state,
      latitude: h.latitude,
      longitude: h.longitude,
    })),
    fishingZones: getPfzZonesNear(harbor.latitude, harbor.longitude).slice(0, 6),
    activeZone: result.pfzZone,
    alerts: result.marineAlerts,
    geofences: GEOFENCES,
    geofencing: result.geofencingData,
    route: result.routeData,
    weather: result.weatherData,
    ocean: result.oceanData,
    hotspots: getLiveHotspotsNear({ latitude: harbor.latitude, longitude: harbor.longitude }),
    riskLevel: result.riskLevel,
    safetyScore: result.safetyScore,
    visualizations: result.visualizations,
    agentTrace: result.agentResults.map((r) => ({
      agent: r.agent,
      status: r.status,
      summary: r.summary,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Research data — historical productivity & hotspot science
 * ------------------------------------------------------------------ */

export interface HistoricalOutcome {
  diagnosis: HistoricalData | null;
  findings: Array<{ statement: string; confidence: number }>;
  visualizations: VisualizationData[];
  offline: boolean;
}

/** Long-run productivity diagnosis for the researcher dashboard. */
export async function historicalProductivity(
  harborId: string,
  language: LanguageCode,
): Promise<HistoricalOutcome> {
  try {
    const payload = await getEnvelope<{
      diagnosis: HistoricalData;
      findings?: Array<{ statement: string; confidence: number }>;
      visualizations?: VisualizationData[];
    }>('/historical', { harbor: harborId, language });
    lastCallWasOffline = false;
    return {
      diagnosis: payload.data.diagnosis,
      findings: payload.data.findings ?? [],
      visualizations: payload.data.visualizations ?? [],
      offline: false,
    };
  } catch {
    const local = await orchestrateOffline({
      message: 'why has fish productivity declined in my harbour',
      language,
      harborId,
    });
    lastCallWasOffline = true;
    return {
      diagnosis: local.result.historicalData ?? null,
      findings: local.result.agentResults
        .flatMap((r) => r.findings)
        .map((f) => ({ statement: f.statement, confidence: f.confidence })),
      visualizations: local.result.visualizations,
      offline: true,
    };
  }
}

export interface HotspotOutcome {
  hotspot: ProductivityHotspot | null;
  zones: PFZZone[];
  visualizations: VisualizationData[];
  offline: boolean;
}

/** Chlorophyll + SST hotspot science for the researcher dashboard. */
export async function hotspotScience(
  harborId: string,
  language: LanguageCode,
): Promise<HotspotOutcome> {
  const anchor = HARBOR_BY_ID[harborId] ?? HARBORS[0];
  try {
    const payload = await getEnvelope<{
      hotspots: ProductivityHotspot[];
      visualizations?: VisualizationData[];
    }>('/hotspots', { harbor: harborId, language });
    lastCallWasOffline = false;
    return {
      hotspot: payload.data.hotspots[0] ?? null,
      zones: getPfzZonesNear(anchor.latitude, anchor.longitude).slice(0, 5),
      visualizations: payload.data.visualizations ?? [],
      offline: false,
    };
  } catch {
    lastCallWasOffline = true;
    const local = await orchestrateOffline({
      message:
        'which regions show high chlorophyll and favourable sea surface temperature near my harbour',
      language,
      harborId,
    });
    return {
      hotspot: local.result.hotspots?.[0] ?? null,
      zones: getPfzZonesNear(anchor.latitude, anchor.longitude).slice(0, 5),
      visualizations: local.result.visualizations,
      offline: true,
    };
  }
}

export async function engineStatus(): Promise<EngineStatus> {
  try {
    const data = await getJson<Omit<EngineStatus, 'offline'>>('/status');
    lastCallWasOffline = false;
    return { ...data, offline: false };
  } catch {
    lastCallWasOffline = true;
    return {
      version: '2.0.0',
      ai: { configured: false, model: '—', fallback: 'deterministic engine running locally' },
      counts: {
        agents: Object.keys(AGENT_REGISTRY).length,
        harbours: HARBORS.length,
        fishingZones: 14,
        languages: 11,
      },
      agents: Object.values(AGENT_REGISTRY),
      offline: true,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Fleet intelligence
 * ------------------------------------------------------------------ */

/**
 * Coast-wide posture — one weighted risk snapshot per harbour, worst first.
 * Falls back to a locally computed overview (same matrix, same products)
 * when the server is unreachable.
 */
export async function fleetWatch(vesselId = 'motorized_dinghy'): Promise<FleetOverview> {
  try {
    const data = await getJson<FleetOverview>('/fleet', { vessel: vesselId });
    lastCallWasOffline = false;
    return data;
  } catch {
    const { fleetOverview } = await import('../core/fleet');
    lastCallWasOffline = true;
    return fleetOverview(vesselId);
  }
}

/* ------------------------------------------------------------------ *
 * Chat message construction
 * ------------------------------------------------------------------ */

export function toChatMessage(
  id: string,
  sender: ChatMessage['sender'],
  text: string,
  result?: OrchestrationResult,
  offline = false,
): ChatMessage {
  return {
    id,
    sender,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    language: result?.detectedLanguage,
    result,
    offline,
  };
}
