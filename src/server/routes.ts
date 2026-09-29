/**
 * ORCA HTTP API.
 *
 * Two families of endpoints:
 *
 *  - **Data endpoints** (`/api/pfz`, `/api/weather`, `/api/route`, …) expose one
 *    specialist at a time. They still run the *real* agent through
 *    `buildContext` + `runChain`, so `/api/weather` and the weather paragraph in
 *    a chat answer are computed by the same code from the same inputs and can
 *    never disagree.
 *
 *  - **Conversation endpoints** (`/api/chat`, `/api/chat/stream`) run the full
 *    multi-agent pipeline. The streaming variant forwards the orchestrator's
 *    typed events as SSE, which is what makes the agent trace in the UI real
 *    rather than a scripted animation.
 */

import { NextFunction, Request, Response, Router } from 'express';
import {
  AGENT_REGISTRY,
  DOMAIN_MODEL_VERSION,
  OrchestrationResult,
  RISK_ORDER,
  RouteData,
  SUPPORTED_LANGUAGES,
} from '../types';
import {
  AGENT_REGISTRY_IMPL,
  buildSituationReport,
  freshMemory,
  orchestrate,
  OrchestratorEvent,
} from '../agents/orchestrator';
import { buildTideReport } from '../agents/tideAgent';
import { headlineFor } from '../agents/synthesizer';
import { ALL_INTENTS, INTENT_CATALOG } from '../core/intent';
import {
  DATA_CYCLE,
  GEOFENCES,
  HARBORS,
  HARBOR_BY_ID,
  HISTORICAL_REGIONS,
  PFZ_ZONES,
  TIDE_STATIONS,
  VESSEL_PROFILES,
  findNearestHarbor,
  getHistoricalSeries,
  getMarineAlertsNear,
  getNearestPfz,
  getOceanAt,
  getOceanState,
  getPfzZonesNear,
  getTideStation,
  getWeather,
  getWeatherNear,
} from '../core/dataset';
import { liveDataCycle, liveStatusReport, refreshLive } from '../core/live';
import { fleetOverview } from '../core/fleet';
import { getPhrasebook } from '../core/i18n';
import {
  applyAlertLocalization,
  localizeAlertText,
  localizeCondition,
  localizeSource,
  localizeTideReason,
} from '../core/localize';
import { speechTagFor } from '../core/language';
import { formatBearing, haversineKm, initialBearingDeg, roundTo } from '../core/geo';
import { pickHeadlineAlert } from '../core/alerts';
import { geminiBridge, geminiStatus } from './gemini';
import {
  asHarborId,
  asHorizon,
  asLanguage,
  asNumber,
  asVesselId,
  buildContext,
  resolveAnchor,
  runChain,
} from './context';
import { readMemory, resetMemory, sessionCount, writeMemory } from './session';
import { CANONICAL_SCENARIOS } from './scenarios';

export const api = Router();

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware — the request would hang. Every async endpoint is wrapped
 * with this so a failure becomes a clean JSON 500 (via the app-level error
 * handler in `server.ts`) instead of a dangling connection.
 */
function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown> | unknown) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res)).catch(next);
  };
}

const VERSION = '2.0.0';

/* ------------------------------------------------------------------ *
 * Minimal optional metrics
 * ------------------------------------------------------------------ */

const METRIC_STARTED = Date.now();
const HTTP_REQUESTS = new Map<string, number>();
const HTTP_RESPONSES = new Map<string, number>();
const HTTP_LATENCY = new Map<string, { count: number; total: number; max: number }>();

/** Cheap Prometheus counters per API route — no dependencies, no exports. */
api.use((req, res, next) => {
  const route = `${req.method} ${req.path.split('?')[0]}`;
  HTTP_REQUESTS.set(route, (HTTP_REQUESTS.get(route) ?? 0) + 1);
  const startedAt = Date.now();
  res.on('finish', () => {
    const statusKey = `${route} ${res.statusCode}`;
    HTTP_RESPONSES.set(statusKey, (HTTP_RESPONSES.get(statusKey) ?? 0) + 1);
    const took = Date.now() - startedAt;
    const agg = HTTP_LATENCY.get(route) ?? { count: 0, total: 0, max: 0 };
    agg.count += 1;
    agg.total += took;
    if (took > agg.max) agg.max = took;
    HTTP_LATENCY.set(route, agg);
  });
  next();
});

/** Uniform envelope so the client has exactly one success shape to parse. */
function ok(res: Response, data: unknown, extra: Record<string, unknown> = {}): void {
  res.json({
    status: 'success',
    apiVersion: DOMAIN_MODEL_VERSION,
    ...extra,
    data,
    timestamp: new Date().toISOString(),
  });
}

function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ status: 'error', error: message, timestamp: new Date().toISOString() });
}

/* ------------------------------------------------------------------ *
 * Health & status
 * ------------------------------------------------------------------ */

api.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ORCA Marine Intelligence Platform',
    engine: 'deterministic multi-agent',
    version: VERSION,
    apiVersion: DOMAIN_MODEL_VERSION,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness vs. liveness: `/health` answers "is the process up", `/ready`
 * answers "can it take real turns" by reporting which data mode it would serve
 * right now (live upstreams, or the flagged reference fallback when offline).
 */
api.get('/ready', (_req: Request, res: Response) => {
  const live = liveStatusReport();
  ok(res, {
    ready: true,
    mode: live.live ? 'live' : 'reference',
    products: live.products,
  });
});

/** Prometheus text exposition of the lightweight counters collected above. */
api.get('/metrics', (_req: Request, res: Response) => {
  const live = liveStatusReport();
  const liveProducts = live.products.filter((p) => p.live).length;
  const esc = (label: string): string => label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const lines: string[] = [
    '# HELP orca_uptime_seconds Seconds since the API process started.',
    '# TYPE orca_uptime_seconds gauge',
    `orca_uptime_seconds ${Math.floor((Date.now() - METRIC_STARTED) / 1000)}`,
    '# HELP orca_sessions Active conversation sessions.',
    '# TYPE orca_sessions gauge',
    `orca_sessions ${sessionCount()}`,
    '# HELP orca_live_products Number of upstream products currently live.',
    '# TYPE orca_live_products gauge',
    `orca_live_products ${liveProducts}`,
    '# HELP orca_data_mode 1 when serving live upstream data, 0 in reference mode.',
    '# TYPE orca_data_mode gauge',
    `orca_data_mode ${live.live ? 1 : 0}`,
    '# HELP orca_http_requests_total HTTP requests by route.',
    '# TYPE orca_http_requests_total counter',
    ...[...HTTP_REQUESTS.entries()].map(([route, n]) => `orca_http_requests_total{route="${esc(route)}"} ${n}`),
    '# HELP orca_http_responses_total HTTP responses by route and status.',
    '# TYPE orca_http_responses_total counter',
    ...[...HTTP_RESPONSES.entries()].map(([route, n]) => `orca_http_responses_total{route="${esc(route)}"} ${n}`),
    '# HELP orca_http_latency_ms_sum Total and max request latency by route.',
    '# TYPE orca_http_latency_ms_sum summary',
    ...[...HTTP_LATENCY.entries()].flatMap(([route, agg]) => [
      `orca_http_latency_ms_sum{route="${esc(route)}"} ${agg.total}`,
      `orca_http_latency_ms_count{route="${esc(route)}"} ${agg.count}`,
    ]),
  ];
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

api.get('/status', (_req: Request, res: Response) => {
  ok(res, {
    version: VERSION,
    ai: geminiStatus(),
    counts: {
      agents: Object.keys(AGENT_REGISTRY).length,
      intents: ALL_INTENTS.length,
      languages: SUPPORTED_LANGUAGES.length,
      harbours: HARBORS.length,
      fishingZones: PFZ_ZONES.length,
      tideStations: Object.keys(TIDE_STATIONS).length,
      geofences: GEOFENCES.length,
      vesselProfiles: VESSEL_PROFILES.length,
      historicalRegions: HISTORICAL_REGIONS.length,
    },
    agents: Object.values(AGENT_REGISTRY),
    languages: SUPPORTED_LANGUAGES,
    dataCycle: liveStatusReport().live ? liveDataCycle() : DATA_CYCLE,
    live: liveStatusReport(),
    sessions: sessionCount(),
  });
});

api.get('/agents', (_req: Request, res: Response) => {
  ok(res, {
    agents: Object.values(AGENT_REGISTRY),
    /** Which specialists are wired up, as opposed to merely declared. */
    implemented: Object.values(AGENT_REGISTRY_IMPL).map((a) => a.type),
    intents: ALL_INTENTS.map((intent) => ({ intent, ...INTENT_CATALOG[intent] })),
  });
});

api.get('/languages', (_req: Request, res: Response) => {
  ok(res, SUPPORTED_LANGUAGES.map((l) => ({ ...l, speechTag: speechTagFor(l.code) })));
});

api.get('/harbors', (_req: Request, res: Response) => {
  ok(res, {
    harbours: HARBORS,
    vessels: VESSEL_PROFILES,
    defaultVessel: VESSEL_PROFILES.find((v) => v.id === 'motorized_dinghy')?.id,
  });
});

/**
 * The eight canonical capabilities from the problem statement, written as real
 * questions in eleven Indian languages. Fed through the same pipeline as user
 * input, so they double as a multilingual regression suite.
 */
api.get('/scenarios', (req: Request, res: Response) => {
  const language = asLanguage(req.query.language);
  const capability = typeof req.query.capability === 'string' ? req.query.capability : undefined;
  const scenarios = capability
    ? CANONICAL_SCENARIOS.filter((s) => s.capability === capability)
    : CANONICAL_SCENARIOS;
  ok(res, { language, count: scenarios.length, scenarios });
});

/* ------------------------------------------------------------------ *
 * Specialist data endpoints
 * ------------------------------------------------------------------ */

api.get('/pfz', asyncRoute(async (req: Request, res: Response) => {
  const limit = Math.min(20, Math.max(1, asNumber(req.query.limit) ?? 5));
  const withinKm = asNumber(req.query.withinKm);

  const anchor = resolveAnchor(req.query as Record<string, unknown>);
  await refreshLive(findNearestHarbor(anchor.latitude, anchor.longitude).id);

  const zones = getPfzZonesNear(anchor.latitude, anchor.longitude);
  const filtered = withinKm === undefined ? zones : zones.filter((z) => z.distanceKm <= withinKm);

  ok(res, {
    anchor,
    total: zones.length,
    withinRange: filtered.length,
    zones: filtered.slice(0, limit),
  });
}));

/** Chlorophyll / SST hotspot scan for the "where is fishable" question. */
api.get('/hotspots', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId);
  const harbor = HARBOR_BY_ID[harborId ?? HARBORS[0].id] ?? HARBORS[0];
  await refreshLive(harbor.id);

  const built = buildContext({
    query: 'which regions show high chlorophyll and favourable sea surface temperature',
    language: req.query.language,
    harborId: harbor.id,
    intent: 'PFZ_HOTSPOTS',
    memory: freshMemory(),
  });
  const results = runChain(built, ['PFZ_AGENT', 'VISUALIZATION_AGENT']);

  ok(res, {
    harbor: harbor.shortName,
    hotspots: built.artifacts.hotspots ?? [],
    visualizations: built.artifacts.visualizations ?? [],
    agentTrace: results.map((r) => ({ agent: r.agent, status: r.status, summary: r.summary })),
  });
}));

api.get('/weather', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId);
  const latitude = asNumber(req.query.lat ?? req.query.latitude);
  const longitude = asNumber(req.query.lon ?? req.query.longitude);

  const resolvedHarborId =
    harborId ??
    findNearestHarbor(latitude ?? HARBORS[0].latitude, longitude ?? HARBORS[0].longitude).id;
  await refreshLive(
    resolvedHarborId,
    latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
  );

  const data =
    harborId || latitude === undefined || longitude === undefined
      ? getWeather(harborId ?? HARBORS[0].id)
      : getWeatherNear(latitude, longitude);

  ok(res, {
    ...data,
    forecastDays: new Set(data.forecast.map((s) => s.date)).size,
    forecastSlots: data.forecast.length,
  });
}));

api.get('/ocean', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId);
  const latitude = asNumber(req.query.lat ?? req.query.latitude);
  const longitude = asNumber(req.query.lon ?? req.query.longitude);

  const resolvedHarborId =
    harborId ??
    findNearestHarbor(latitude ?? HARBORS[0].latitude, longitude ?? HARBORS[0].longitude).id;
  await refreshLive(
    resolvedHarborId,
    latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
  );

  // An explicit offshore coordinate matters: wave height grows with fetch, so
  // the harbour reading is not a valid proxy for the fishing ground.
  const data =
    latitude !== undefined && longitude !== undefined
      ? getOceanAt(latitude, longitude, harborId)
      : getOceanState(harborId ?? HARBORS[0].id);

  ok(res, data);
}));

api.get('/tides', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId) ?? HARBORS[0].id;
  const horizon = asHorizon(req.query.horizon, 'TODAY');
  await refreshLive(harborId);
  ok(res, buildTideReport(getTideStation(harborId), horizon));
}));

/* ------------------------------------------------------------------ *
 * Fleet intelligence — the whole coast on one screen
 * ------------------------------------------------------------------ */

/**
 * Coast-wide posture: one weighted risk snapshot per harbour, worst first,
 * computed by the same matrix the risk agent uses. Light enough for a command
 * view and always honest about which harbours degraded to the reference
 * snapshot (`reference: true`).
 */
api.get('/fleet', (req: Request, res: Response) => {
  ok(res, fleetOverview(asVesselId(req.query.vessel ?? req.query.vesselId)));
});

api.get('/alerts', asyncRoute(async (req: Request, res: Response) => {
  const withinKm = asNumber(req.query.withinKm) ?? 150;

  const anchor = resolveAnchor(req.query as Record<string, unknown>);
  await refreshLive(findNearestHarbor(anchor.latitude, anchor.longitude).id, anchor);

  const all = getMarineAlertsNear(anchor.latitude, anchor.longitude);
  const within = all.filter((a) => a.distanceKm <= withinKm);

  ok(res, {
    anchor,
    withinKm,
    /** Anything not GREEN and close enough to matter for a departure decision. */
    actionable: within.filter((a) => a.withinInfluence && a.advisoryLevel !== 'GREEN'),
    nearby: within,
    all,
  });
}));

/* ------------------------------------------------------------------ *
 * Geofencing
 * ------------------------------------------------------------------ */

/** Trimmed zone shape for the map: geometry plus the statutory text. */
function geofenceFeatures() {
  return GEOFENCES.map((z) => ({
    id: z.id,
    name: z.name,
    type: z.type,
    severity: z.severity,
    bufferKm: z.bufferKm,
    authority: z.authority,
    regulation: z.regulation,
    description: z.description,
    shape: z.shape,
    center: z.center,
    radiusKm: z.radiusKm,
    coordinates: z.coordinates,
  }));
}

api.get('/geofences', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId) ?? HARBORS[0].id;
  await refreshLive(harborId);
  const built = buildContext({
    query: 'which zones should I avoid',
    harborId,
    language: req.query.language,
    intent: 'AVOID_ZONES',
    memory: freshMemory(),
  });
  const [result] = runChain(built, ['GEOFENCING_AGENT']);

  ok(res, {
    zones: built.artifacts.geofencingData ?? { violations: [], nearbyBoundaries: [], warnings: [] },
    catalogue: geofenceFeatures(),
    findings: result?.findings ?? [],
  });
}));

/**
 * Point-and-corridor geofence check.
 *
 * Accepts either a single position or a planned track, because the question
 * "can I get from A to B" is answered by the corridor, not by the dock.
 */
api.post('/geofence/check', asyncRoute(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const rawTrack: unknown[] = Array.isArray(body.track) ? body.track : [];
  const points: Array<{ latitude: number; longitude: number }> = [];

  const latitude = asNumber(body.latitude ?? body.lat);
  const longitude = asNumber(body.longitude ?? body.lon ?? body.lng);
  if (latitude !== undefined && longitude !== undefined) {
    points.push({ latitude, longitude });
  }
  for (const p of rawTrack) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const la = asNumber(p[0]);
    const lo = asNumber(p[1]);
    if (la !== undefined && lo !== undefined) points.push({ latitude: la, longitude: lo });
  }

  if (points.length === 0) {
    return fail(res, 400, 'Provide latitude/longitude, or a track of [lat, lon] pairs.');
  }

  // Warm the live layer at the first scanned point so corridor advisories
  // reflect the real sea state along the route.
  await refreshLive(findNearestHarbor(points[0].latitude, points[0].longitude).id, points[0]);

  const isCorridor = points.length > 1;
  const built = buildContext({
    query: 'am I near any restricted water',
    language: body.language,
    harborId: body.harbor,
    latitude,
    longitude,
    intent: 'GEOFENCE_PROXIMITY',
    memory: freshMemory(),
    // Hand the track to the agent as the corridor it should scan. The
    // geofencing agent only reads `track` off the route, so that is all the
    // shape this needs to be.
    seedArtifacts: isCorridor
      ? {
          routeData: {
            track: points.map((p) => [p.latitude, p.longitude] as [number, number]),
          } as unknown as RouteData,
        }
      : undefined,
  });

  const [result] = runChain(built, ['GEOFENCING_AGENT']);

  ok(res, {
    mode: isCorridor ? 'corridor' : 'point',
    pointsScanned: points.length,
    ...(built.artifacts.geofencingData ?? { violations: [], nearbyBoundaries: [], warnings: [] }),
    findings: result?.findings ?? [],
  });
}));

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

api.get('/route', asyncRoute(async (req: Request, res: Response) => {
  const fromHarborId = asHarborId(req.query.from ?? req.query.origin) ?? HARBORS[0].id;
  const toHarborId = asHarborId(req.query.to ?? req.query.destination);
  const origin = HARBOR_BY_ID[fromHarborId] ?? HARBORS[0];
  await refreshLive(origin.id);

  // The destination may be a fishing-ground id, a harbour, or raw coordinates.
  const pfzId = typeof req.query.pfz === 'string' ? req.query.pfz.trim().toLowerCase() : undefined;
  const lat = asNumber(req.query.lat ?? req.query.latitude);
  const lon = asNumber(req.query.lon ?? req.query.longitude);

  let destinationZone = pfzId
    ? PFZ_ZONES.find((z) => z.id.toLowerCase() === pfzId)
    : undefined;

  if (!destinationZone && toHarborId) {
    const dest = HARBOR_BY_ID[toHarborId];
    destinationZone = getNearestPfz(dest.latitude, dest.longitude);
  }
  if (!destinationZone && lat !== undefined && lon !== undefined) {
    destinationZone = getNearestPfz(lat, lon);
  }
  destinationZone = destinationZone ?? getNearestPfz(origin.latitude, origin.longitude);

  const built = buildContext({
    // The synthetic utterance keeps the intent lexicon honest: this really is a
    // "safest route" question, so the planner and the critic see the same
    // wording a fisher would have typed.
    query: `safest route from ${origin.name} to ${destinationZone.name}`,
    harborId: origin.id,
    originHarborId: origin.id,
    vessel: req.query.vessel,
    language: asLanguage(req.query.language),
    intent: 'SAFE_ROUTE',
    horizon: asHorizon(req.query.horizon, 'TODAY'),
    memory: freshMemory({ activeHarborId: origin.id }),
    // The destination is already resolved, so the PFZ agent is not re-run.
    seedArtifacts: { activeZone: { ...destinationZone, distanceKm: 0, bearing: '' } },
  });

  // Weather, ocean, risk and visualisation must all run for the corridor to be
  // scored properly; the route agent reads the sea state it publishes.
  const results = runChain(built, [
    'OCEAN_AGENT',
    'WEATHER_AGENT',
    'ROUTE_OPTIMIZATION_AGENT',
    'GEOFENCING_AGENT',
    'RISK_VALIDATION_AGENT',
    'VISUALIZATION_AGENT',
  ]);

  const route = built.artifacts.routeData;
  if (!route) {
    return fail(res, 422, 'Route engine produced no corridor. Check the origin and destination.');
  }

  ok(res, {
    route,
    riskLevel: built.artifacts.riskLevel,
    safetyScore: built.artifacts.safetyScore,
    origin: {
      id: origin.id,
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    destination: {
      id: destinationZone.id,
      name: destinationZone.name,
      latitude: destinationZone.latitude,
      longitude: destinationZone.longitude,
      distanceKm: roundTo(haversineKm(origin, destinationZone), 1),
      bearing: formatBearing(initialBearingDeg(origin, destinationZone)),
    },
    vessel: built.context.vessel,
    geofencing: built.artifacts.geofencingData,
    agentTrace: results.map((r) => ({ agent: r.agent, status: r.status, summary: r.summary })),
    visualizations: built.artifacts.visualizations ?? [],
  });
}));

/* ------------------------------------------------------------------ *
 * Historical productivity diagnosis
 * ------------------------------------------------------------------ */

api.get('/historical', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId) ?? HARBORS[0].id;
  await refreshLive(harborId);
  const region = typeof req.query.region === 'string' && req.query.region.trim() ? req.query.region.trim() : undefined;
  const months = Math.min(60, Math.max(12, asNumber(req.query.months) ?? 36));

  if (region) {
    // Raw-series mode for analysts: numbers only, no diagnosis.
    return ok(res, {
      region,
      months,
      series: getHistoricalSeries(region, months),
      regions: HISTORICAL_REGIONS,
    });
  }

  const built = buildContext({
    query: 'why has fish productivity declined in my harbour',
    harborId,
    language: req.query.language,
    intent: 'PRODUCTIVITY_DIAGNOSIS',
    memory: freshMemory(),
  });
  const [result] = runChain(built, ['HISTORICAL_ANALYSIS_AGENT', 'VISUALIZATION_AGENT']);

  const diagnosis = built.artifacts.historicalData;
  if (!diagnosis) return fail(res, 422, 'Historical analysis produced no result.');

  ok(res, {
    diagnosis,
    findings: result?.findings ?? [],
    visualizations: built.artifacts.visualizations ?? [],
  });
}));

/* ------------------------------------------------------------------ *
 * Map bundle — one request, every layer the map screen needs
 * ------------------------------------------------------------------ */

api.get('/map-data', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId) ?? HARBORS[0].id;
  const harbor = HARBOR_BY_ID[harborId] ?? HARBORS[0];
  await refreshLive(harbor.id);

  const built = buildContext({
    query: 'show me the marine picture around this harbour',
    harborId: harbor.id,
    language: req.query.language,
    intent: 'AVOID_ZONES',
    memory: freshMemory(),
  });

  // Order matters: the route agent needs the fishing ground the PFZ agent
  // found, and the geofencing agent needs the route to scan its corridor.
  const results = runChain(built, [
    'PFZ_AGENT',
    'OCEAN_AGENT',
    'WEATHER_AGENT',
    'ROUTE_OPTIMIZATION_AGENT',
    'GEOFENCING_AGENT',
    'MARINE_ALERT_AGENT',
    'RISK_VALIDATION_AGENT',
    'VISUALIZATION_AGENT',
  ]);

  // The map's hotspot overlay comes from the PFZ agent's grid collapse. The
  // live cell cache is already warm from the harbour refresh, so this second,
  // focused pass adds no network cost and keeps the overlay consistent with
  // what the chat agents claim about productivity.
  const hotspotCtx = buildContext({
    query: 'which regions show high chlorophyll and favourable sea surface temperature',
    language: req.query.language,
    harborId: harbor.id,
    intent: 'PFZ_HOTSPOTS',
    memory: freshMemory(),
  });
  runChain(hotspotCtx, ['PFZ_AGENT']);

  ok(res, {
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
    fishingZones: (built.artifacts.pfzZones ?? getPfzZonesNear(harbor.latitude, harbor.longitude)).slice(0, 6),
    activeZone: built.artifacts.activeZone,
    // Alert copy is rendered per-language from structured params where present
    // (imported/quoted advisories keep their verbatim text).
    alerts: (built.artifacts.alerts ?? []).map((a) =>
      applyAlertLocalization(a, getPhrasebook(asLanguage(req.query.language))),
    ),
    geofences: geofenceFeatures(),
    geofencing: built.artifacts.geofencingData,
    route: built.artifacts.routeData,
    weather: built.artifacts.weather,
    ocean: built.artifacts.ocean,
    hotspots: hotspotCtx.artifacts.hotspots ?? [],
    dataCycle: liveStatusReport().live ? liveDataCycle() : DATA_CYCLE,
    riskLevel: built.artifacts.riskLevel ?? 'LOW',
    safetyScore: built.artifacts.safetyScore,
    visualizations: built.artifacts.visualizations ?? [],
    agentTrace: results.map((r) => ({ agent: r.agent, status: r.status, summary: r.summary })),
  });
}));

/* ------------------------------------------------------------------ *
 * Conversation
 * ------------------------------------------------------------------ */

interface ChatRequestBody {
  message?: unknown;
  question?: unknown;
  language?: unknown;
  sessionId?: unknown;
  harbor?: unknown;
  harborId?: unknown;
  vessel?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

/* ------------------------------------------------------------------ *
 * Chat rate limiting
 * ------------------------------------------------------------------ */
const RATE_WINDOW_MS = Math.max(1_000, Number(process.env.ORCA_RATE_WINDOW_MS ?? 60_000));
const RATE_MAX = Math.max(1, Number(process.env.ORCA_RATE_MAX ?? 120));
const RATE_HITS = new Map<string, { count: number; resetAt: number }>();

/** Sliding-window per-IP throttle for the chat endpoints only. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hit = RATE_HITS.get(ip) ?? { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (hit.resetAt <= now) {
    hit.count = 0;
    hit.resetAt = now + RATE_WINDOW_MS;
  }
  hit.count += 1;
  if (hit.count > RATE_MAX) {
    // Keep the entry so the whole window stays throttled, not just this call.
    RATE_HITS.set(ip, hit);
    return true;
  }
  RATE_HITS.set(ip, hit);
  // Opportunistic sweep so the map itself can never grow without bound.
  if (RATE_HITS.size > RATE_MAX * 50) {
    for (const [k, v] of RATE_HITS) if (v.resetAt <= now) RATE_HITS.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  // `req.ip` honours the `trust proxy` setting (`ORCA_TRUST_PROXY=1` behind a
  // reverse proxy); otherwise it is the socket address, which cannot be spoofed
  // by an X-Forwarded-For header.
  return req.ip?.replace(/^::ffff:/, '') || req.socket?.remoteAddress?.replace(/^::ffff:/, '') || 'unknown';
}

api.post('/chat', asyncRoute(async (req: Request, res: Response) => {
  if (isRateLimited(clientIp(req))) return fail(res, 429, 'Too many requests — retry shortly');

  const body = (req.body ?? {}) as ChatRequestBody;
  const question = String(body.message ?? body.question ?? '').trim();

  if (!question) return fail(res, 400, 'message is required');

  const language = asLanguage(body.language);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  const memory = readMemory(sessionId);

  const harborId = asHarborId(body.harbor ?? body.harborId);
  const latitude = asNumber(body.latitude);
  const longitude = asNumber(body.longitude);

  // A GPS fix is the best available anchor: resolve it to the nearest harbour
  // and use that as the reference point for the whole turn.
  let resolvedHarborId = harborId;
  if (!resolvedHarborId && latitude !== undefined && longitude !== undefined) {
    resolvedHarborId = findNearestHarbor(latitude, longitude).id;
  }
  if (resolvedHarborId) memory.activeHarborId = resolvedHarborId;
  if (typeof body.vessel === 'string' && body.vessel.trim()) memory.lastVesselType = body.vessel.trim();

  const position =
    latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : undefined;

  try {
    const { result, memory: nextMemory } = await orchestrate(question, {
      preferredLanguage: language,
      memory,
      gemini: geminiBridge,
      harborId: resolvedHarborId,
      position,
    });

    writeMemory(sessionId, nextMemory);

    res.json({
      status: 'success',
      apiVersion: DOMAIN_MODEL_VERSION,
      session_id: sessionId ?? null,
      language: result.detectedLanguage,
      result,
      disclaimer: result.disclaimer,
      timestamp: result.timestamp,
    });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Orchestration failed');
  }
}));

/**
 * Streaming conversation endpoint.
 *
 * Every `OrchestratorEvent` becomes one SSE frame, so the client can show the
 * plan, each agent's findings, the collaboration requests, the risk verdict
 * and the safety critique as they happen. The terminal `done` frame carries the
 * same `OrchestrationResult` `/api/chat` would have returned — the streaming
 * path is the same code path, not a parallel implementation.
 */
api.post('/chat/stream', asyncRoute(async (req: Request, res: Response) => {
  if (isRateLimited(clientIp(req))) {
    res.status(429).json({ status: 'error', error: 'Too many requests — retry shortly' });
    return;
  }

  const body = (req.body ?? {}) as ChatRequestBody;
  const question = String(body.message ?? body.question ?? '').trim();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Defeats response buffering in nginx-style reverse proxies.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  // Keep-alive: some coastal 3G and proxy chains silently close an idle SSE
  // response, so whisper a comment frame every 15 s while the agents work.
  heartbeat = setInterval(() => {
    if (closed || res.writableEnded) return;
    res.write(': ping\n\n');
  }, 15_000);
  // Immunity: no single turn may stream forever.
  deadline = setTimeout(() => {
    if (!closed && !res.writableEnded) res.end();
  }, 5 * 60_000);

  const dispose = (): void => {
    if (heartbeat) clearInterval(heartbeat);
    if (deadline) clearTimeout(deadline);
  };
  const unrefTimer = (timer: unknown): void => {
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as { unref: () => unknown }).unref();
    }
  };
  unrefTimer(heartbeat);
  unrefTimer(deadline);

  const onClose = () => {
    closed = true;
    dispose();
  };
  // Watch the *response*, not the request. For a small POST the request body is
  // fully buffered almost immediately, so `req 'close'` fires right after the
  // first frame and makes every later SSE frame appear to be "disconnected" —
  // the client then sees a stream with no `done` frame and falls back offline.
  res.on('close', onClose);
  req.on('aborted', onClose);

  const send = (event: OrchestratorEvent): void => {
    if (closed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  if (!question) {
    send({ type: 'error', message: 'message is required' });
    res.end();
    return;
  }

  const language = asLanguage(body.language);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  const memory = readMemory(sessionId);

  const harborId = asHarborId(body.harbor ?? body.harborId);
  const latitude = asNumber(body.latitude);
  const longitude = asNumber(body.longitude);

  let resolvedHarborId = harborId;
  if (!resolvedHarborId && latitude !== undefined && longitude !== undefined) {
    resolvedHarborId = findNearestHarbor(latitude, longitude).id;
  }
  if (resolvedHarborId) memory.activeHarborId = resolvedHarborId;

  try {
    // The full result already reached the client on the `done` event, so only
    // the updated memory is needed from here.
    const { memory: nextMemory } = await orchestrate(question, {
      preferredLanguage: language,
      memory,
      gemini: geminiBridge,
      harborId: resolvedHarborId,
      position:
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined,
      onEvent: send,
    });
    writeMemory(sessionId, nextMemory);
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Orchestration failed' });
  } finally {
    dispose();
    res.removeListener('close', onClose);
    req.removeListener('aborted', onClose);
    if (!res.writableEnded) res.end();
  }
}));

/* ------------------------------------------------------------------ *
 * Proactive briefing — the alert banner and the home card
 * ------------------------------------------------------------------ */

api.get('/situation', asyncRoute(async (req: Request, res: Response) => {
  const harborId = asHarborId(req.query.harbor ?? req.query.harborId) ?? HARBORS[0].id;
  const language = asLanguage(req.query.language);

  try {
    const result = await buildSituationReport(harborId, language);
    res.json({
      status: 'success',
      // `brief` is the render-ready summary; `result` is the full trace for the
      // detail sheet, so the banner can render without parsing the whole thing.
      data: summariseForBanner(result),
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Situation report failed');
  }
}));

/**
 * Compact, render-ready shape for the home screen and the alert banner.
 *
 * Shipping the whole `OrchestrationResult` here would be wasteful on a poor
 * coastal 3G link; this is the part a fisher needs before deciding whether to
 * go out at all.
 */
function summariseForBanner(result: OrchestrationResult): Record<string, unknown> {
  const book = getPhrasebook(result.detectedLanguage);

  const headlineAlert = pickHeadlineAlert(result.marineAlerts);

  const zone = result.pfzZone;
  const weather = result.weatherData;
  const ocean = result.oceanData;
  const tide = result.tideReport;
  const geofencing = result.geofencingData;

  return {
    language: result.detectedLanguage,
    riskLevel: result.riskLevel,
    riskLabel: book.riskWords[RISK_ORDER[result.riskLevel]],
    safetyScore: result.safetyScore,
    // Rendered through the same helper the answer's first line uses, so the
    // banner and the chat answer can never disagree about what was asked.
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
    alert: headlineAlert
      ? {
          id: headlineAlert.id,
          type: headlineAlert.type,
          title: headlineAlert.title,
          advisoryLevel: headlineAlert.advisoryLevel,
          severity: headlineAlert.severity,
          distanceKm: headlineAlert.distanceKm,
          bearing: headlineAlert.bearing,
          action: headlineAlert.action,
          validUntil: headlineAlert.validUntil,
          source: headlineAlert.source,
          // Rebuild copy from the alert's structured params in the active
          // language when available; imported/quoted alerts stay verbatim.
          ...localizeAlertText(headlineAlert, book),
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
    weather: weather
      ? {
          windKnots: weather.windSpeedKnots,
          windDirection: weather.windDirection,
          gustKnots: weather.gustKnots,
          visibilityKm: weather.visibilityKm,
          rainProbability: weather.rainProbability,
          lightningRisk: weather.lightningRisk,
          condition: localizeCondition(weather.condition, book),
          squallWarning: weather.squallWarning,
        }
      : null,
    ocean: ocean
      ? {
          waveHeightMeters: ocean.waveHeightMeters,
          wavePeriodSeconds: ocean.wavePeriodSeconds,
          seaCondition: ocean.seaCondition,
          sstCelsius: ocean.seaSurfaceTempCelsius,
          swellDirection: ocean.swellDirection,
          currentKnots: ocean.currentKnots,
        }
      : null,
    tide: tide
      ? {
          currentLevelMeters: tide.currentLevel,
          isRising: tide.isRising,
          rangeMeters: tide.maxRangeMeters,
          nextEvent: tide.events?.[0],
          recommendedWindow: tide.recommendedWindow
            ? {
                ...tide.recommendedWindow,
                reason: localizeTideReason(tide.recommendedWindow.reason, book),
              }
            : tide.recommendedWindow,
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
    sources: result.sources.map((s) => localizeSource(s, book)),
    disclaimer: result.disclaimer,
    timestamp: result.timestamp,
  };
}

/* ------------------------------------------------------------------ *
 * Session control
 * ------------------------------------------------------------------ */

api.post('/session/reset', (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;
  resetMemory(sessionId);
  ok(res, { sessionId: sessionId ?? null, memory: freshMemory() });
});

/* ------------------------------------------------------------------ *
 * API not-found — anything under /api that matched no route gets a JSON
 * 404 in the same envelope as every other response, never Express's
 * default HTML page. (Unknown *non-API* paths are the SPA's job.)
 * ------------------------------------------------------------------ */

api.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    apiVersion: DOMAIN_MODEL_VERSION,
    error: 'Not found',
    timestamp: new Date().toISOString(),
  });
});
