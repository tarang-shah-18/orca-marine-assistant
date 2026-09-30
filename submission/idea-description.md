# ORCA — Marine Ecosystem Reasoning with Collaborative Agents

**Smart India Hackathon 2026 · Problem ID 26176 · ISRO / Department of Space**
Software · Space Technology · Version 2.0.0

---

## 1. The problem

India has one of the world's largest artisanal fishing fleets and among its most
exposed. A day-boat skipper leaving Mumbai, Kochi or Visakhapatnam makes a
go/no-go decision using what is reachable: a glance at the sky, a radio bulletin,
a memory of the season. The authoritative answers exist, but they are fragmented
across at least five institutions (IMD marine weather, INCOIS ocean state and
alerts, the port authority, the fisheries department, GDACS for international
disasters), published in different formats, on different schedules, in English.

Three failures follow, and all three cost lives:

1. **Fragmentation.** A squall warning, a high-wave warning and a cyclone watch
   live in three different systems. A fisher who reads two of the three still
   acts on an incomplete picture.
2. **Language.** IMD and INCOIS publish in English and Hindi. The fisher asking
   is often speaking Malayalam, Kannada, Tamil or Odia. There is no translation
   layer in the official chain, so the data is technically public and practically
   inaccessible.
3. **Silent fabrication.** Even where a model or an app does answer, a missing
   value is routinely rendered as a number. A null wave height becomes 0.0 m. A
   missing sea-surface temperature becomes 0 degrees. The output looks
   confident, is visually indistinguishable from a real measurement, and is
   exactly the case where a fisher must be told "I don't know".

ORCA is built around the third failure as much as the first two. A system that
answers confidently when it should abstain is worse than no system at all.

## 2. What ORCA is

A conversational decision-support system. The fisher asks a question in their own
language and script, at 4 a.m., on a phone, with one hand on the tiller:

> *"ഇവിടെ നിന്ന് അടുത്തുള്ള മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?"*
> *(Where is the nearest place to catch fish from here?)*

ORCA detects Malayalam script, resolves the intent, plans a task graph, dispatches
GIS → PFZ → Ocean, cross-checks the three findings, and answers in Malayalam with
the chlorophyll reading, sea-surface temperature, distance and bearing each
attributed to a named product.

It then holds that context. A follow-up — *"Is it safe to go there tomorrow?"* —
resolves "there" to the zone found two turns earlier, adds weather, ocean, alert
and risk specialists, runs a **second round** because the risk agent requested a
re-check of the squall window, and returns a weighted verdict with named reasons.

**ORCA never says "safe."** It ranks evidence, states what it is unsure about, and
defers to IMD, INCOIS and the port authority. This is enforced in code, not by
prompting: see §6.

## 3. How it works

One agentic engine, written in pure TypeScript with no Node-only APIs. That
constraint is deliberate — it is what lets the identical core run on the server
*and* inside the browser as a fallback when the server cannot be reached, so a
fisher with no connectivity still gets an answer (clearly flagged offline).

```
   fisher ────▶  intent.ts · language.ts · i18n.ts
   (11 langs)     detect script → 12 intents → slot values
                        │
                        ▼
                 planner.ts ── intent → task graph → agent roster
                        │
                        ▼
   ┌────────────────────────────────────────────────────────────┐
   │  11 specialists run in dependency order over a shared      │
   │  `artifacts` blackboard. Any agent may request a second    │
   │  round from a peer.                                         │
   │   1  GIS          anchor, distance, bearing, offshore dist  │
   │   2  PFZ          chlorophyll-a + SST fronts → fishing zone │
   │   3  Weather      forecast, squall, lightning, visibility   │
   │   4  Ocean        sea state, Douglas coding, currents      │
   │   5  Tide         7 harmonic constituents, departure window│
   │   6  Alert        squall · lightning · cyclone · high wave │
   │   7  Geofencing   statutory boundaries, MPAs, buffers      │
   │   8  Route        great-circle vs inshore vs offset search  │
   │   9  Risk         weighted, explainable verdict + score     │
   │  10  Historical  trend, lagged correlation, diagnosis      │
   │  11  Visualize   chart + geospatial payloads                │
   └──────────────────────────┬─────────────────────────────────┘
                              │  ── round 2: peer follow-ups ──
                              ▼
                 synthesizer ── evidence ledger → answer text
                              │
                              ▼
                 critic ── audits the RENDERED text
```

**Registered agents (13):** `PLANNER`, `GIS`, `PFZ`, `WEATHER`, `OCEAN`, `TIDE`,
`MARINE_ALERT`, `GEOFENCING`, `ROUTE_OPTIMIZATION`, `RISK_VALIDATION`,
`HISTORICAL_ANALYSIS`, `VISUALIZATION`, `CRITIC`.

**Coverage:** 13 harbours (Sassoon Dock Mumbai → Digha Mohana Belta, West Bengal),
a 14-zone potential-fishing-zone catalogue, 14 statutory and ecological boundaries,
6 vessel classes (country boat, motorized dinghy, gillnetter, trawler, purse seiner,
deep sea trawler), 12 intents.

**Risk model.** A weighted matrix over per-agent severity notes. Weights are
deliberately conservative and reflect consequence, not confidence:
`MARINE_ALERT 34 · WEATHER 22 · OCEAN 22 · GEOFENCING 14 · ROUTE 12 · TIDE 8 ·
PFZ 4` (unknown contributor defaults to 6). The matrix only ever escalates; a
single RED advisory is sufficient to force escalation regardless of the aggregate.

**Sea-state coding.** Wave height is classified by the Douglas sea-state scale,
and the same thresholds drive the UI, the risk model and the test suite, so the
number a fisher reads and the severity the model scored cannot disagree.

**Tides.** Seven standard harmonic constituents (M2, S2, N2, K1, O1, P1, M4) per
station, combined into high/low tide events, current level and a recommended
departure window.

## 4. The eight capabilities

Each is answered by the live pipeline and available as a one-tap chip in all 11
languages (`GET /api/scenarios`).

| # | Capability | Agents dispatched |
|---|---|---|
| 1 | Nearest potential fishing zone | GIS → PFZ → Ocean |
| 2 | Go / no-go for tomorrow | Weather, Ocean, Tide, Alert, Risk |
| 3 | Tide, weather and sea near a location | Tide, Weather, Ocean |
| 4 | Lightning, squall and cyclone warnings | Alert, Weather, Ocean |
| 5 | High chlorophyll + favourable SST | PFZ, Ocean, Historical |
| 6 | Safest route for a vessel | GIS, Ocean, Weather, Route, Geofencing, Risk |
| 7 | Why fish productivity declined | Historical, PFZ, Ocean |
| 8 | Zones to avoid (hazard + geofencing) | Geofencing, Alert, GIS |

## 5. Data honesty — the core engineering contribution

This is the part we would most like judged on, because it is the part that is
usually got wrong.

**Every product carries a live/reference flag and a named source.** The interface
shows which. `/api/ready` reports per-product liveness; `/api/status` publishes
the exact upstream failure reason, bounded and payload-free.

**An empty feed produces no reading at all.** Open-Meteo returns HTTP 200 with a
well-formed marine block in which every value is `null` where its model has no
grid cell — Digha, on the Bay of Bengal model edge, is a live example. The
original build averaged those nulls to zero and shipped "0.1 m waves, sea surface
0 °C" under a "real-time sea state" label. `buildOcean` now returns `null` when
no hour is usable, per-window averages skip empty hours, and the product falls
back to a labelled reference snapshot. The same guard was applied to weather,
where a present-but-null block would otherwise have invented dead-calm 0 kt and
0.3 km visibility.

**Back-off is scoped to what actually failed.** A "no usable data" outcome is a
property of one *point*, so it parks only that point — otherwise one uncovered
harbour silently removed live sea state from every other harbour on the coast.
A `429`, by contrast, is the upstream throttling the whole account/IP, so it is
keyed by *host* and parks every product against that host, for one discovery call
and no more. Both behaviours are pinned by regression tests.

**Request volume is batched.** Sampling ~30 fishing-ground and hotspot points
through one comma-separated upstream call cut a cold refresh from 34 requests to
6, which is what keeps the free tier viable.

**A throttled or dead feed recovers by itself.** The engine backs off, reports the
standing reason, serves the labelled snapshot meanwhile, and retries when the
window lapses. It never fabricates to fill a gap.

## 6. Safety-critical design

- **The critic agent runs last and audits the rendered text**, not the internal
  state. It strips over-promising language, forces ORANGE/RED escalation when a
  severe advisory is present, and guarantees the deferral sentence to IMD, INCOIS
  and the port authority appears. Because it is the final step, the optional AI
  layer cannot bypass it.
- **The AI layer is genuinely optional.** When no key is configured, ORCA uses
  deterministic templates over the same agent outputs. The optional Gemini call
  is additive only, and cannot introduce a fact no agent produced.
- **Deferral is explicit.** The answer states that the vessel remains the master's
  decision and that official bulletins govern.
- **Severity colours are fixed, not themed.** Green/amber/orange/red are safety
  codes and read identically in daylight and at night.
- **The data cycle is bounded.** Reference bulletins carry expiry and are dropped
  when stale, so a cached advisory cannot outlive its validity.

## 7. Language and accessibility

11 Indian languages, full localisation of intent phrases, risk vocabulary, agent
findings, chart labels and UI chrome: English (IN), Hindi, Marathi, Gujarati,
Kannada, Malayalam, Telugu, Tamil, Bengali, Odia, Punjabi.

Detection is script- and code-aware, handles code-mixed input, and the regression
sweep asserts localisation integrity across all 11 on every commit. A
localisation regression is a build failure, not a cosmetic bug. Voice input and
speech output are included for hands-free deck-side use.

## 8. Technology

React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · Express 4 · Leaflet ·
lucide-react · Motion · `@google/genai` (optional). Pure TypeScript core, no
Node-only APIs, so server and browser share one implementation.

**Deployment (live, zero cost, no API keys):**
- Client — Vercel
- Engine — Render (holds the in-memory live-data caches, chat rate limiter and
  the SSE `/chat/stream`; serverless platforms cannot)

**Live data sources (all keyless):** Open-Meteo Forecast API (ECMWF IFS), Open-Meteo
Marine API (WaveWatch-III + ocean circulation), Open-Meteo Archive API (ERA5
reanalysis), GDACS (UN / European Commission) 7-day disaster RSS.
**Labelled reference snapshots:** IMD-style coastal weather and warning bulletins,
INCOIS ocean state and early-warning products. Map tiles: OpenStreetMap and Esri.

## 9. What is built today, and what is not

Stated plainly, because an over-claim here would be the fastest way to lose
credibility with a technical jury.

**Working and live:** intent resolution in 11 languages; the 13-agent pipeline
with peer second rounds; weighted risk matrix with safety score; Douglas sea-state
coding; 7-constituent tide prediction with departure windows; 14-boundary
geofencing with buffer and track check; route search; chlorophyll/SST hotspot
detection over a batched marine grid scan; ERA5-backed 36-month productivity
trend with lagged correlation; chart and map visualisation; SSE streaming;
offline in-browser fallback; live/offline labelling throughout.

**Deliberately not faked.** These are the honest gaps, and each is blocked on a
licensed or unreachable source rather than on effort:

- **Live tide *phase* from real gauge telemetry.** Harmonic prediction runs from
  per-station constituent amplitudes; live water-level telemetry is not integrated.
- **Live satellite ocean-colour imagery.** Chlorophyll fronts are derived from
  marine-model SST and a published MODIS-Aqua climatology, not from a live raster.
- **Observed catch-per-unit-effort series.** The historical agent uses a
  deterministic seeded series, clearly labelled, not commercial fleet catch data.
- **Species-level advisories** are catalogue entries, not a live fisheries
  intelligence feed.
- **AIS vessel traffic.** The fleet module reasons over a declared vessel profile,
  not live AIS positions.
- **Digha sea state** permanently serves its labelled INCOIS reference, because
  Open-Meteo has no marine model cell at that point. A partial second source was
  considered and rejected: the only other keyless marine feed available carries
  wind and air temperature alone, so filling the remainder would have meant
  inventing gusts, visibility, rain probability and lightning. A complete labelled
  reference snapshot is the honest answer.

**Known operational condition.** The engine runs on a free host whose egress IP is
shared. Open-Meteo's free tier is counted per source IP, so that pool is
occasionally throttled by traffic ORCA never sent. When this happens weather, and
the alerts derived from it, serve their labelled IMD reference snapshot, `/api/status`
names the cause, and the feed recovers on its own. A dedicated host IP removes it.
We consider this correct failure behaviour rather than a defect: the alternative
would be inventing plausible numbers.

## 10. Impact and scalability

Artisanal fishers are the least-served users in Indian fisheries — small boats, no
AIS, no subscription data feed, often low literacy in English. ORCA is
phone-first, works at 3G, needs no account, no key and no installation, and stays
useful with connectivity lost.

The architecture generalises along the coast without modification: harbours,
fishing zones, boundaries, tide stations and vessel classes are data, not code.
The same pipeline supports the five role views already built — fisher, researcher,
coastal authority, disaster management and maritime authority — each reading the
same evidence ledger through a different lens.

## 11. Validation

- **49 offline unit tests** — geodesy edges, advisory expiry and headline rules,
  localisation integrity across all 11 languages, reference-dataset integrity,
  live sea-state honesty, batched point sampling, and back-off scoping.
- **3,306-check regression sweep** across the engine, all 11 languages, every REST
  endpoint, the chat path and the SSE stream.
- **Continuous integration** on every commit, with the localisation and
  product-token checks as hard gates.

Both suites are green on every commit, and the deployed build is the tested build.

---

**Live prototype:** https://orca-marine-assistant-three.vercel.app
