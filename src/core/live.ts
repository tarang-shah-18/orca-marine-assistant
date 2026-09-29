/**
 * ORCA live intelligence layer.
 *
 * Every request path — dashboards, chat, map, data endpoints — warms an
 * in-memory snapshot for the active harbour by fetching real-time data from
 * public, authoritative sources and building the SAME domain products the
 * deterministic engine consumes. If a source cannot be reached, the product
 * falls back to the reference snapshot in `core/dataset.ts` and is flagged
 * `live: false`, so the UI and the safety disclaimer stay honest and the
 * platform keeps working with no network and no API keys, exactly as the
 * problem statement requires.
 *
 * Live sources (all public, no key required):
 *   - Open-Meteo Forecast API (ECMWF IFS atmospheric)    → wind, gusts, temp,
 *     precipitation, weather-code, visibility, cloud
 *   - Open-Meteo Marine API (WaveWatch-III + ocean model) → waves, swell, SST,
 *     ocean currents
 *   - Open-Meteo Archive API (ERA5 reanalysis by ECMWF)  → 36-month
 *     SST / wind / rainfall series for the productivity diagnosis
 *   - GDACS (UN / European Commission) RSS               → real-time cyclone and
 *     disaster events near the Indian coast
 *   - MODIS-Aqua regional ocean-colour climatology       → satellite chlorophyll
 *     seasonality blended with the live SST/current field
 *   - ORCA harmonic tide model                            → astronomical tide
 *     prediction (published constituent sets, no fabrication)
 *
 * This module is deliberately dependency-free (fetch + AbortController only),
 * so it can run identically in the Node server and inside the offline browser
 * bundle of `orcaApi.ts`.
 */

import {
  AdvisoryLevel,
  AlertSeverity,
  AlertType,
  HistoricalPoint,
  MarineAlert,
  OceanData,
  OceanSlot,
  PFZZone,
  ProductivityHotspot,
  WeatherData,
  WeatherSlot,
} from '../types';
import {
  HARBOR_BY_ID,
  HARBORS,
  PFZ_ZONES,
  REGION_PROFILES_FOR_HISTORY,
  classifyProductivity,
  computeProductivityIndex,
  describeSeaState,
  findNearestHarbor,
} from './dataset';
import type { LatLon } from './geo';
import { haversineKm, initialBearingDeg, compassPoint, roundTo, knotsToKmph } from './geo';

/* ------------------------------------------------------------------ *
 * Fetch helper (browser + Node 18+)
 * ------------------------------------------------------------------ */

const FETCH_TIMEOUT_MS = 12000;

/** Tunable from the environment; this module also ships to the browser bundle. */
function envMs(name: string, fallback: number): number {
  const raw = typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Open-Meteo throttles by request volume; a 429 must trigger a real back-off. */
class UpstreamRateLimit extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`HTTP 429 (rate limited${retryAfterMs ? `, retry after ${Math.round(retryAfterMs / 1000)}s` : ''})`);
    this.name = 'UpstreamRateLimit';
  }
}

async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const seconds = header ? Number(header) : NaN;
      throw new UpstreamRateLimit(Number.isFinite(seconds) ? seconds * 1000 : 0);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Upstream failure memory
 *
 * A feed that stops answering must never be silent. The status report already
 * says "reference, not live", which is honest but not actionable: an operator
 * needs to know *why* the live layer is missing. The last failure reason per
 * product is kept here (bounded, no payloads) and surfaced on /api/status.
 * ------------------------------------------------------------------ */

const UPSTREAM_FAILURES = new Map<string, { at: string; reason: string }>();
const MAX_TRACKED_PRODUCTS = 12;

/**
 * Rate-limit back-off. Open-Meteo answers 429 by request volume, and every
 * route refreshes on demand, so retrying on the next request only deepens the
 * throttle. A 429 therefore parks that product for a cooling-off window (the
 * upstream's own `Retry-After` when it sends one) instead of hammering it; the
 * product honestly serves its labelled reference snapshot meanwhile and goes
 * live again by itself once the window passes.
 */
const RATE_LIMIT_COOLDOWN_MS = envMs('ORCA_RATE_LIMIT_COOLDOWN_MS', 15 * 60 * 1000);
/**
 * Cadence for a feed that answered but could not be built (an upstream with no
 * model coverage for the point, a schema change). Retried often enough to pick
 * up a recovered feed, rarely enough not to hammer the upstream every request.
 */
const NO_DATA_RETRY_MS = envMs('ORCA_NO_DATA_RETRY_MS', 10 * 60 * 1000);
// Two independent windows: a throttled feed waits out the upstream's rate-limit
// window, while a feed that answered but could not be built merely waits for
// its own retry cadence. They must not overwrite each other.
const RATE_LIMITED_UNTIL = new Map<string, number>();
const NO_DATA_UNTIL = new Map<string, number>();

function coolingDown(product: string): boolean {
  const until = Math.max(RATE_LIMITED_UNTIL.get(product) ?? 0, NO_DATA_UNTIL.get(product) ?? 0);
  return until > Date.now();
}

function markRateLimited(product: string, retryAfterMs: number): void {
  RATE_LIMITED_UNTIL.set(product, Date.now() + Math.max(RATE_LIMIT_COOLDOWN_MS, retryAfterMs || 0));
  NO_DATA_UNTIL.delete(product);
}

function describeError(reason: unknown): string {
  if (reason instanceof Error) {
    // An aborted fetch surfaces as a bare AbortError; name the real cause.
    if (reason.name === 'AbortError' || reason.name === 'TimeoutError') {
      return `timed out after ${FETCH_TIMEOUT_MS} ms`;
    }
    return `${reason.name}: ${reason.message}`;
  }
  return String(reason).slice(0, 200);
}

function recordUpstreamOutcome(
  product: string,
  ok: boolean,
  reason?: string,
  extendCooldown = true,
): void {
  if (ok) {
    UPSTREAM_FAILURES.delete(product);
    RATE_LIMITED_UNTIL.delete(product);
    NO_DATA_UNTIL.delete(product);
    return;
  }
  if (UPSTREAM_FAILURES.size >= MAX_TRACKED_PRODUCTS) {
    const oldest = UPSTREAM_FAILURES.keys().next().value;
    if (oldest !== undefined) UPSTREAM_FAILURES.delete(oldest);
  }
  UPSTREAM_FAILURES.set(product, { at: new Date().toISOString(), reason: reason ?? 'unknown' });
  if (!extendCooldown) return;
  // Extend, never shorten, within this window only: an active rate-limit
  // window is tracked separately and must not be cut short here.
  const until = Date.now() + NO_DATA_RETRY_MS;
  if ((NO_DATA_UNTIL.get(product) ?? 0) < until) NO_DATA_UNTIL.set(product, until);
}

/**
 * True when a product has failed but its back-off has lapsed, so the next
 * request should retry it instead of serving the cached snapshot. This is what
 * lets a rate-limited feed recover on its own while the snapshot TTL holds.
 */
function retryableUpstream(): boolean {
  for (const product of UPSTREAM_FAILURES.keys()) {
    if (!coolingDown(product)) return true;
  }
  return false;
}

/**
 * One upstream call, honouring the back-off. Never throws: a failure is
 * recorded and reported as `null` so the caller degrades to reference data.
 */
async function fetchUpstream(product: string, url: string): Promise<any | null> {
  if (coolingDown(product)) {
    const until = Math.max(RATE_LIMITED_UNTIL.get(product) ?? 0, NO_DATA_UNTIL.get(product) ?? 0);
    const mins = Math.ceil((until - Date.now()) / 60000);
    // Report the standing back-off without extending it, or every skipped
    // request would push the window further out and it would never lapse.
    recordUpstreamOutcome(product, false, `rate limited — retrying in ~${mins} min`, false);
    return null;
  }
  try {
    const payload = await fetchJson(url);
    return payload ?? null;
  } catch (err) {
    if (err instanceof UpstreamRateLimit) {
      // The rate-limit window is the back-off here; do not also arm the
      // no-data retry cadence, which would outlive the throttle it caused.
      markRateLimited(product, err.retryAfterMs);
      recordUpstreamOutcome(product, false, describeError(err), false);
      return null;
    }
    recordUpstreamOutcome(product, false, describeError(err));
    return null;
  }
}

/** Last failure reason per product, for the ops surface. Empty when all is well. */
export function upstreamFailures(): Record<string, { at: string; reason: string }> {
  return Object.fromEntries(UPSTREAM_FAILURES);
}

/* ------------------------------------------------------------------ *
 * Snapshot model
 * ------------------------------------------------------------------ */

export type LiveProduct =
  | 'weather'
  | 'ocean'
  | 'pfz'
  | 'hotspots'
  | 'alerts'
  | 'historical'
  | 'disasters';

export interface ProductStatus {
  product: LiveProduct;
  live: boolean;
  source: string;
  fetchedAt: string | null;
}

export interface LiveSnapshot {
  harborId: string;
  /** Coordinate the real-time feeds were fetched at. */
  position: LatLon;
  fetchedAt: number;
  weather: WeatherData | null;
  ocean: OceanData | null;
  /** Live-recomputed fishing grounds (no distance/bearing; joined per anchor). */
  pfzZones: Array<Omit<PFZZone, 'distanceKm' | 'bearing'>> | null;
  hotspots: ProductivityHotspot[] | null;
  /** Derived + GDACS alerts (no distance/bearing; joined per anchor). */
  alerts: MarineAlert[] | null;
  historical: Map<string, HistoricalPoint[]> | null;
  statuses: Record<LiveProduct, boolean>;
}

const SNAPSHOTS = new Map<string, LiveSnapshot>();
const IN_FLIGHT = new Map<string, Promise<void>>();

const TTL_MS = 12 * 60 * 1000;
const FORECAST_DAYS = 3;

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const compass16 = (deg: number): string =>
  COMPASS_16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/* ------------------------------------------------------------------ *
 * WMO weather-code → human condition
 * ------------------------------------------------------------------ */

function conditionFromCode(code: number): string {
  if (code === 0) return 'Clear sky, excellent visibility';
  if (code <= 2) return 'Partly cloudy, mostly settled';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog / mist reducing visibility';
  if (code >= 51 && code <= 57) return 'Drizzle or light rain patches';
  if (code >= 61 && code <= 67) return 'Rain periods, reduced visibility';
  if (code >= 71 && code <= 77) return 'Snow or sleet (high altitude)';
  if (code >= 80 && code <= 82) return 'Rain showers, squally in gusts';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorm with lightning risk';
  if (code === 96 || code === 99) return 'Thunderstorm with hail, lightning risk';
  return 'Variable cloud, moderate sea state';
}

function lightningRiskFrom(code: number, rainProb: number, windKnots: number): WeatherSlot['lightningRisk'] {
  if (code >= 95) return 'HIGH';
  if (code >= 80 || rainProb >= 60 || windKnots >= 22) return 'MODERATE';
  return 'LOW';
}



/* ------------------------------------------------------------------ *
 * Weather — Open-Meteo Forecast API (ECMWF IFS)
 * ------------------------------------------------------------------ */

interface ForecastHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  cloud_cover: number[];
  visibility?: number[];
}

function buildWeather(
  harborId: string,
  harborName: string,
  hourly: ForecastHourly,
  fetchedAt: string,
): WeatherData | null {
  if (!hourly?.time?.length) return null;

  // Same rule as the marine builder: an upstream block that is present but
  // empty (every value `null`) is not data. Averaging it as zero would invent
  // a dead-calm, zero-visibility forecast — the most dangerous thing this
  // product could invent for a fisher.
  if (!hourly.wind_speed_10m?.some((v) => typeof v === 'number')) return null;

  const periods: Array<WeatherSlot['period']> = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  // Local-time hour floor at which each period starts.
  const periodStart: Record<WeatherSlot['period'], number> = {
    MORNING: 6,
    AFTERNOON: 12,
    EVENING: 18,
    NIGHT: 0,
  };
  const hours = hourly.time.map((t) => new Date(t).getHours());
  const localLabel = hourly.time[0];

  const slots: WeatherSlot[] = [];
  for (let day = 0; day < FORECAST_DAYS; day++) {
    for (const period of periods) {
      const start = day * 24 + periodStart[period];
      const end = start + 6;
      const idx: number[] = [];
      let firstHour = -1;
      for (let h = start; h < end && h < hours.length; h++) {
        idx.push(h);
        if (firstHour < 0) firstHour = hours[h];
      }
      if (idx.length === 0) continue;

      // Skip hours the model left empty rather than counting them as zeros,
      // which would under-report wind, rain and visibility.
      const values = (pick: number[] | undefined): number[] =>
        idx.map((i) => pick?.[i]).filter((v): v is number => typeof v === 'number');

      const seriesMean = (pick: number[] | undefined): number => {
        const all = (pick ?? []).filter((v): v is number => typeof v === 'number');
        return all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0;
      };

      const avg = (pick: number[] | undefined): number => {
        const vals = values(pick);
        return vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : seriesMean(pick);
      };
      const max = (pick: number[] | undefined): number => {
        const vals = values(pick);
        return vals.length ? Math.max(...vals) : seriesMean(pick);
      };

      const windSpeedKnots = Math.round(avg(hourly.wind_speed_10m));
      const gustKnots = Math.round(max(hourly.wind_gusts_10m));
      const rainProbability = Math.round(max(hourly.precipitation_probability));
      const code = Math.round(max(hourly.weather_code));
      // Visibility from the window's model output (hourly, metres).
      const visibilityM = hourly.visibility ? avg(hourly.visibility) : 8000;

      const date = localLabel.slice(0, 10);
      slots.push({
        date,
        label: `${date} · ${String(firstHour).padStart(2, '0')}:00`,
        validHours: day * 24 + periodStart[period],
        period,
        temperatureCelsius: roundTo(avg(hourly.temperature_2m), 1),
        windSpeedKnots,
        windSpeedKmph: Math.round(knotsToKmph(windSpeedKnots)),
        windDirection: compass16(avg(hourly.wind_direction_10m)),
        windDirectionDeg: Math.round(avg(hourly.wind_direction_10m)),
        gustKnots,
        visibilityKm: roundTo(Math.max(0.3, visibilityM / 1000), 1),
        rainProbability,
        lightningRisk: lightningRiskFrom(code, rainProbability, windSpeedKnots),
        condition: conditionFromCode(code),
      });
    }
  }
  if (slots.length === 0) return null;

  const current = slots[0];
  const maxWindToday = Math.max(...slots.slice(0, 4).map((s) => s.windSpeedKnots));
  const maxGustToday = Math.max(...slots.slice(0, 4).map((s) => s.gustKnots));

  return {
    locationId: harborId,
    locationName: harborName,
    temperatureCelsius: current.temperatureCelsius,
    windSpeedKnots: current.windSpeedKnots,
    windSpeedKmph: current.windSpeedKmph,
    windDirection: current.windDirection,
    windDirectionDeg: current.windDirectionDeg,
    gustKnots: current.gustKnots,
    visibilityKm: current.visibilityKm,
    rainProbability: current.rainProbability,
    lightningRisk: current.lightningRisk,
    condition: current.condition,
    squallWarning: maxGustToday >= 28 || maxWindToday >= 33,
    source:
      'Open-Meteo Forecast API (ECMWF IFS HRES) — real-time atmospheric model',
    timestamp: fetchedAt,
    forecast: slots,
  };
}

/* ------------------------------------------------------------------ *
 * Ocean — Open-Meteo Marine API (WaveWatch-III / ocean model)
 * ------------------------------------------------------------------ */

interface MarineHourly {
  time: string[];
  wave_height: number[];
  wave_direction: number[];
  wave_period: number[];
  wind_wave_height: number[];
  swell_wave_height: number[];
  swell_wave_direction: number[];
  sea_surface_temperature: number[];
  ocean_current_velocity: number[];
  ocean_current_direction: number[];
}

const MPS_TO_KNOTS = 1.94384;

export function buildOcean(
  harborId: string,
  harborName: string,
  hourly: MarineHourly,
  sstClimatology: number,
  fetchedAt: string,
): OceanData | null {
  if (!hourly?.time?.length) return null;

  // Open-Meteo answers with a well-formed hourly block whose every value is
  // `null` when its marine model has no grid cell covering the point (Digha
  // sits just inside the Bay of Bengal model edge and does this). Averaging
  // those nulls as `?? 0` would yield a confident-looking 0 m wave height and
  // 0 °C SST still stamped "real-time sea state" — the one thing a fisher must
  // never be shown. If nothing usable came back, report no live data so the
  // caller falls back to the labelled reference snapshot instead.
  if (!hourly.wave_height?.some((v) => typeof v === 'number')) return null;

  const periods: Array<OceanSlot['period']> = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  const periodStart: Record<OceanSlot['period'], number> = {
    MORNING: 6,
    AFTERNOON: 12,
    EVENING: 18,
    NIGHT: 0,
  };
  const hours = hourly.time.map((t) => new Date(t).getHours());

  const slots: OceanSlot[] = [];
  for (let day = 0; day < FORECAST_DAYS; day++) {
    for (const period of periods) {
      const start = day * 24 + periodStart[period];
      const end = start + 6;
      const idx: number[] = [];
      let firstHour = -1;
      for (let h = start; h < end && h < hours.length; h++) {
        idx.push(h);
        if (firstHour < 0) firstHour = hours[h];
      }
      if (idx.length === 0) continue;

      // Skip hours the model left empty rather than counting them as zeros,
      // which would under-report the sea state. A window with no usable hour
      // at all inherits the series mean rather than inventing a calm sea.
      const values = (pick: number[] | undefined): number[] =>
        idx.map((i) => pick?.[i]).filter((v): v is number => typeof v === 'number');

      const seriesMean = (pick: number[] | undefined): number => {
        const all = (pick ?? []).filter((v): v is number => typeof v === 'number');
        return all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0;
      };

      const avg = (pick: number[] | undefined): number => {
        const vals = values(pick);
        return roundTo(vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : seriesMean(pick), 1);
      };
      const max = (pick: number[] | undefined): number => {
        const vals = values(pick);
        return roundTo(vals.length ? Math.max(...vals) : seriesMean(pick), 1);
      };

      const waveHeightMeters = max(hourly.wave_height);
      const sea = describeSeaState(waveHeightMeters);

      slots.push({
        date: hourly.time[start].slice(0, 10),
        label: `${hourly.time[start].slice(0, 10)} · ${String(firstHour).padStart(2, '0')}:00`,
        validHours: day * 24 + periodStart[period],
        period,
        waveHeightMeters,
        wavePeriodSeconds: avg(hourly.wave_period),
        swellDirection: compass16(avg(hourly.swell_wave_direction)),
        swellDirectionDeg: Math.round(avg(hourly.swell_wave_direction)),
        seaSurfaceTempCelsius: avg(hourly.sea_surface_temperature),
        currentKnots: roundTo(avg(hourly.ocean_current_velocity) * MPS_TO_KNOTS, 1),
        currentDirection: compass16(avg(hourly.ocean_current_direction)),
        seaStateCode: sea.code,
        seaCondition: sea.text,
      });
    }
  }
  if (slots.length === 0) return null;

  const current = slots[0];
  const sstCurrent = current.seaSurfaceTempCelsius;
  const sstAnomaly = roundTo(sstCurrent - sstClimatology, 2);

  return {
    locationId: harborId,
    locationName: harborName,
    waveHeightMeters: current.waveHeightMeters,
    wavePeriodSeconds: current.wavePeriodSeconds,
    swellDirection: current.swellDirection,
    swellDirectionDeg: current.swellDirectionDeg,
    seaSurfaceTempCelsius: sstCurrent,
    sstAnomalyC: sstAnomaly,
    currentKnots: current.currentKnots,
    currentDirection: current.currentDirection,
    seaStateCode: current.seaStateCode,
    seaCondition: current.seaCondition,
    source:
      'Open-Meteo Marine API (WaveWatch-III & ocean circulation model) — real-time sea state',
    timestamp: fetchedAt,
    forecast: slots,
  };
}

/* ------------------------------------------------------------------ *
 * PFZ grounds — live SST/currents at each advisory ground + MODIS
 * climatology chlorophyll. (Deterministic, harbour-centred, cacheable.)
 * ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Regional MODIS-Aqua ocean-colour seasonality (coastal, mg/m³), indexed per region. */
const CHL_SEASONALITY: Record<string, number[]> = {
  Konkan: [1.35, 1.2, 0.95, 0.75, 0.7, 1.15, 1.9, 2.2, 2.35, 2.1, 1.7, 1.45],
  Saurashtra: [2.1, 1.9, 1.6, 1.3, 1.15, 1.7, 2.6, 3.05, 3.2, 2.8, 2.4, 2.2],
  'Malabar Coast': [1.0, 0.9, 0.75, 0.6, 0.65, 1.1, 1.85, 2.1, 2.2, 1.95, 1.55, 1.25],
  'Coromandel Coast': [1.4, 1.32, 1.2, 1.05, 0.95, 1.3, 1.9, 2.1, 2.2, 2.0, 1.7, 1.45],
  'Andhra Coast': [1.0, 0.95, 0.9, 0.8, 0.75, 1.05, 1.7, 1.95, 2.05, 1.85, 1.5, 1.2],
  'Sundarbans Coast': [2.5, 2.4, 2.25, 2.1, 2.2, 2.9, 3.8, 4.1, 4.2, 3.7, 3.1, 2.7],
};

interface PointOcean {
  /**
   * A field is absent when the marine model has no cell for that point. It is
   * never filled in with a zero: callers already branch on `typeof … ===
   * 'number'`, and a fabricated 0 m wave would read as a dead-flat sea.
   */
  sst?: number;
  wave?: number;
  currentKnots?: number;
}

/** Per-coordinate cache so harbour switches do not re-fetch the same cells. */
const POINT_CACHE = new Map<string, { fetchedAt: number; value: PointOcean }>();
const POINT_TTL_MS = 30 * 60 * 1000;
/** Coordinates per request; keeps the URL well inside any length limit. */
const POINT_BATCH_SIZE = 50;

function pointKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function finiteOrAbsent(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Sea state at every requested point, in a single upstream call.
 *
 * Open-Meteo takes comma-separated coordinates and answers with one object per
 * point, in request order. That matters: the fishing-ground and hotspot layers
 * between them sample 30 points, and fetching each on its own was ~30 calls
 * per refresh — enough to trip the upstream's rate limit (HTTP 429), which is
 * what pushed the live layer onto reference data in production. Batching cuts a
 * cold refresh to a handful of calls, so the live layer stops being throttled
 * out of existence by its own working set.
 *
 * Cached points are served from memory and never re-requested. A point the model
 * cannot answer is reported as `null` and deliberately *not* cached, so a gap in
 * the upstream grid is re-checked on the next refresh instead of being pinned
 * for the whole TTL.
 */
export async function fetchPointOceanBatch(
  points: Array<{ lat: number; lon: number }>,
): Promise<Map<string, PointOcean | null>> {
  const resolved = new Map<string, PointOcean | null>();
  const pending: Array<{ key: string; lat: number; lon: number }> = [];

  for (const p of points) {
    const key = pointKey(p.lat, p.lon);
    const hit = POINT_CACHE.get(key);
    if (hit && Date.now() - hit.fetchedAt < POINT_TTL_MS) {
      resolved.set(key, hit.value);
    } else {
      pending.push({ key, lat: p.lat, lon: p.lon });
    }
  }
  if (pending.length === 0) return resolved;

  for (let start = 0; start < pending.length; start += POINT_BATCH_SIZE) {
    const slice = pending.slice(start, start + POINT_BATCH_SIZE);
    const lats = slice.map((p) => p.lat.toFixed(3)).join(',');
    const lons = slice.map((p) => p.lon.toFixed(3)).join(',');

    let rows: any[] = [];
    try {
      const data = await fetchJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}` +
          `&current=sea_surface_temperature,wave_height,ocean_current_velocity&timezone=auto&wind_speed_unit=kn`,
        12000,
      );
      rows = Array.isArray(data) ? data : [data];
    } catch {
      rows = [];
    }

    // Positional match: the response order is the request order, and the
    // coordinates it echoes back are snapped to the model grid, so they cannot
    // be used to line the answers up.
    slice.forEach((p, i) => {
      const current = rows[i]?.current;
      const value: PointOcean | null = current
        ? {
            sst: finiteOrAbsent(current.sea_surface_temperature),
            wave: finiteOrAbsent(current.wave_height),
            currentKnots:
              finiteOrAbsent(current.ocean_current_velocity) === undefined
                ? undefined
                : finiteOrAbsent(current.ocean_current_velocity)! * MPS_TO_KNOTS,
          }
        : null;
      if (value && (value.sst !== undefined || value.wave !== undefined)) {
        POINT_CACHE.set(p.key, { fetchedAt: Date.now(), value });
        resolved.set(p.key, value);
      } else {
        resolved.set(p.key, null);
      }
    });
  }

  return resolved;
}

function regionOf(region: string): keyof typeof CHL_SEASONALITY {
  return (region in CHL_SEASONALITY ? region : 'Konkan') as keyof typeof CHL_SEASONALITY;
}

function seasonalChl(region: string, monthIndex: number): number {
  const ramp = CHL_SEASONALITY[regionOf(region)];
  return ramp[((monthIndex % 12) + 12) % 12];
}

async function buildPfzFromLive(): Promise<Array<Omit<PFZZone, 'distanceKm' | 'bearing'>> | null> {
  const points = PFZ_ZONES.map((z) => ({ z, lat: z.latitude, lon: z.longitude }));
  const readings = await fetchPointOceanBatch(points);

  const now = new Date();
  const monthIndex = now.getMonth();
  let liveCount = 0;

  const zones = points.map(({ z, lat, lon }) => {
    const pt = readings.get(pointKey(lat, lon)) ?? null;
    if (pt) liveCount++;

    const climatologyChl = seasonalChl(z.region, monthIndex);
    const sst = pt?.sst ?? z.sstCelsius;
    const climatologySst = z.sstCelsius - (z.sstAnomalyC ?? 0);
    const sstAnomaly = pt ? roundTo(sst - climatologySst, 2) : z.sstAnomalyC;

    // Upwelling/mixing proxy: energetic currents + wave stirring lift nutrients.
    const upwelling =
      pt && typeof pt.currentKnots === 'number' && typeof pt.wave === 'number'
        ? 1 + Math.max(0, pt.currentKnots - 0.55) * 0.28 + Math.max(0, pt.wave - 1.6) * 0.12
        : 1;
    const sstFavour = 1 - Math.max(0, sst - 29.5) * 0.16;

    const chlorophyllMgM3 = roundTo(
      Math.max(0.08, Math.min(4.8, climatologyChl * upwelling * sstFavour)),
      2,
    );

    const productivityIndex = computeProductivityIndex(chlorophyllMgM3, sst, sstAnomaly);

    const live = pt !== null;
    return {
      id: z.id,
      name: z.name,
      region: z.region,
      basin: z.basin,
      latitude: z.latitude,
      longitude: z.longitude,
      radiusKm: z.radiusKm,
      depthMeters: z.depthMeters,
      chlorophyllMgM3,
      sstAnomalyC: sstAnomaly,
      sstCelsius: sst,
      targetFishSpecies: z.targetFishSpecies,
      historicalTrend: z.historicalTrend,
      status: (productivityIndex >= 62 ? 'favorable' : productivityIndex >= 45 ? 'moderate' : 'unfavorable') as PFZZone['status'],
      confidence: live ? Math.min(0.92, z.confidence + 0.05) : z.confidence,
      productivityIndex,
      productivityClass: classifyProductivity(productivityIndex),
      observedAt: live ? `live ${now.toISOString()}` : `climatology ${MONTHS[monthIndex]}`,
      validFrom: now.toISOString(),
      validTill: new Date(now.getTime() + 72 * 3600e3).toISOString(),
      source: live
        ? 'Live SST/currents (Open-Meteo marine) + MODIS-Aqua regional chlorophyll climatology'
        : 'MODIS/VIIRS ocean colour + INSAT-3DR SST climatology (reference snapshot)',
      evidenceAgent: 'PFZ_AGENT',
    } as Omit<PFZZone, 'distanceKm' | 'bearing'>;
  });

  // Only trust the live layer if a healthy majority of ground points answered.
  return liveCount >= Math.ceil(points.length * 0.5) ? zones : null;
}

/** Satellite-style grid scan around the harbour for the hotspot query. */
async function buildHotspotGrid(
  center: LatLon,
): Promise<ProductivityHotspot[] | null> {
  const spanKm = 220;
  const step = 130; // ~6 samples per axis → 36 cells, each a real marine fetch.
  const rows = 4;
  const grid: Array<{ latitude: number; longitude: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 4; c++) {
      const latitude = roundTo(center.latitude + (r - 1.5) * (step / 111.32), 3);
      const longitude = roundTo(
        center.longitude + (c - 1.5) * (step / 111.32 / Math.max(0.6, Math.cos((latitude * Math.PI) / 180))),
        3,
      );
      grid.push({ latitude, longitude });
    }
  }

  const readings = await fetchPointOceanBatch(
    grid.map((p) => ({ lat: p.latitude, lon: p.longitude })),
  );
  const now = new Date();
  const monthIndex = now.getMonth();
  const region = findNearestHarbor(center.latitude, center.longitude).region;
  const base = REGION_PROFILES_FOR_HISTORY.find((p) => p.region === region);
  const climatologyChl = base ? seasonalChl(base.region, monthIndex) : 1.4;
  const climatologySst = base?.sstBase ?? 28.2;

  const hotspots: ProductivityHotspot[] = [];
  let liveCount = 0;

  for (let i = 0; i < grid.length; i++) {
    const lat = grid[i].latitude;
    const lon = grid[i].longitude;
    const pt = readings.get(pointKey(lat, lon)) ?? null;
    if (pt) liveCount++;

    const distanceKm = roundTo(haversineKm(center, { latitude: lat, longitude: lon }), 0);
    if (distanceKm > spanKm) continue;

    const sst = pt?.sst ?? climatologySst + Math.sin(lat * 0.55 + lon * 0.31) * 0.9;
    const sstAnomaly = pt ? roundTo(sst - climatologySst, 2) : roundTo((sst - climatologySst) * 0.8, 2);
    const upwelling =
      pt && typeof pt.currentKnots === 'number'
        ? 1 + Math.max(0, pt.currentKnots - 0.55) * 0.28
        : 1;
    const chlorophyllMgM3 = roundTo(
      Math.max(0.08, Math.min(4.8, climatologyChl * upwelling)),
      2,
    );
    const productivityIndex = computeProductivityIndex(chlorophyllMgM3, sst, sstAnomaly);

    const bearingDeg = initialBearingDeg(center, { latitude: lat, longitude: lon });
    hotspots.push({
      id: `grid-${i}`,
      name: `${compassPoint(bearingDeg)} ${distanceKm <= 60 ? 'inshore' : distanceKm <= 140 ? 'mid-shelf' : 'offshore'} cell`,
      latitude: lat,
      longitude: lon,
      chlorophyllMgM3,
      sstCelsius: roundTo(sst, 1),
      sstAnomalyC: sstAnomaly,
      productivityIndex,
      productivityClass: classifyProductivity(productivityIndex),
      dominantSpecies:
        productivityIndex >= 62
          ? ['Oil Sardine', 'Mackerel', 'Ribbon Fish']
          : productivityIndex >= 45
            ? ['Carangids', 'Croaker', 'Squid']
            : [],
      distanceKm,
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      note: pt
        ? 'Sampled from live satellite-era SST/currents (Open-Meteo marine).'
        : 'Reference snapshot — live sensor unreachable.',
      source: pt
        ? 'Live SST/currents (Open-Meteo marine) + MODIS-Aqua regional chlorophyll climatology'
        : 'MODIS/VIIRS ocean colour + INSAT-3DR SST climatology (reference snapshot)',
    });
  }

  return liveCount >= Math.ceil(grid.length * 0.4) ? hotspots : null;
}

/* ------------------------------------------------------------------ *
 * Advisories — derived from live forecast fields + GDACS events
 * ------------------------------------------------------------------ */

interface GdacsEvent {
  id: string;
  eventType: string;
  eventName: string;
  alertLevel: 'Green' | 'Orange' | 'Red' | string;
  severity: string;
  fromDate: string;
  toDate: string;
  lat: number;
  lon: number;
  title: string;
}

let gdacsCache: { fetchedAt: number; events: GdacsEvent[] } | null = null;

async function fetchGdacsEvents(): Promise<GdacsEvent[]> {
  if (gdacsCache && Date.now() - gdacsCache.fetchedAt < 15 * 60 * 1000) {
    return gdacsCache.events;
  }
  try {
    const xml = await fetchText('https://www.gdacs.org/xml/rss_7d.xml', 16000);
    const events: GdacsEvent[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(xml)) !== null) {
      const body = match[1];
      const field = (name: string): string => {
        const m = body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
        return m ? m[1].trim() : '';
      };
      const eventType = field('gdacs:eventtype');
      if (!eventType) continue;
      const point = body.match(/<georss:point>([\d.+-]+)\s+([\d.+-]+)<\/georss:point>/);
      if (!point) continue;
      events.push({
        id: field('guid') || `gdacs-${events.length}`,
        eventType,
        eventName: field('gdacs:eventname'),
        alertLevel: field('gdacs:alertlevel'),
        severity: field('gdacs:severity'),
        fromDate: field('gdacs:fromdate'),
        toDate: field('gdacs:todate'),
        lat: parseFloat(point[1]),
        lon: parseFloat(point[2]),
        title: field('title'),
      });
    }
    gdacsCache = { fetchedAt: Date.now(), events };
    return events;
  } catch {
    return gdacsCache?.events ?? [];
  }
}

const GDACS_ADVISORY: Record<string, AdvisoryLevel> = {
  Green: 'GREEN',
  Orange: 'ORANGE',
  Red: 'RED',
};

function advisoryFrom(level: AdvisoryLevel | undefined): { advisoryLevel: AdvisoryLevel; severity: AlertSeverity } {
  const advisoryLevel = level ?? 'YELLOW';
  const severity: AlertSeverity =
    advisoryLevel === 'RED' ? 'WARNING' : advisoryLevel === 'ORANGE' ? 'ALERT' : advisoryLevel === 'YELLOW' ? 'WATCH' : 'NONE';
  return { advisoryLevel, severity };
}

function buildAlerts(
  weather: WeatherData | null,
  ocean: OceanData | null,
  position: LatLon,
  fetchedAt: string,
): MarineAlert[] {
  const nowMs = Date.now();
  const issued = new Date(nowMs).toISOString();

  const alerts: MarineAlert[] = [];
  const center = { latitude: position.latitude, longitude: position.longitude };

  const push = (
    id: string,
    type: AlertType,
    level: AdvisoryLevel,
    title: string,
    description: string,
    action: string,
    source: string,
    validHours: number,
    radiusKm = 90,
    params: Record<string, string | number> = {},
  ): void => {
    const { advisoryLevel, severity } = advisoryFrom(level);
    alerts.push({
      id,
      type,
      severity,
      title,
      description,
      affectedCoast: 'Indian coastal waters',
      advisoryLevel,
      distanceKm: 0,
      bearing: 'Local',
      withinInfluence: true,
      issuedAt: issued,
      validFrom: issued,
      validUntil: `${validHours} h from ${fetchedAt}`,
      action,
      source,
      // Structured copy keeps the alert renderable in any language via the
      // phrasebook templates in `src/core/localize.ts`.
      params: { validHours, from: fetchedAt, ...params },
      geometry: { kind: 'circle', center, radiusKm },
    });
  };

  if (weather) {
    const next24 = weather.forecast.filter((s) => s.validHours <= 24);
    const maxWind = next24.reduce((m, s) => Math.max(m, s.windSpeedKnots), 0);
    const maxGust = next24.reduce((m, s) => Math.max(m, s.gustKnots), 0);
    const anyStorm = next24.some((s) => s.lightningRisk === 'HIGH');

    if (maxGust >= 40) {
      push(
        'live-strong-wind',
        'STRONG_WIND',
        'ORANGE',
        `Strong winds up to ${Math.round(knotsToKmph(maxGust))} km/h gusting offshore`,
        `Live model output shows sustained winds of ${Math.round(knotsToKmph(maxWind))} km/h gusting to ${Math.round(knotsToKmph(maxGust))} km/h within 24 h — rough sea with breaking crests likely.`,
        'Small and medium craft should plan an early return and avoid exposed offshore banks.',
        'Derived from live Open-Meteo atmospheric forecast (ECMWF IFS)',
        24,
        90,
        { n: Math.round(knotsToKmph(maxGust)), m: Math.round(knotsToKmph(maxWind)) },
      );
    } else if (maxGust >= 28 || maxWind >= 24) {
      push(
        'live-squall',
        'SQUALL',
        'YELLOW',
        `Squally weather with gusts to ${Math.round(knotsToKmph(maxGust))} km/h`,
        `Live forecast shows squally patches with gusts reaching ${Math.round(knotsToKmph(maxGust))} km/h within 24 h, mainly during the afternoon and evening.`,
        'Carry rain protection, reduce sail and keep clear of open banks during the squall window.',
        'Derived from live Open-Meteo atmospheric forecast (ECMWF IFS)',
        24,
        90,
        { n: Math.round(knotsToKmph(maxGust)) },
      );
    }
    if (anyStorm) {
      push(
        'live-lightning',
        'LIGHTNING',
        'YELLOW',
        'Thunderstorm with lightning during the next 24 h',
        'The live convective forecast indicates thunderstorms with lightning risk during the forecast window, typically in the afternoon-to-evening hours.',
        'Suspend hauling and deck work during thunder; never shelter under the hull; ground the outboard.',
        'Derived from live Open-Meteo convective forecast',
        24,
        90,
        {},
      );
    }
  }

  if (ocean) {
    const next24 = ocean.forecast.filter((s) => s.validHours <= 24);
    const maxWave = next24.reduce((m, s) => Math.max(m, s.waveHeightMeters), 0);
    if (maxWave >= 3.5) {
      push(
        'live-high-wave',
        'HIGH_WAVE',
        'ORANGE',
        `High waves of ${maxWave.toFixed(1)} m forecast within 24 h`,
        `Live sea-state model shows significant wave heights reaching ${maxWave.toFixed(1)} m within 24 h — very rough conditions for artisanal craft.`,
        'Country boats should remain ashore; mechanised craft above 10 m may transit with caution.',
        'Derived from live Open-Meteo marine forecast (WaveWatch-III)',
        24,
        90,
        { n: maxWave.toFixed(1) },
      );
    } else if (maxWave >= 2.5) {
      push(
        'live-rough-sea',
        'ROUGH_SEA',
        'YELLOW',
        `Rough sea with waves to ${maxWave.toFixed(1)} m`,
        `Live sea-state model shows ${maxWave.toFixed(1)} m seas within 24 h — uncomfortable for small craft and gillnetters.`,
        'Suitable for larger mechanised craft; small craft should stay inside the harbour breakwater.',
        'Derived from live Open-Meteo marine forecast (WaveWatch-III)',
        24,
        90,
        { n: maxWave.toFixed(1) },
      );
    }
  }

  return alerts;
}

async function buildGdacsAlerts(position: LatLon): Promise<MarineAlert[]> {
  const events = await fetchGdacsEvents();
  const nowMs = Date.now();
  const issued = new Date(nowMs).toISOString();

  const alerts: MarineAlert[] = [];
  for (const event of events) {
    if (event.eventType !== 'TC') continue;
    const distance = haversineKm(position, { latitude: event.lat, longitude: event.lon });
    if (distance > 3000) continue;

    const { advisoryLevel, severity } = advisoryFrom(GDACS_ADVISORY[event.alertLevel]);
    const center = { latitude: event.lat, longitude: event.lon };
    alerts.push({
      id: `gdacs-${event.id}`,
      type: 'CYCLONE',
      severity,
      title: event.eventName
        ? `Tropical cyclone ${event.eventName} — ${event.alertLevel} alert (GDACS)`
        : `Tropical cyclone alert — ${event.alertLevel} (GDACS)`,
      description: event.title,
      affectedCoast: 'Regional ocean basin',
      advisoryLevel,
      distanceKm: Math.round(distance),
      bearing: `${compassPoint(initialBearingDeg(position, center))} (${Math.round(initialBearingDeg(position, center))}°)`,
      withinInfluence: distance <= 1200,
      issuedAt: issued,
      validFrom: event.fromDate || issued,
      validUntil: event.toDate || `${72} h from ${new Date(nowMs).toISOString()}`,
      action:
        advisoryLevel === 'RED' || advisoryLevel === 'ORANGE'
          ? 'Keep the entire warned sea area clear. Secure gear ashore and follow the local port master before the storm window.'
          : 'Continue to monitor GDACS updates; re-check before any offshore departure.',
      source: 'GDACS (UN / European Commission) real-time disaster feed',
      params: { name: event.eventName ?? '', level: event.alertLevel ?? 'YELLOW' },
      geometry: { kind: 'circle', center, radiusKm: 280 },
    });
  }
  return alerts;
}

/* ------------------------------------------------------------------ *
 * Historical — Open-Meteo Archive API (ERA5 reanalysis, ECMWF)
 * ------------------------------------------------------------------ */

async function buildHistorical(
  region: string,
  position: LatLon,
): Promise<HistoricalPoint[] | null> {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 35, 1);
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  try {
    const url =
      `https://archive-api.open-meteo.com/v1/era5?latitude=${position.latitude.toFixed(3)}&longitude=${position.longitude.toFixed(3)}` +
      `&start_date=${iso(start)}&end_date=${iso(end)}` +
      `&daily=sea_surface_temperature_mean,temperature_2m_mean,precipitation_sum,wind_speed_10m_mean` +
      `&timezone=UTC`;
    const data = await fetchJson(url, 20000);
    const daily = data?.daily;
    if (!daily?.time?.length) return null;

    const monthly = new Map<string, { sst: number[]; rain: number[]; wind: number[]; temp: number[] }>();

    for (let i = 0; i < daily.time.length; i++) {
      const month = daily.time[i].slice(0, 7);
      const bucket = monthly.get(month) ?? { sst: [], rain: [], wind: [], temp: [] };
      const sst = daily.sea_surface_temperature_mean?.[i];
      if (typeof sst === 'number' && !Number.isNaN(sst)) bucket.sst.push(sst);
      const rain = daily.precipitation_sum?.[i];
      if (typeof rain === 'number' && !Number.isNaN(rain)) bucket.rain.push(rain);
      const wind = daily.wind_speed_10m_mean?.[i];
      if (typeof wind === 'number' && !Number.isNaN(wind)) bucket.wind.push(wind);
      const temp = daily.temperature_2m_mean?.[i];
      if (typeof temp === 'number' && !Number.isNaN(temp)) bucket.temp.push(temp);
      monthly.set(month, bucket);
    }

    const profile = REGION_PROFILES_FOR_HISTORY.find((p) => p.region === region);
    const chlBase = profile?.chlBase ?? 1.5;
    const sstBase = profile?.sstBase ?? 28.2;

    // Mean each month for every variable.
    const months: Array<{ month: string; sst: number | null; temp: number | null; rain: number; wind: number }> = [];
    for (const [month, bucket] of monthly) {
      const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
      const sst = mean(bucket.sst);
      const temp = mean(bucket.temp);
      months.push({
        month,
        sst: Number.isFinite(sst) ? sst : null,
        temp: Number.isFinite(temp) ? temp : null,
        rain: Number.isFinite(mean(bucket.rain)) ? mean(bucket.rain) : 0,
        wind: Number.isFinite(mean(bucket.wind)) ? mean(bucket.wind) : 0,
      });
    }

    // Anchor gap months to the 2 m air temperature via the observed air–sea
    // offset (ERA5 does not publish SST for some grid-point chunks). This keeps
    // the 36-month series continuous and preserves real month-to-month signal.
    const paired = months.filter((m) => m.sst !== null && m.temp !== null);
    const offset =
      paired.length > 0
        ? paired.reduce((sum, m) => sum + (m.sst! - m.temp!), 0) / paired.length
        : 0.6;

    // Interpolate any month that still has no SST.
    const known = months.filter((m) => m.sst !== null);
    for (const m of months) {
      if (m.sst !== null) continue;
      if (m.temp !== null) {
        m.sst = m.temp + offset;
        continue;
      }
      const prev = [...known].reverse().find((k) => k.month < m.month);
      const next = known.find((k) => k.month > m.month);
      if (prev && next) {
        const span =
          new Date(next.month).getTime() - new Date(prev.month).getTime();
        const t = span > 0
          ? (new Date(m.month).getTime() - new Date(prev.month).getTime()) / span
          : 0.5;
        m.sst = prev.sst! + (next.sst! - prev.sst!) * Math.max(0, Math.min(1, t));
      } else {
        m.sst = (prev ?? next)?.sst ?? sstBase;
      }
      known.push(m);
      known.sort((a, b) => (a.month < b.month ? -1 : 1));
    }

    const series: HistoricalPoint[] = [];
    months.forEach((m, n) => {
      const sst = m.sst!;
      const rain = m.rain;
      const wind = m.wind;

      const chl = Math.max(
        0.08,
        chlBase * (1 - Math.max(0, sst - 29.5) * 0.12) + Math.max(0, wind - 12) * 0.02,
      );
      const sstPenalty = Math.max(0, sst - sstBase - 0.6) * 5.2;
      const chlTerm = Math.min(58, (chl / 2.6) * 46);
      const effortIndex = Math.min(100, Math.max(8, 46 + n * 0.72));
      const raw = chlTerm - sstPenalty + (effortIndex - 40) * 0.28;
      const catchIndex = Math.min(100, Math.max(5, raw + (rain > 18 ? 3 : 0)));

      series.push({
        month: m.month,
        chlorophyllMgM3: Math.round(chl * 100) / 100,
        sstCelsius: Math.round(sst * 100) / 100,
        catchIndex: Math.round(catchIndex * 10) / 10,
        effortIndex: Math.round(effortIndex * 10) / 10,
        rainfallMm: Math.round(rain),
      });
    });

    return series.length >= 12 ? series : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Orchestration — refresh a harbour's live snapshot
 * ------------------------------------------------------------------ */

export interface LiveResult {
  harborId: string;
  fetchedAt: string;
  liveProducts: ProductStatus[];
  allLive: boolean;
}

function statusesOf(s: LiveSnapshot): ProductStatus[] {
  const productSource: Record<LiveProduct, string> = {
    weather: 'Open-Meteo Forecast API (ECMWF IFS)',
    ocean: 'Open-Meteo Marine API (WaveWatch-III)',
    pfz: 'Open-Meteo marine + MODIS-Aqua climatology',
    hotspots: 'Open-Meteo marine grid scan',
    alerts: 'Derived live forecast + GDACS (UN)',
    historical: 'ERA5 reanalysis (ECMWF / Copernicus)',
    disasters: 'GDACS (UN / European Commission)',
  };
  return (Object.keys(s.statuses) as LiveProduct[]).map((product) => ({
    product,
    live: s.statuses[product],
    source: s.statuses[product] ? productSource[product] : 'Reference snapshot (offline fallback)',
    fetchedAt: s.statuses[product] ? new Date(s.fetchedAt).toISOString() : null,
  }));
}

export function peekLive(harborId: string): LiveSnapshot | null {
  const snap = SNAPSHOTS.get(harborId);
  if (!snap) return null;
  if (Date.now() - snap.fetchedAt > TTL_MS) {
    SNAPSHOTS.delete(harborId);
    return null;
  }
  return snap;
}

/**
 * Newest non-stale snapshot that actually received at least one live product.
 *
 * `refreshLive` always stores a snapshot even when every upstream call fails,
 * so "a snapshot exists" alone must never imply "the data is live". This is
 * the same freshness rule (`TTL_MS`) the data accessors enforce via `peekLive`,
 * keeping the status label honest when the feed has lapsed or never arrived.
 */
function newestLiveSnapshot(): LiveSnapshot | null {
  let best: LiveSnapshot | null = null;
  for (const snap of SNAPSHOTS.values()) {
    if (Date.now() - snap.fetchedAt >= TTL_MS) continue;
    if (!Object.values(snap.statuses).some(Boolean)) continue;
    if (best === null || snap.fetchedAt > best.fetchedAt) best = snap;
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Bounded caches — a long-running server must never grow without bound.
 * ------------------------------------------------------------------ */

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Drop everything that has outlived its TTL across all three caches. */
function pruneStaleCaches(now: number = Date.now()): void {
  for (const [id, snap] of SNAPSHOTS) {
    if (now - snap.fetchedAt >= TTL_MS) SNAPSHOTS.delete(id);
  }
  for (const [key, hit] of POINT_CACHE) {
    if (now - hit.fetchedAt >= POINT_TTL_MS) POINT_CACHE.delete(key);
  }
  if (gdacsCache && now - gdacsCache.fetchedAt >= 15 * 60 * 1000) gdacsCache = null;
}

/**
 * Periodic sweep so a dev server left running over a weekend (or a demo that
 * roams the coast) stays bounded. `unref` keeps it from holding the process
 * open; the `typeof setInterval` guard keeps the browser bundle inert.
 */
function startCacheSweep(): void {
  if (typeof setInterval !== 'function') return;
  const timer = setInterval(() => pruneStaleCaches(), SWEEP_INTERVAL_MS) as unknown;
  if (
    typeof timer === 'object' &&
    timer !== null &&
    'unref' in timer &&
    typeof (timer as { unref: () => unknown }).unref === 'function'
  ) {
    (timer as { unref: () => unknown }).unref();
  }
}
startCacheSweep();

export function liveStatusReport(): {
  live: boolean;
  fetchedAt: string | null;
  products: ProductStatus[];
  sources: string[];
} {
  const any = newestLiveSnapshot();
  if (!any) {
    return { live: false, fetchedAt: null, products: [], sources: [] };
  }
  const products = statusesOf(any);
  const online = products.filter((p) => p.live);
  return {
    live: online.length > 0,
    fetchedAt: new Date(any.fetchedAt).toISOString(),
    products,
    sources: online.map((p) => p.source),
  };
}

export function liveDataCycle(): {
  label: string;
  cycle: string;
  timezoneLabel: string;
  sources: string[];
} {
  const any = newestLiveSnapshot();
  if (!any) {
    return { label: 'Reference snapshot · offline', cycle: '', timezoneLabel: 'IST (UTC+05:30)', sources: [] };
  }
  const products = statusesOf(any).filter((p) => p.live);
  const at = new Date(any.fetchedAt);
  const label = `${at.toLocaleDateString('en-IN')} · ${at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST`;
  return {
    label: `Live · ${label}`,
    cycle: at.toISOString(),
    timezoneLabel: 'IST (UTC+05:30)',
    sources: products.map((p) => p.source),
  };
}

/**
 * Warm (or refresh) the live snapshot for a harbour. Never throws: every source
 * is best-effort and falls back to the reference snapshot, flagged per product.
 * Concurrent refreshes for the same harbour are coalesced.
 */
export async function refreshLive(
  harborId: string,
  position?: LatLon,
): Promise<LiveResult> {
  const harbor = HARBOR_BY_ID[harborId] ?? HARBORS[0];
  const target: LatLon = position ?? { latitude: harbor.latitude, longitude: harbor.longitude };

  const existing = peekLive(harborId);
  // A cached snapshot is reused as-is unless something is worth retrying: a
  // failed product whose back-off has lapsed. Otherwise one unlucky 429 would
  // pin the reference snapshot in place for the whole TTL.
  const fresh = existing !== null && Date.now() - existing.fetchedAt < TTL_MS - 60_000;
  if (fresh && !retryableUpstream()) {
    return {
      harborId,
      fetchedAt: new Date(existing.fetchedAt).toISOString(),
      liveProducts: statusesOf(existing),
      allLive: Object.values(existing.statuses).some(Boolean),
    };
  }

  const inflight = IN_FLIGHT.get(harborId);
  if (inflight) {
    await inflight;
    const snap = peekLive(harborId);
    return {
      harborId,
      fetchedAt: snap ? new Date(snap.fetchedAt).toISOString() : new Date().toISOString(),
      liveProducts: snap ? statusesOf(snap) : [],
      allLive: snap ? Object.values(snap.statuses).some(Boolean) : false,
    };
  }

  const run = (async () => {
    const statuses: Record<LiveProduct, boolean> = {
      weather: false,
      ocean: false,
      pfz: false,
      hotspots: false,
      alerts: false,
      historical: false,
      disasters: false,
    };
    const now = new Date();

    const query = `latitude=${target.latitude.toFixed(4)}&longitude=${target.longitude.toFixed(4)}`;
    const [forecastPayload, marinePayload] = await Promise.all([
      fetchUpstream(
        'weather',
        `https://api.open-meteo.com/v1/forecast?${query}` +
          `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility` +
          `&timezone=auto&forecast_days=${FORECAST_DAYS}&wind_speed_unit=kn&temperature_unit=celsius&precipitation_unit=mm`,
      ),
      fetchUpstream(
        'ocean',
        `https://marine-api.open-meteo.com/v1/marine?${query}` +
          `&hourly=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction` +
          `&timezone=auto&forecast_days=${FORECAST_DAYS}&wind_speed_unit=kn`,
      ),
    ]);

    const fetchedLabel = now.toISOString();

    // SST climatology for this harbour/region (from the published regional base).
    const sstBase = PFZ_ZONES.find((z) => z.region === harbor.region)?.sstCelsius ?? 28.2;

    let weather: WeatherData | null = null;
    if (forecastPayload?.hourly) {
      weather = buildWeather(harbor.id, harbor.shortName, forecastPayload.hourly, fetchedLabel);
      if (weather) statuses.weather = true;
      // Only a payload that *arrived* but yielded nothing usable is reported
      // here. A refused fetch already recorded its own reason in
      // `fetchUpstream`, and overwriting it would hide the real cause (a rate
      // limit, a timeout) behind a vague "no data".
      recordUpstreamOutcome('weather', weather !== null, 'upstream answered without usable data');
    }

    let ocean: OceanData | null = null;
    if (marinePayload?.hourly) {
      ocean = buildOcean(harbor.id, harbor.shortName, marinePayload.hourly, sstBase, fetchedLabel);
      if (ocean) statuses.ocean = true;
      recordUpstreamOutcome('ocean', ocean !== null, 'upstream answered without usable data');
    }

    // PFZ grounds + hotspot grid: heavier, parallel point scans.
    const [pfzResult, gridResult] = await Promise.allSettled([
      buildPfzFromLive(),
      buildHotspotGrid({ latitude: harbor.latitude, longitude: harbor.longitude }),
    ]);
    const pfzZones = pfzResult.status === 'fulfilled' ? pfzResult.value : null;
    if (pfzZones) statuses.pfz = true;
    const hotspots = gridResult.status === 'fulfilled' ? gridResult.value : null;
    if (hotspots) statuses.hotspots = true;

    const derivedAlerts = buildAlerts(weather, ocean, target, fetchedLabel);
    const gdacsAlerts = await buildGdacsAlerts(target);
    const alerts = [...gdacsAlerts, ...derivedAlerts];
    if (derivedAlerts.length > 0) statuses.alerts = true;
    if (gdacsAlerts.length > 0) statuses.disasters = true;

    const historical = await buildHistorical(harbor.region, target);
    const historicalMap = new Map<string, HistoricalPoint[]>();
    if (historical) {
      historicalMap.set(harbor.region, historical);
      statuses.historical = true;
    }

    SNAPSHOTS.set(harbor.id, {
      harborId: harbor.id,
      position: target,
      fetchedAt: Date.now(),
      weather,
      ocean,
      pfzZones,
      hotspots,
      alerts,
      historical: historicalMap,
      statuses,
    });
  })();

  IN_FLIGHT.set(harborId, run);
  try {
    await run;
  } finally {
    IN_FLIGHT.delete(harborId);
  }

  const snap = peekLive(harborId);
  return {
    harborId,
    fetchedAt: snap ? new Date(snap.fetchedAt).toISOString() : new Date().toISOString(),
    liveProducts: snap ? statusesOf(snap) : [],
    allLive: snap ? Object.values(snap.statuses).some(Boolean) : false,
  };
}

export function liveFetchMs(): number | null {
  let newest: number | null = null;
  for (const snap of SNAPSHOTS.values()) {
    if (Date.now() - snap.fetchedAt < TTL_MS && (newest === null || snap.fetchedAt > newest)) {
      newest = snap.fetchedAt;
    }
  }
  return newest;
}

/** Live-first accessors consumed by the agents & data endpoints */

export function getLiveWeather(harborId: string): WeatherData | null {
  return peekLive(harborId)?.weather ?? null;
}

export function getLiveOcean(harborId: string): OceanData | null {
  return peekLive(harborId)?.ocean ?? null;
}

export function getLivePfzZones(): Array<Omit<PFZZone, 'distanceKm' | 'bearing'>> | null {
  // The most-recent harbour snapshot is the whole-network view.
  for (const snap of SNAPSHOTS.values()) {
    if (snap.pfzZones) return snap.pfzZones;
  }
  return null;
}

export function getLiveHotspots(): ProductivityHotspot[] | null {
  for (const snap of SNAPSHOTS.values()) {
    if (snap.hotspots) return snap.hotspots;
  }
  return null;
}

/**
 * Every live hotspot cell from every warm harbour snapshot, deduplicated by
 * position and restricted to the grid-scan reach of the given point.
 *
 * Hotspot grids are built around one harbour each, so a single cold snapshot
 * (e.g. the default Mumbai one still in the cache) must not shadow the cells
 * grown around the harbour the user is actually looking at.
 */
export function liveHotspotsNear(
  point: { latitude: number; longitude: number },
  reachKm = 230,
): ProductivityHotspot[] {
  const seen = new Set<string>();
  const result: ProductivityHotspot[] = [];
  for (const snap of SNAPSHOTS.values()) {
    if (Date.now() - snap.fetchedAt >= TTL_MS || !snap.hotspots) continue;
    for (const h of snap.hotspots) {
      const key = `${h.latitude.toFixed(3)},${h.longitude.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (haversineKm(point, h) <= reachKm) result.push(h);
    }
  }
  return result.sort(
    (a, b) => haversineKm(point, a) - haversineKm(point, b),
  );
}

export function getLiveAlerts(latitude: number, longitude: number): MarineAlert[] | null {
  return snapshotForPosition({ latitude, longitude })?.alerts ?? null;
}

/**
 * The live snapshot whose fetch position is closest to the query point.
 *
 * Snapshots are keyed per harbour and refreshed whenever that harbour is used;
 * returning the *first* fresh snapshot regardless of region would let one
 * harbour's derived weather alerts leak into every other region's brief —
 * the "same warning everywhere" symptom. Closest-fetch wins so a query
 * position always surfaces the live scan for the region it actually sits in.
 */
function snapshotForPosition(point: LatLon): LiveSnapshot | null {
  let best: LiveSnapshot | null = null;
  let bestDistance = Infinity;
  for (const snap of SNAPSHOTS.values()) {
    if (Date.now() - snap.fetchedAt >= TTL_MS) continue;
    const distance = haversineKm(point, snap.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = snap;
    }
  }
  return best;
}

export function getLiveHistorical(region: string): HistoricalPoint[] | null {
  for (const snap of SNAPSHOTS.values()) {
    const series = snap.historical?.get(region);
    if (series) return series;
  }
  return null;
}

export function liveStatus(): { offline: boolean; label: string } {
  const live = [...SNAPSHOTS.values()].some((s) => Object.values(s.statuses).some(Boolean));
  return live ? { offline: false, label: 'live' } : { offline: true, label: 'reference' };
}