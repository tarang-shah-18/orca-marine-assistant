# ORCA — Next steps / backlog

Status-scoped for **SIH 2026 (Problem ID 26176) · v2.0.0**. Items are grounded in code
audits of `src/core` (live layer, data access, dataset), the agents, and the server.
Each item carries its status — ✅ completed, 🕒 deferred (code-completable but deliberately
parked), or ⛔ blocked (needs an external source/key/licence that conflicts with the
keyless/offline invariant).

**Non-negotiable invariants for any change:**
- Regression sweep stays green: `npm test` → **3318/3318**.
- All **11 languages** stay fully localised (add every new user-facing string to the
  phrasebook in `src/core/i18n.ts` + templates in `src/core/localize.ts`).
- The engine stays **deterministic and keyless** (runs fully offline; a dead network must
  never produce a fake number — only a flagged reference fallback).
- Product tokens, agent names, units, severity codes and advisory levels stay verbatim.

Priority legend: **P0** = correctness / safety, **P1** = high user value, **P2** = polish.

---

## 1. Data fidelity (P0 — from the data-provenance audit)

| # | Item | Status |
|---|---|---|
| 1.1 | **Real tide-gauge data** — replace `seeded()` PRNG phases with published admiralty/INCOIS phase+amplitude tables. | ⛔ Blocked — needs a sourced table; none reachable without licence. `src/core/dataset.ts` (`buildTideStation`, `TIDE_SEEDS`), `src/agents/tideAgent.ts` (`EPOCH`). |
| 1.2 | **Live ocean-colour** — chlorophyll is a monthly MODIS-Aqua climatology, not a live retrieval (INCOIS/ERDDAP verified unreachable from the demo network). | ⛔ Blocked — archive-side; the climatology is the honest labelled baseline. `src/core/live.ts` (`CHL_SEASONALITY`, `seasonalChl`). |
| 1.3 | **Parseable bulletin expiry** — seed `validUntil` strings (`"+22 h from 29 Sept 2026, 15:20 IST"`) were unparseable by `new Date`, so bulletins never lapsed. | ✅ **Done** — `parseBulletinExpiry` in `src/core/alerts.ts` now decodes ISO, `+N h from ISO`, and `+N h from <IST stamp>` (explicit calendar, timezone-correct); all 6 seeds + live/GDACS alerts lapse on schedule while unknown ends stay conservatively governing. |
| 1.4 | **Real catch/effort series** — historical `catchIndex`/`effortIndex` are model heuristics (incl. synthetic `46 + n*0.72` ramp). | ⛔ Blocked — needs authoritative landings data; UI labels the series as model diagnostics. `src/core/live.ts` (`buildHistorical`). |
| 1.5 | **Hotspot species attribution** — `dominantSpecies` is a rule label by productivity band. | ⛔ Blocked — needs a catch/species dataset. `src/core/live.ts` (`buildHotspotGrid`). |
| 1.6 | **Live IMD/INCOIS bulletin feed** — offline advisories are curated verbatim seeds. | ⛔ Blocked — needs a reachable official bulletin stream; seeds stay the honest reference copy. `src/core/dataset.ts`, `src/agents/alertAgent.ts`. |
| 1.7 | **AIS / true fleet positions** — Fleet Watch is an honest per-harbour risk posture, not vessel tracking. | ⛔ Blocked — needs a licensed AIS feed. UI frames the tab as coastal-risk. `src/core/fleet.ts`. |

## 2. Safety & correctness (P0)

- **2.1 Headline alert distance honesty** — ✅ **Done**. Extracted `pickHeadlineAlert`
  (`src/core/alerts.ts`): the banner heads the strongest advisory **in force** at the
  position, else the nearest alert inside a 250 km local horizon (`HEADLINE_HORIZON_KM`),
  else `null` — a basin cyclone 1 000 km away never headlines a harbour with no advisory
  of its own. Server (`summariseForBanner`, `routes.ts`) and offline client
  (`briefFromResult`, `orcaApi.ts`) call the same helper, so they can never disagree.
- **2.2 Cache eviction** — ✅ **Done**. `pruneStaleCaches` in `src/core/live.ts` sweeps
  `SNAPSHOTS` (TTL 12 min), `POINT_CACHE` (30 min) and `gdacsCache` (15 min) every 5 min
  (`unref`'d, guarded for the browser bundle).
- **2.3 Sweep-residue audit** — ✅ **Done**. No `.find(() => true)` remains; the two
  `marineAlerts[0]` headline fallbacks were replaced by `pickHeadlineAlert`; remaining
  "first snapshot" reads go through `newestLiveSnapshot`/`peekLive` (TTL + liveness gated).
- **2.4 Rate limiting & auth** — ✅ **Done (limiting) / 🕒 auth**. Sliding-window per-IP
  throttle on `/api/chat` + `/api/chat/stream` (`routes.ts`), env-tunable
  (`ORCA_RATE_MAX`, `ORCA_RATE_WINDOW_MS`), 429 with retry hint after the window fills.
  Role-gated auth for Fleet Watch/situation endpoints is a deployment decision — deferred.
- **2.5 SSE hardening** — ✅ **Done (heartbeat + deadline) / 🕒 gzip**. `/chat/stream`
  now whispers `: ping` comments every 15 s (keeps flaky 3G/proxy connections open), ends
  any stream after 5 min, and disposes both timers on close. Response gzip would add a
  `compression` dependency and is deferred.

## 3. Product features (P1 — deferred)

Sizeable UI work, each deliberately parked; none affects engine correctness.

- **3.1 Alerts as areal shapes** — render GDACS advisory cones/polygons instead of
  point-distance circles. `src/core/live.ts`, `src/components/MapScreen.tsx`.
- **3.2 PWA + offline shell** — manifest + service worker; the engine already re-runs
  in-browser offline (`orcaApi.ts`).
- **3.3 Alert push notifications** — escalate when a harbour's headline advisory rises
  to ORANGE/RED or a geofence is approached.
- **3.4 Live geofence alerts on GPS track** — the continuous fix stream now exists
  (`watchPosition` in `src/App.tsx`, which also anchors the situation report to the nearest
  port and reconciles the client's selection to the engine's answer). What is still missing
  is calling `POST /api/geofence/check` per fix and surfacing a boundary crossing.
- **3.5 Multi-stop routes** — out-and-back legs with per-leg fuel/transit windows.
- **3.6 Localised dates** — data-cycle chip and `localHourBand` windows render English
  dates in all 11 languages; route through the phrasebook. Deliberately **not** a defect:
  those stamps are the *provenance label* of the reference cycle and the tide table, in the
  canonical `en-IN` IST format the bulletins themselves use, so the same cycle reads
  identically in every language. The user-facing relative time ("Updated 4 min ago") *is*
  translated, in all 11.
- **3.7 Exportable situation report** — one-tap PDF/image for harbour masters/disaster cells.
- **3.8 More harbours & community reports** — extend the 13-harbour gazetteer;
  fisher-submitted reports flagged `unverified`.

## 4. Engine & architecture robustness (P1)

- **4.1 Pin the reference cycle for reproducibility** — ✅ **Done**. `ORCA_DATA_CYCLE_PIN`
  (ISO 8601) overrides the module-load instant in `src/core/dataset.ts`; a pinned boot
  reproduces the same `DATA_CYCLE`, PFZ window and seed stamps (and honestly reports
  `reference` mode when the pinned cycle can't be live). Browser-bundle safe.
- **4.2 Persist sessions** — ✅ **Done**. `ORCA_SESSIONS_FILE` writes the in-memory store
  to JSON (debounced, atomic tmp+rename) and hydrates on boot, skipping TTL-expired
  entries; `flushSessions()` runs on graceful shutdown. Best-effort — never throws.
  `src/server/session.ts`.
- **4.3 Version the domain model** — ✅ **Done**. `DOMAIN_MODEL_VERSION` (`src/types.ts`)
  is echoed on every success envelope (`apiVersion`) and `/api/health`, so a mismatched
  client/server pair fails loud instead of parsing stale shapes.
- **4.4 Graceful shutdown** — ✅ **Done**. `server.ts` handles SIGINT/SIGTERM: stop
  accepting, flush persisted sessions, exit (5 s force-exit backstop).

## 5. Quality, tests & tooling (P2)

- **5.1 Unit tests for core math** — ✅ **Done**. `scripts/unit-tests.ts` (71 checks,
  fully offline): geodesy edges, advisory expiry/headline rules, i18n integrity across
  all 11 languages, dataset sanity, the localisation invariants (no English fallback ternary,
  no stale provenance exemption) and the freshness readout (age never understated, clock
  pinned to IST, poll period equal to the engine's cache TTL). Runs first on `npm test`
  (before the sweep); also `npm run test:unit`.
- **5.2 Property tests for i18n** — 🕒 deferred.
- **5.3 CI** — ✅ **Done**. `.github/workflows/ci.yml` ships (lint → unit tests → build →
  start production server → 3318-check sweep) and activates on the first push.
- **5.4 Sweep speed** — 🕒 sweep is ~35 s now; parallelising must keep assertions
  deterministic.
- **5.5 Load test** — 🕒 verify `/api/chat` under ~20 concurrent turns keeps upstream
  fetches bounded via the `IN_FLIGHT` coalesce.
- **5.6 Contrast regression** — 🕒 automated theme contrast check after the light-theme
  work.
- **5.7 Accessibility pass** — 🕒 keyboard map nav, screen-reader labels, tap targets.

## 6. Deployment & ops (P2)

- **6.1 Container** — ✅ **Done**. Two-stage `Dockerfile` (node:22-alpine; Vite + esbuild
  build; `npm ci --omit=dev` runtime) + `.dockerignore`; liveness `HEALTHCHECK` against
  `/api/health`; runs unprivileged (`USER node`).
- **6.2 Process & logs** — ✅ **Done (config) / 🕒 host setup**. `ecosystem.config.cjs`
  (PM2: restart on crash/OOM, log files, graceful `kill_timeout`); the server also writes
  one structured access-log line per request. Installing PM2 and `pm2 install
  pm2-logrotate` on the host are the remaining operator steps.
- **6.3 TLS + CORS for production** — ✅ **Done (config) / 🕒 operator TLS**. CORS is
  already scoped by `APP_URL` (never a bare `*` in a real deployment) and the server ships
  `ORCA_TRUST_PROXY` for the rate limiter behind a proxy; terminate TLS at the reverse
  proxy in front of the container.
- **6.4 Lightweight metrics** — ✅ **Done**. `GET /api/metrics` (Prometheus text) exposes
  per-route request/response counters, latency sums, sessions, live-product count and a
  data-mode gauge — no dependency, memory-only.
- **6.5 Readiness semantics** — ✅ **Done**. `GET /api/ready` reports `live` vs
  `reference` mode and per-product status, distinct from `/api/health` liveness.
- **6.6 Server hardening** — ✅ **Done**. Security headers (`nosniff`, DENY framing,
  referrer/permissions policy) plus a strict CSP on the built client; JSON
  400/404/500 errors that never leak stack traces; every async route wrapped
  (`asyncRoute` in `routes.ts`) so a rejection is a clean 500 instead of a hung
  request; Node keep-alive/headers timeouts tuned for classic proxies; crash-guard
  handlers for unhandled rejections/exceptions.
- **6.7 Orchestration** — ✅ **Done**. `docker-compose.yml`: build, liveness
  healthcheck, `restart: unless-stopped`, and a named volume for
  `ORCA_SESSIONS_FILE` so conversations survive container restarts.