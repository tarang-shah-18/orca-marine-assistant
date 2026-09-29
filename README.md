<div align="center">

# ORCA

**Marine Ecosystem Reasoning with Collaborative Agents**

A conversational decision-support system for India's coastal fishermen, built on a
collaborative multi-agent pipeline. Ask in any of **11 Indian languages**; get the answer
back in that language, with the reasoning and the sources attached.

**Smart India Hackathon 2026 · Problem ID 26176 · ISRO / Department of Space**
Software · Space Technology

[![CI](https://github.com/tarang-shah-18/orca-marine-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/tarang-shah-18/orca-marine-assistant/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-2.0.0-blue)
![API%20keys](https://img.shields.io/badge/API%20keys-none-success)
![languages](https://img.shields.io/badge/languages-11-orange)

</div>

---

## What ORCA actually does

A fisher opens ORCA at 4 a.m. and asks, in Malayalam:

> *"ഇവിടെ നിന്ന് അടുത്തുള്ള മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?"*
> *(Where is the nearest place to catch fish from here?)*

ORCA detects the script, resolves the intent, plans a task graph, dispatches the
specialists that question actually needs, cross-checks their findings against each other,
and answers in Malayalam — with the chlorophyll reading, the sea-surface temperature, the
distance and the bearing all traceable to a named upstream product.

Then the fisher asks a follow-up: *"Is it safe to go there tomorrow?"* ORCA resolves
"there" to the zone it found two turns ago, adds weather, ocean, alert and risk
specialists, runs a **second round** because the risk agent requested a re-check of the
squall window, and returns a weighted verdict with named reasons.

It never says "safe". It ranks evidence, says what it is unsure about, and defers to IMD,
INCOIS and the port authority.

---

## The eight canonical capabilities

Every one of these is answered by the live pipeline, and each is available as a one-tap
chip in all eleven languages (`GET /api/scenarios`).

| # | Capability | Example intent | Agents dispatched |
|---|---|---|---|
| 1 | **Nearest Potential Fishing Zone** | *"Where is the nearest fishing zone from here?"* | GIS → PFZ → Ocean |
| 2 | **Go / no-go for tomorrow** | *"Is it safe to go fishing tomorrow morning?"* | Weather, Ocean, Tide, Alert, Risk |
| 3 | **Tide, weather and sea near a location** | *"What are the tide, weather and sea conditions near my spot?"* | Tide, Weather, Ocean |
| 4 | **Lightning, squall and cyclone warnings** | *"Is there any lightning, storm or cyclone warning for my coast?"* | Alert, Weather, Ocean |
| 5 | **High chlorophyll + favourable SST** | *"Where is the chlorophyll high and the SST favourable?"* | PFZ, Ocean, Historical |
| 6 | **Safest route for a vessel** | *"What is the safest route to reach the fishing zone?"* | GIS, Ocean, Weather, Route, Geofencing, Risk |
| 7 | **Why fish productivity declined** | *"Why has fish productivity declined in my harbour?"* | Historical, PFZ, Ocean |
| 8 | **Zones to avoid (hazard + geofencing)** | *"Which zones should I avoid before going out to sea?"* | Geofencing, Alert, GIS |

`src/core/intent.ts` recognises **12 intents** in total, so these eight are the common
paths rather than a closed list — anything else falls through to a full marine picture.

Beyond the eight, two larger-scale functions are built in:

- **Departure-window risk trajectory** — every go/no-go answer carries the same weighted
  matrix re-run per forecast band (now · +6 · +12 · +24 · +36 · +48 h): *when* is the
  least-risky window to sail, and is the coast easing or tightening? Rendered as a
  risk strip in the chat bubble and in the situation card.
- **Fleet Watch** (`GET /api/fleet`, "Fleet Watch" tab) — the whole coast on one screen:
  one weighted posture per harbour for all 13 ports, worst first, with the counts, the top
  advisory in each influence area and an honest live/reference flag per harbour.

---

## Architecture

There is **one** agentic engine. It is written in pure TypeScript with no Node-only APIs,
which is what lets the identical code run on the server *and* inside the browser as a
fallback when the server cannot be reached.

Before any agent runs, the orchestrator warms a **live snapshot** for the active harbour
(`src/core/live.ts` — Open-Meteo + GDACS fetches with a TTL cache and per-product flags).
Agents consume that snapshot through `src/core/dataAccess.ts`, which falls back to the
reference dataset when a feed is unreachable. One codebase, two honest modes.

```
                        ┌───────────────────────────────┐
   fisherman ────▶      │   src/core/intent.ts          │
   (11 languages)      │   language.ts · i18n.ts       │  detect script →
                        │   12 intents · slot values    │  resolve intent
                        └───────────────┬───────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │   agents/planner.ts          │  intent → task graph
                        │   buildPlan() · BASE_ROSTER   │  → agent roster
                        └───────────────┬───────────────┘
                                        ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  agents/*  —  run in dependency order over a shared `artifacts`         │
   │  blackboard. Any agent may request collaboration from a peer.           │
   │                                                                        │
   │  1  GIS          anchor, distance, bearing, offshore distance          │
   │  2  PFZ          chlorophyll-a + SST fronts → fishing ground           │
   │  3  Weather      IMD coastal forecast, squall, lightning               │
   │  4  Ocean        INCOIS sea state, Douglas coding, currents            │
   │  5  Tide         7 harmonic constituents, departure windows            │
   │  6  Alert        squall · lightning · cyclone · high wave · surge      │
   │  7  Geofencing   statutory boundaries, MPAs, buffers, track check     │
   │  8  Route        great-circle vs inshore vs offset, 5-step search      │
   │  9  Risk         weighted, explainable verdict + safety score          │
   │  10  Historical  trend, lagged correlation, CPUE diagnosis             │
   │  11  Visualize   chart + geospatial payloads                           │
   └───────────────┬────────────────────────────────────────────────────────┘
                   │  ── round 2: follow-ups requested by round 1 ──
                   ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  12  Synthesizer   evidence ledger + findings → answer text           │
   │  13  Critic        audits the RENDERED text: strips over-promising     │
   │                    language, forces ORANGE/RED escalation, guarantees  │
   │                    the IMD/INCOIS/port-authority deferral sentence     │
   └────────────────────────────────────────────────────────────────────────┘
                   ▼
        OrchestrationResult  (one object the whole system agrees on)
             │                    │                     │
             ▼                    ▼                     ▼
      POST /api/chat      /api/chat/stream       GET /api/{data}
      (one answer)        (SSE, live trace)      (one agent at a time)
```

### Repository layout

```
server.ts                  Express entry: API, Vite middleware in dev, static dist/ in prod
src/
  types.ts                 the single domain model, shared by server and client
  core/
    geo.ts                 WGS-84 geodesy — haversine, bearings, polygons, offsets
    dataset.ts             reference snapshot (offline fallback) + static catalogues
    live.ts                real-time layer: Open-Meteo + GDACS, TTL cache, per-product flags
    dataAccess.ts          live-first seam the agents read through (falls back to dataset.ts)
    language.ts            script-range + romanised detection for 11 languages
    i18n.ts                phrasebook, risk vocabulary, headline keys
    intent.ts              12 intents, weighted n-gram lexicons, slot resolution
  agents/                  base · planner · 11 specialists · synthesizer · critic · orchestrator
  server/
    routes.ts              22 endpoints, SSE, banner summarisation, live-refresh hooks
    context.ts             untrusted-input coercion, buildContext(), runChain()
    session.ts             in-process conversation store (LRU + 2 h TTL)
    scenarios.ts           the 8 capabilities × 11 languages
    gemini.ts              optional AI layer
  components/              chat · home · map · info · trace · charts · tides · route · geofence
  services/
    orcaApi.ts             the client's only network boundary
    speechService.ts       SpeechRecognition / SpeechSynthesis per language
  App.tsx                  single state owner
mobile/                    Expo React Native client for Android
```

---

## Quick start

```bash
git clone <repo> && cd orca-marine-assistant
npm install
cp .env.example .env      # optional — the engine works without any key
npm run dev               # → http://localhost:3000
```

`npm run dev` runs `tsx server.ts`, which serves the API **and** mounts Vite in
middleware mode, so one command gives you the whole product with hot reload.

| Command | What it does |
|---|---|
| `npm run dev` | API + Vite dev server on `:3000` |
| `npm run build` | `vite build` for the client, `esbuild` bundle for the server |
| `npm start` | Serve `dist/` and `dist/server.cjs` from a single Node process |
| `npm test` | Offline unit tests, then the full-surface regression sweep (engine, 11 languages, endpoints, SSE) |
| `npm run test:unit` | Fast deterministic unit tests (geodesy, advisory expiry/headline rules, i18n integrity) — no server needed |
| `npm run test:sweep` | The 3306-check integration sweep (start the server first) |
| `npm run lint` | `tsc --noEmit` |
| `npm run clean` | Remove `dist/` and stray server output |
| `docker build -t orca .` | Two-stage container: Vite + esbuild build, production-only runtime image |

### Regression sweep

`npm test` runs the offline unit tests first (geodesy edges, advisory expiry and
headline rules, i18n integrity across all 11 languages — `scripts/unit-tests.ts`), then
the full-surface sweep (`scripts/test-sweep.ts`) — currently **3306 checks, all green**:

- every harbour × intent battery through the **real** engine (no mocks),
- the 8 canonical capabilities × all 11 languages,
- every persona's quick asks and every vessel profile,
- visualisation invariants (no render-blocking "contentless" layer),
- every HTTP endpoint against the running server, including the SSE `/chat/stream`
  (asserts the `done` frame always arrives).

Start the server first (`npm run dev`), then `npm test`. Exit code `0` = all green;
`1` = at least one check failed. The same sequence runs in CI (`.github/workflows/ci.yml`)
on every push.

Verify it is alive:

```bash
curl localhost:3000/api/health
curl localhost:3000/api/status        # agent roster, inventory counts, AI layer
```

### Ask it something

```bash
curl -X POST localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"कल सुबह मछली पकड़ने जाना सुरक्षित है?","harbor":"mumbai"}'
```

```bash
# …or watch the agents work, live
curl -N -X POST localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is the safest route to the fishing zone?","harbor":"kochi","vessel":"motorized_dinghy"}'
```

---

## Configuration

Every variable is optional — see [`.env.example`](.env.example) for the annotated list.

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | *(unset)* | Enables the optional AI layer |
| `GOOGLE_API_KEY` | *(unset)* | Accepted as an alias for the above |
| `ORCA_GEMINI_MODEL` | `gemini-2.5-flash` | Model override |
| `PORT` | `3000` | API + client port |
| `APP_URL` | *(any origin)* | Comma-separated CORS allowlist |
| `VITE_API_BASE` | `/api` | Build-time web-client API origin for split hosting (Vercel client + remote engine); same-origin when unset |
| `ORCA_DATA_CYCLE_PIN` | *(unset)* | Pin the engine's reference cycle to a fixed ISO instant for reproducible answers |
| `ORCA_SESSIONS_FILE` | *(unset)* | Persist conversation sessions to JSON across restarts (in-memory otherwise) |
| `ORCA_RATE_MAX` | `120` | Chat requests per IP per window |
| `ORCA_RATE_WINDOW_MS` | `60000` | Chat rate-limit window |
| `ORCA_TRUST_PROXY` | *(unset)* | `1` only behind a reverse proxy — lets the rate limiter read `X-Forwarded-For` |

### Deployment

The two-stage [`Dockerfile`](Dockerfile) builds the client with Vite and bundles the server
with esbuild, then keeps only production dependencies in the runtime image:

```bash
docker compose up -d --build          # full stack: build, healthcheck, volumes, restart
# or, bare:
docker build -t orca .
docker run -p 3000:3000 orca
```

No API key is needed. `docker compose` also mounts a named volume for
`ORCA_SESSIONS_FILE` (conversations survive container restarts), restarts the service on
failure, and runs the liveness `HEALTHCHECK` against `/api/health`.

On a bare VM without Docker, run the built server under a process manager:

```bash
npm run build
pm2 start ecosystem.config.cjs        # logs → logs/, restart on crash/OOM
pm2 save && pm2 startup               # survive reboots
```

Both paths harden the same way in code: security headers (+ strict CSP on the built
client), per-request access log, `nosniff`/frame/referrer/policy headers, JSON errors for
malformed bodies and unknown `/api` paths, graceful shutdown, docker healthchecks, and
`.github/workflows/ci.yml` (lint → unit tests → build → 3306-check sweep) on every push.
Tune `APP_URL` (CORS allowlist) and put TLS on a reverse proxy in front of the container;
set `ORCA_TRUST_PROXY=1` there so the rate limiter sees real client IPs.

#### Hosting split — Vercel client + Render engine (recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tarang-shah-18/orca-marine-assistant)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftarang-shah-18%2Forca-marine-assistant&env=VITE_API_BASE&envDescription=ORCA%20engine%20API%20origin%2C%20e.g.%20https%3A%2F%2Fyour-engine.onrender.com%2Fapi&project-name=orca-marine-assistant)

The engine must stay a single long-lived Node process (in-memory live-data caches,
per-IP rate limiter, optional session file), so it does **not** fit serverless
functions: Vercel could never hold the SSE `/chat/stream` (15 s heartbeats, 5-minute
deadlines) or the in-memory state. The clean way to use Vercel is to serve the client
from it and keep the engine on any long-lived host — Render is the lowest-friction
option:

1. **Engine on Render.** Dashboard → New → Blueprint → select this repo; the
   [`render.yaml`](render.yaml) builds the Dockerfile, health-checks `/api/health`, and
   keeps one instance alive. Set `APP_URL` to the Vercel client origin once it exists.
   (Free tier spins down after idle — live data re-fetches on wake and in-memory
   sessions reset; expected and harmless, data honesty is preserved by design.)
2. **Client on Vercel.** Import the repo; Vercel reads [`vercel.json`](vercel.json),
   which pins `build:client` (`vite build`), outputs `dist/`, adds SPA fallback plus the
   same security headers/CSP the self-hosted server sends. In *Project → Settings →
   Environment Variables* set `VITE_API_BASE` to the engine origin, e.g.
   `https://orca-engine.onrender.com/api`, and redeploy.
3. **Why this doesn't break anything.** The mobile build and the same-origin server
   deploy keep using `/api` (the default), so `npm run dev`, `npm start` and the Docker
   path are untouched. `VITE_API_BASE` is only honored when set, and it points at the
   engine directly — the SSE stream flows client → engine without passing through
   Vercel, so heartbeats and streaming are unaffected.

### The AI layer is genuinely optional

The engine is deterministic and complete without an LLM. When a key is present, Gemini
does exactly two things:

1. rewrites the planner's rationale into clearer prose, and
2. rewrites the synthesised answer from the evidence ledger.

It is bound by seven non-negotiable rules: it may **add** agents to the roster but never
remove one, it may not invent a number that no agent produced, it may not remove the
disclaimer, it may not claim safety, it may not drop the sources, and it must preserve
every structured product. If the key is missing, invalid, or the API times out, the
deterministic synthesiser is used and the answer is flagged `aiGenerated: false`.

---

## Languages

Eleven, with **detection** rather than a required mode switch.

| | | | |
|---|---|---|---|
| English (`en-IN`) | हिन्दी (`hi-IN`) | मराठी (`mr-IN`) | ગુજરાતી (`gu-IN`) |
| ಕನ್ನಡ (`kn-IN`) | മലയാളം (`ml-IN`) | తెలుగు (`te-IN`) | தமிழ் (`ta-IN`) |
| বাংলা (`bn-IN`) | ଓଡ଼ିଆ (`or-IN`) | ਪੰਜਾਬੀ (`pa-IN`) | |

Detection works in two passes, because romanised text defeats a pure script check:

1. **Script range** — Devanagari, Gujarati, Kannada, Malayalam, Telugu, Tamil,
   Bengali, Oriya and Gurmukhi codepoint ranges, plus Latin for English.
2. **Romanised scoring** — a weighted n-gram lexicon per language, so
   `"machli kahan hai"` scores Hindi above English and `"மீன் எங்கே"` scores Tamil.

The phrasebook is slot-based rather than a list of hand-written sentences: templates with
language-neutral numbers and units, so a wave height of 2.4 m reads correctly in Malayalam
and in Punjabi without a separate translation for every possible value.

---

## Data sources

ORCA's readings are **live, real-time data** from public authoritative feeds whenever the
network permits, served through a small live layer (`src/core/live.ts`) with a TTL cache
(~12 min), a never-throwing fetch policy, and a **per-product live/offline flag** so nothing
is ever silently fake. Agents and data endpoints read through the live-first seam
(`src/core/dataAccess.ts`); when a feed is unreachable, the product degrades to the
deterministic reference snapshot in `src/core/dataset.ts` and is flagged as such in the
answer, the evidence table and `/api/status`.

| Product | Live source (reachable, keyless) | Offline fallback | Consumed by |
|---|---|---|---|
| Weather (wind, gusts, visibility, rain, lightning) | **Open-Meteo Forecast API** — ECMWF IFS HRES, 3-day hourly | Reference IMD-style coastal snapshot | Weather agent |
| Sea state (waves, swell, period, SST, currents) | **Open-Meteo Marine API** — WaveWatch-III + ocean model | Reference INCOIS OSF snapshot | Ocean agent |
| PFZ grounds (SST anomaly + chlorophyll) | **Live SST/currents per advisory ground** blended with **MODIS-Aqua regional chlorophyll climatology** | Reference PFZ advisory | PFZ agent |
| Productivity hotspot grid | **Live marine scan** over a 16-cell satellite-style grid | Seeded hotspot field | PFZ / Historic agents |
| Historical productivity series (36 mo) | **Open-Meteo Archive API** — ERA5 reanalysis (ECMWF/C3S): SST, wind, rainfall | Seeded series | Historical agent |
| Cyclone / disaster events | **GDACS** (UN / European Commission) 7-day RSS — live cyclone tracks | Seeded IMD cyclonic-watch | Alert agent |
| Tides | **ORCA harmonic prediction** — 13 stations × 7 constituents, anchored to the live instant (real Fourier sum, parabolic extremum refinement) | Same model, reference epoch | Tide agent |
| Geofences & hazard cells | **ORCA maritime boundary database** (statutory boundaries, MPAs, ESZs — static by law) | Same | Geofencing / Route agents |

Every figure rendered anywhere carries the source it came from — in the chat answer, in the
evidence table, in the API response, and in the app's info panel. `/api/status` reports the
live feed state per product and `/api/map-data` shows the live data cycle so a viewer can
always tell an observation from a model.

**Why these sources.** Open-Meteo runs the ECMWF IFS atmospheric model and the WaveWatch-III
wave model with a free, keyless API that is reachable from the demo network; GDACS publishes
the UN's official disaster alert feed; ERA5 is the ECMWF/Copernicus reanalysis — the
standard reference for marine climatology. Satellite ocean-colour chlorophyll for the
Indian Ocean (INCOIS/ERDDAP) was verified unreachable from the demo network, so chlorophyll
is reconstructed honestly as *regional MODIS-Aqua climatology blended with live SST and
currents* — the same physical variables a satellite retrieval is built from, and labelled
as a blend rather than a direct retrieval.

---

## API

All routes are under `/api`. Responses are `{ status, apiVersion, data, timestamp }` on
success and `{ status: 'error', error }` on failure; `POST /api/chat` returns the result at
the top level alongside the session id.

### Conversation

| Endpoint | Purpose |
|---|---|
| `POST /api/chat` | Full pipeline. Body: `message`, `language`, `sessionId`, `harbor`, `latitude`, `longitude`, `vessel` |
| `POST /api/chat/stream` | The same pipeline as SSE — the agent trace in the UI is the real event stream |
| `GET /api/situation` | Proactive brief: current risk, advisories, nearest zone, conditions |
| `POST /api/session/reset` | Clear conversation memory for a session |

### Reference & operations

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness (process up) |
| `GET /api/ready` | Readiness: which data mode the API would serve right now (`live`/`reference`) |
| `GET /api/status` | Roster, inventory counts, AI layer, data cycle, **live feed status per product**, session count |
| `GET /api/agents` | Roster plus which specialists are actually wired up |
| `GET /api/languages` | The 11 languages and their speech tags |
| `GET /api/harbors` | 13 harbours, 6 vessel classes |
| `GET /api/scenarios` | The 8 capabilities, in all 11 languages |
| `GET /api/metrics` | Minimal Prometheus exposition: request/response counters, latency, sessions, live-product gauge |

### Marine data

`/pfz` · `/hotspots` · `/weather` · `/ocean` · `/tides` · `/alerts` · `/geofences` ·
`POST /geofence/check` · `/route` · `/historical` · `/map-data`

Each of these builds the same context a chat turn would and runs the **same real agent**.
`/api/weather` and the weather paragraph inside an answer are computed by one piece of
code from one set of inputs, so they cannot disagree.

### Fleet intelligence

| Endpoint | Purpose |
|---|---|
| `GET /api/fleet` | **Coast-wide posture**: one weighted risk snapshot per harbour (13), worst first, with counts, top advisory, nearest PFZ and a live/reference flag per harbour. `?vessel=` switches the fleet's dominant class. |

Fleet Watch matters because ORCA's chat is harbour-bound by design. `fleetOverview()`
re-runs the same weighted risk matrix the risk agent uses for every harbour at once —
no full orchestration per port — so a fisheries department or disaster cell sees the
whole coast before any one harbour is tapped. A snapshot is honest about which harbours
degraded to the reference data (`reference: true`).

Chat answers also carry a **departure-window risk trajectory** (`riskTrajectory`):
the identical matrix re-run per forecast band (now · +6 h · +12 h · +24 h · +36 h ·
+48 h), naming the least-risky window to sail and whether conditions ease, hold or
tighten. The verdict's escalation floor and the trajectory share one rule, so a strip
can never contradict a badge.

---

## The safety standard

This is a marine-safety product, so the safety framing is enforced in code rather than
left to whoever writes the prompt.

**The critic agent runs last, on the rendered text** — not on the intent, not on the
findings, on the words the fisher will actually read. It:

- replaces over-promising language (*"completely safe"*, *"guaranteed"*, *"risk-free"*)
  with calibrated phrasing;
- forces the advisory level **up** — never down — to at least ORANGE whenever a RED or
  ORANGE bulletin is in force anywhere near the track;
- guarantees the answer ends by deferring to **IMD, INCOIS and the port authority**;
- appends a timestamp naming the data cycle the answer was computed from;
- never edits a number, a distance or a source — it can only change framing and escalate.

And because it is the last step, **Gemini cannot bypass it**. The AI layer runs before the
critic, so an over-confident LLM draft still gets audited before a fisher sees it.

The refusal to guarantee safety is also structural: the domain model has no
`isSafe: boolean`. The strongest thing the system can say is
`riskLevel: 'SEVERE'` plus a set of named reasons, and `safetyScore` is explicitly
documented as a ranking aid, not a certificate.

---

## Clients

### Web (`src/`)

A thin renderer over the API. `App.tsx` is the single state owner; screens never fetch
directly, and `src/services/orcaApi.ts` is the only network boundary.

If the server is unreachable, `orcaApi.ts` **re-runs the entire engine in the browser**
using the same modules and flags the answer `offline`. The product never shows a dead
screen, and never shows a fabricated number to cover for a dead server.

Screens: **Home** (proactive brief, harbour, language, GPS), **Chat** (live trace, evidence,
charts, TTS, voice input, 8 capability chips), **Map** (Leaflet: 4 switchable basemaps —
CARTO Voyager / Esri satellite / CARTO Dark / OSM — plus fishing zones, live productivity
hotspots, advisories, statutory boundaries, port markers, reach rings, wind/swell/current
vectors and the animated scored corridor), **Info** (agent roster, engine status, coverage).

Charts are hand-rolled SVG rather than a charting library — it keeps the coastal-3G bundle
small, which matters for the target device.

### Android (`mobile/`)

Expo / React Native. Five screens: Home, Chat, Map, Conditions (tide + weather + sea +
geofences), Info. SSE is read with `XMLHttpRequest` + `onprogress` because React Native's
`fetch` does not expose a readable response body, with a fallback to `POST /api/chat` —
the same pipeline, the same result.

```bash
cd mobile
npm install
npx expo start              # emulator reaches the engine at 10.0.2.2:3000
eas build -p android --profile preview
```

The phone needs no configuration on an emulator. On a physical phone, set the LAN address
once in `mobile/src/services/api.js` (or `EXPO_PUBLIC_ORCA_API`).

See [`mobile/README.md`](mobile/README.md) for the full build and install guide.

---

## A note on data honesty

ORCA is a decision-support prototype, and its honesty contract is enforced in code:

- **Live when the network permits.** Weather, sea state, PFZ grounds, the hotspot grid, the
  historical series and cyclone events are fetched from the public real-time sources
  described above (Open-Meteo ECMWF/WaveWatch-III/ERA5, GDACS). The readings a fisher sees
  are the readings those models published.
- **Never silently fake.** Every product carries a live/offline flag and a named source. If
  a feed is unreachable, ORCA degrades to the deterministic reference snapshot in
  `src/core/dataset.ts` and *says so* — the data-cycle strip switches to
  "browser-bundled deterministic dataset" and answers are flagged offline.
- **Modelled work is labelled.** Tides are genuine harmonic summation (Fourier series over
  published constituent sets with parabolic extremum refinement) — labelled "harmonic
  prediction". Chlorophyll is a MODIS-Aqua regional climatology blended with live SST and
  currents — labelled as a blend, not a direct satellite retrieval. Geofencing is
  statutory data (point-in-polygon is real).
- **Bulletins expire the moment they lapse.** The alert agent, the risk agent's escalation
  floor and the departure-window trajectory all share one currency rule
  (`src/core/alerts.ts`): an advisory governs only while it is inside the influence radius
  *and* within its `validUntil` window. A lapsed cyclone is reported in the trace as
  expired and stops pinning verdicts — it is never silently dropped.
- **Advisories are region-scoped.** Each harbour leads with its own in-force bulletins
  (Kerala high waves for Kochi, Konkan lightning for Mumbai, Saurashtra surge for Veraval,
  …) with live basin-wide events — real GDACS cyclones with per-region distance and
  bearing — layered on top rather than replacing local warnings.
- **The "live" label is TTL-gated.** The data-cycle strip only shows `Live · …` for a
  fresh (< 12 min) snapshot that actually received at least one live product; a lapsed or
  wholly-offline refresh switches it to `Reference snapshot · offline`, and `/api/status`
  reports the live flag per product.
- **The reasoning is real regardless.** WGS-84 geodesy, harmonic tide prediction, linear
  regression and lagged-correlation productivity diagnosis, corridor routing, point-in-
  polygon geofencing, and the 13-agent collaborative orchestration all run on whatever data
  is present.

---

## Production readiness — what's hardened, what's yours

The engineering is production-shaped: **deterministic engine, 3306-check regression +
unit-test gate in CI, real multi-source live data with honest degraded fallbacks**, a
hardened server (security headers, strict CSP on the built client, JSON 404/400/500 errors
that never leak stack traces, per-IP chat rate limiting, SSE heartbeat with a stream
deadline, graceful shutdown), a versioned API envelope (`apiVersion`), `/api/health` +
`/api/ready` + `/api/metrics`, Docker + compose (healthcheck, session volume, restore-on-
failure), a PM2 ecosystem file, and optional persistence for conversations.

Three things remain on the operator, not the codebase:

1. **TLS + DNS.** Put the container behind a reverse proxy (caddy/nginx) with HTTPS, set
   `APP_URL` to that origin for the CORS allowlist, and set `ORCA_TRUST_PROXY=1` so the
   rate limiter sees real client IPs.
2. **Authoritative advisory data.** This build is an honest, self-contained decision-support
   layer: weather/sea/cyclones come from named public feeds, and reference bulletins are
   curated, verbatim, expiry-driven seeds. Issuing *official* advisories to the public
   requires the IMD/INCOIS data agreements and AIS feeds tracked in `TODO.md` — they are
   blocked items, not hidden behind a facade.
3. **Capacity.** One instance holds the in-memory live cache and session store. That is the
   right shape for a district deployment; a multi-instance pool needs sticky sessions or
   the shared session store noted in `TODO.md`.

With HTTPS in front, `docker compose up -d --build` is a deployable unit.

---

## Project history

The repository previously shipped a second, parallel FastAPI backend in `backend/`
alongside the TypeScript engine. Two backends answering the same `/api/chat` with
different agent counts, different language support and different data meant the deployed
product depended on which one happened to be running. It has been removed: the TypeScript
engine in `server.ts` is the single implementation, and it covers strictly more — 13
agents against 7, script-and-lexicon language detection with the answer returned in the
fisher's own language against keyword matching that only ever replied in English, plus
real tides, real geofencing, real productivity diagnosis, a synthesis stage and a safety
critique, none of which the Python duplicate had.

---

## Roadmap

The prioritised backlog lives in [`TODO.md`](TODO.md). The **P0 safety/correctness cluster
is closed** — real bulletin expiry (`validUntil` now lapses), an honest headline rule
(nearest alert only within a 250 km local horizon, never a far-away basin event), bounded
live caches, per-IP chat rate limiting, and hardened SSE (heartbeat + deadline) — alongside
the engine/ops items: pinable reference cycles, persisted sessions, a versioned API
envelope, graceful shutdown, Docker, `/api/ready` and `/api/metrics`.

Remaining items are the externally-gated data upgrades (real tide-gauge phases, live
ocean-colour chlorophyll, IMD/INCOIS bulletin feeds, AIS fleet positions — all need
licensed/reachable sources) and the larger product features (PWA offline shell, push
notifications, advisory polygons, multi-stop routes).

---

## License

Built for the fishermen of the Indian coast.
