/**
 * ORCA mobile API client.
 *
 * Talks to the TypeScript agent engine over HTTP (`server.ts` → `src/server/routes.ts`).
 * Every endpoint returns the same envelope:
 *
 *   { status: 'success' | 'error', data: T, error?: string, timestamp: string }
 *
 * …except `/api/chat`, which returns the `OrchestrationResult` at the top level
 * because it also carries the conversation's session id.
 *
 * There is deliberately no hard-coded answer cache. If the engine is
 * unreachable, the caller is told so (`offline: true`) and the UI says so
 * plainly, rather than showing a convincing fabricated number.
 */

import { Platform } from 'react-native';

/**
 * Where the agent engine lives.
 *
 *  - `10.0.2.2` is the Android emulator's alias for the host machine's
 *    `localhost`, so the default works in Expo Go with `server.ts` running on
 *    the same laptop.
 *  - On a physical phone on the same Wi-Fi, put your machine's LAN IP here,
 *    e.g. `http://192.168.1.10:3000`.
 *  - For a demo build, point this at a tunnel such as `https://...ngrok.app`.
 */
export const BASE_URL =
  process.env.EXPO_PUBLIC_ORCA_API ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

const API = `${BASE_URL}/api`;

/* ------------------------------------------------------------------ *
 * Session identity
 * ------------------------------------------------------------------ */

/**
 * Stable per-install session id.
 *
 * The engine keeps conversation memory server-side keyed by this string, so
 * "is it safe *there* tomorrow" resolves across turns. Deliberately not a UUID
 * dependency — `expo-crypto` is not in the dependency list.
 */
let cachedSessionId = null;
export function sessionId() {
  if (cachedSessionId) return cachedSessionId;
  const random = Math.random().toString(36).slice(2, 10);
  cachedSessionId = `m-${random}${Date.now().toString(36)}`;
  return cachedSessionId;
}

export function forgetSession() {
  cachedSessionId = null;
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function request(path, { method = 'GET', body, timeout = 12000 } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`${path} → HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.status === 'error') throw new Error(payload.error ?? 'ORCA API error');
  return payload;
}

const qs = (params = {}) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/** GET → `data`. */
export async function get(path, params, options) {
  const payload = await withTimeout(request(`${path}${qs(params)}`, options), options?.timeout ?? 12000, path);
  return payload.data;
}

/* ------------------------------------------------------------------ *
 * Conversation
 * ------------------------------------------------------------------ */

/**
 * Ask ORCA a question, streaming the agent trace as SSE.
 *
 * React Native's `fetch` does not expose a readable response body, so the
 * stream is read with `XMLHttpRequest` + `onprogress`, which does deliver
 * `responseText` incrementally. If the device or the proxy refuses to stream,
 * this falls back to the non-streaming `POST /api/chat`, which runs the exact
 * same pipeline and returns the same `OrchestrationResult`.
 *
 * @param {object}   options
 * @param {string}   options.message    The fisher's question, in any of 11 languages.
 * @param {string}   options.language   Language hint; the engine auto-detects anyway.
 * @param {string}   [options.harbor]   Harbour id or name.
 * @param {number}   [options.latitude] GPS fix.
 * @param {number}   [options.longitude]
 * @param {Function} [options.onEvent]  Called for every orchestrator event.
 * @returns {Promise<{result: object, offline: boolean}>}
 */
export function ask({ message, language, harbor, latitude, longitude, onEvent }) {
  const body = {
    message,
    language,
    sessionId: sessionId(),
    harbor,
    latitude,
    longitude,
  };

  if (!onEvent) {
    return withTimeout(request('/chat', { method: 'POST', body, timeout: 20000 }), 20000, '/chat')
      .then((payload) => ({ result: payload.result, offline: false }))
      .catch((error) => ({ result: null, offline: true, error: error.message }));
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    let buffer = '';
    let consumedLength = 0;
    let finalResult = null;

    const drain = () => {
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (line) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
            if (event.type === 'done') finalResult = event.result;
            if (event.type === 'error') finish({ result: null, offline: true, error: event.message });
          } catch {
            // A truncated frame must never cost a fisher their answer.
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    };

    xhr.onprogress = () => {
      // `responseText` is cumulative, so only the new tail is parsed.
      const full = xhr.responseText ?? '';
      if (full.length <= consumedLength) return;
      buffer = full.slice(consumedLength);
      consumedLength = full.length;
      drain();
    };

    xhr.onload = () => {
      if (finalResult) finish({ result: finalResult, offline: false });
      else fallback(body);
    };

    xhr.onerror = () => fallback(body);
    xhr.ontimeout = () => fallback(body);
    xhr.timeout = 45000;
    xhr.send(JSON.stringify(body));
  });

  /** Non-streaming retry: identical pipeline, identical result shape. */
  function fallback(payload) {
    if (settled) return;
    withTimeout(request('/chat', { method: 'POST', body: payload, timeout: 20000 }), 20000, '/chat')
      .then((response) => finish({ result: response.result, offline: false }))
      .catch((error) => finish({ result: null, offline: true, error: error.message }));
  }
}

/** Clear server-side conversation memory for this install. */
export async function resetConversation() {
  forgetSession();
  try {
    await request('/session/reset', { method: 'POST', body: { sessionId: sessionId() } });
  } catch {
    // A reset that never left the device is still a reset.
  }
}

/* ------------------------------------------------------------------ *
 * Reference & briefing
 * ------------------------------------------------------------------ */

export const fetchStatus = () => get('/status');
export const fetchHealth = () => request('/health');
export const fetchAgents = () => get('/agents');
export const fetchLanguages = () => get('/languages');
export const fetchHarbors = () => get('/harbors');
export const fetchScenarios = (language) => get('/scenarios', { language });
export const fetchSituation = (harbor, language) => get('/situation', { harbor, language });

/* ------------------------------------------------------------------ *
 * Marine data
 * ------------------------------------------------------------------ */

export const fetchPfz = (harbor, { limit = 5, withinKm } = {}) =>
  get('/pfz', { harbor, limit, withinKm });
export const fetchHotspots = (harbor, language) => get('/hotspots', { harbor, language });
export const fetchWeather = (harbor, language) => get('/weather', { harbor, language });
export const fetchOcean = (harbor, language) => get('/ocean', { harbor, language });
export const fetchTides = (harbor, horizon) => get('/tides', { harbor, horizon });
export const fetchAlerts = (harbor, { withinKm, latitude, longitude } = {}) =>
  get('/alerts', { harbor, withinKm, lat: latitude, lon: longitude });
export const fetchGeofences = (harbor, language) => get('/geofences', { harbor, language });
export const fetchHistorical = (harbor, language, region) =>
  get('/historical', { harbor, language, region });
export const fetchMapData = (harbor, language) => get('/map-data', { harbor, language });
export const fetchRoute = (from, to, vessel, language) =>
  get('/route', { from, to, vessel, language });

/**
 * Geofence check for a single position or a whole planned track.
 *
 * The corridor mode is the interesting one: "can I get from the dock to the
 * fishing ground without crossing a restricted area" is a question about the
 * path, not the endpoints.
 *
 * @param {Array<[number, number]>} track  `[lat, lon]` pairs.
 */
export const checkGeofence = (track, { harbor, language, latitude, longitude } = {}) =>
  request('/geofence/check', {
    method: 'POST',
    body: { track, harbor, language, latitude, longitude },
  }).then((payload) => payload.data);
