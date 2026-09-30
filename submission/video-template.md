# ORCA — SIH 2026 Demo Video Template

**Problem ID 26176 · ISRO / Department of Space · Software · Space Technology**
**Target length: 4 min 30 s (hard ceiling 5 min) · Aspect: 16:9 1080p**

---

## 0. The one rule for this video

**Show the system refusing to answer, not just answering.**

Every SIH demo shows a chatbot answering questions. Yours is the only one that
will show the system *declining* to invent a number, naming the upstream
failure, and falling back to a labelled reference. That single moment is worth
more than the other four minutes combined, because it is the thing a technical
judge cannot have seen in any other submission. Build the video around it.

---

## 1. Structure at a glance

| # | Section | Time | Purpose |
|---|---|---|---|
| 1 | Cold open | 0:00–0:12 | A real question, in Malayalam, answered in Malayalam |
| 2 | The problem | 0:12–0:45 | Three named failure modes |
| 3 | The system | 0:45–1:15 | Architecture, 13 agents, the pipeline |
| 4 | Live demo | 1:15–3:30 | Four capabilities, screen-captured |
| 5 | The honesty moment | 3:30–4:00 | The system refuses to fabricate |
| 6 | Impact + close | 4:00–4:30 | Who it serves, what it costs, closing line |

---

## 2. Scene-by-scene shooting script

### Scene 1 — Cold open (0:00–0:12)

**Visual.** Black screen. A phone screen recording fades in. The app is already
open on the Decision Chat view. A finger taps the Malayalam suggestion chip.

**On-screen text (lower third):**
`ഇവിടെ നിന്ന് അടുത്തുള്ള മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?`
`("Where is the nearest place to catch fish from here?")`

**What to capture.** The SSE stream arriving live — the `language` event, then
the `plan` event showing the agent roster, then the answer text rendering.
Do not cut this. Let the viewer watch the agents being dispatched.

**Voiceover (read this, ~28 words):**
> "A fisher in Kochi asks, in Malayalam, where the nearest fishing ground is.
> ORCA detects the script, plans the work, and answers in the same language —
> with every number traceable to a named source."

**Audio.** No music yet. Just the UI. Let the silence do the work.

---

### Scene 2 — The problem (0:12–0:45)

**Visual.** Cut to three phone screenshots side by side, each showing a different
official source: an IMD marine weather bulletin, an INCOIS ocean state product,
a GDACS cyclone alert. Then a red cross over each, one at a time.

**On-screen text, appearing one line at a time:**
```
The data exists. Three problems keep it from the boat.
1  FRAGMENTED — five institutions, five formats, five schedules
2  LANGUAGE — published in English and Hindi. The fisher speaks Malayalam.
3  SILENT FABRICATION — a missing value renders as 0.0 m. It looks like a reading.
```

**Voiceover (~70 words):**
> "India's artisanal fishers are among the most exposed in the world, and the
> least served. The authoritative forecasts exist, but they are fragmented
> across at least five institutions, published in English and Hindi to fishers
> who speak Malayalam, Kannada, Tamil and Odia — and where an app does answer, a
> missing value is routinely rendered as a number. A null wave height becomes
> zero metres. The output looks confident, is indistinguishable from a real
> measurement, and is exactly the case where a fisher must be told: I don't know."

**Audio.** Music enters here. Low, tense, minimal. Keep it under the voice.

---

### Scene 3 — The system (0:45–1:15)

**Visual.** Screen recording. Click the **Platform** tab. Scroll the agent
roster. Then cut to a static architecture diagram (provided below).

**On-screen text:**
```
13 AGENTS · 11 LANGUAGES · 13 HARBOURS · 14 FISHING ZONES · 14 BOUNDARIES
```

**Voiceover (~75 words):**
> "ORCA is a collaborative multi-agent system, not a single prompt chain. A
> planner resolves the intent and builds a task graph. Eleven specialists run in
> dependency order over a shared blackboard — GIS, ocean state, weather, tide,
> alert, geofencing, route, risk, historical, visualisation — and any agent can
> request a second round from a peer. A thirteenth agent, the critic, audits the
> rendered answer last. It strips over-promising language, forces escalation
> when a severe advisory is present, and guarantees the deferral to IMD, INCOIS
> and the port authority. Because it runs last, the AI layer cannot bypass it."

**Capture notes.** Pause on the agent roster for two full seconds. Judges read
screenshots; give them time.

---

### Scene 4 — Live demo (1:15–3:30)

**This is the meat. Four capabilities, ~30 seconds each. Do not narrate every
click — let the interface speak, and narrate only what the screen cannot say.**

#### 4a — Nearest fishing zone (1:15–1:45)

**Visual.** Dashboard. Tap the chip *"Where is the nearest fishing zone from here?"*

**Capture.** The map zooming to the PFZ, the distance and bearing readout, the
species label.

**Voiceover (~40 words):**
> "Anchored off Mumbai, ORCA resolves the nearest potential fishing zone,
> computes the geodesic distance and initial bearing, and reads the chlorophyll
> and sea-surface temperature from the live marine model. The answer names its
> source: Open-Meteo, WaveWatch-III."

#### 4b — Go / no-go (1:45–2:15)

**Visual.** Tap *"Is it safe to go fishing tomorrow morning?"*

**Capture.** The risk strip. The safety score. The weighted verdict with named
reasons. **Hold on the risk matrix.**

**Voiceover (~45 words):**
> "The safety question dispatches five specialists and returns a weighted
> verdict, not a yes. The matrix is deliberately conservative: a marine alert
> carries weight 34, weather and ocean 22 each, and a single red advisory forces
> escalation regardless of the aggregate. ORCA never says a location is safe.
> It ranks evidence, names what it is unsure about, and defers to the official
> bulletin."

#### 4c — The map (2:15–2:45)

**Visual.** GIS Map tab. Pan across the coast. Tap a boundary.

**Capture.** The 14 statutory and ecological boundaries with buffer rings. The
vessel track check.

**Voiceover (~40 words):**
> "Fourteen statutory and ecological boundaries — marine national parks, naval
> exercise areas, submarine cable corridors, offshore oil fields — each with a
> buffer and a live track check. A vessel crossing into a naval exercise area is
> flagged before it reaches the line, not after."

#### 4d — A second language (2:45–3:00)

**Visual.** Language modal. Switch to **தமிழ்**. Ask the same safety question.

**Voiceover (~25 words):**
> "The same pipeline, in Tamil. Eleven languages, full localisation of intent
> phrases, risk vocabulary, agent findings and chart labels — and a regression
> sweep that fails the build if any string drifts."

#### 4e — Fleet watch (3:00–3:30)

**Visual.** Fleet Watch tab. Six vessel classes.

**Voiceover (~30 words):**
> "Fleet Watch reasons over six vessel classes, from a country boat to a deep
> sea trawler, because the safe departure window for a dinghy is not the safe
> departure window for a trawler."

---

### Scene 5 — The honesty moment (3:30–4:00)

**This is the scene the video is for. Do not rush it. Do not add music.**

**Visual.** Screen recording. Open a harbour where the marine model has no grid
cell — **Digha**. Ask for sea state.

**Capture, in this exact order:**
1. The question being asked.
2. The answer arriving — and the source label reading **INCOIS Ocean State
   Forecast**, not "real-time".
3. The `/api/status` panel showing the upstream failure reason.
4. `/api/ready` showing the product flagged `live: false`.

**On-screen text:**
```
The model has no grid cell here.
ORCA does not average the nulls to zero.
It says so, names the cause, and serves a labelled reference instead.
```

**Voiceover (~55 words):**
> "Here is the part that matters. At Digha, the marine model has no grid cell.
> The upstream returns a well-formed response in which every value is null.
> A naive build averages those nulls to zero and reports '0.1 metres, sea
> surface zero degrees' under a real-time label. ORCA refuses. It reports no
> reading at all, names the upstream failure on the status endpoint, and serves
> a labelled INCOIS reference snapshot instead. It would rather say it doesn't
> know than invent a number a fisher might act on."

**Audio.** Silence, or a single held note. Then cut.

---

### Scene 6 — Impact + close (4:00–4:30)

**Visual.** A fisher on a boat, phone in hand (B-roll, or a staged shot). Then
a clean end card.

**On-screen text:**
```
ORCA — Marine Ecosystem Reasoning with Collaborative Agents
Smart India Hackathon 2026 · Problem 26176 · ISRO / Department of Space
Live at orca-marine-assistant-three.vercel.app
Zero cost · No API keys · 11 languages
```

**Voiceover (~45 words):**
> "Phone-first, works on 3G, needs no account and no key, and still answers
> when the connection is lost. The same engine serves five roles — fisher,
> researcher, coastal authority, disaster management, maritime authority —
> reading the same evidence ledger through different lenses. ORCA never
> guarantees safety. It ranks evidence, and names its sources."

**Audio.** Music resolves. Hold the end card for three seconds.

---

## 3. Architecture diagram (rebuild in your editor)

Use this for Scene 3. Keep it to one screen.

```
        fisher ──▶  INTENT · LANGUAGE · i18n
        (11 langs)   detect script → 12 intents → slots
                          │
                          ▼
                    PLANNER ── task graph → roster
                          │
   ┌──────────────────────┴──────────────────────────┐
   │  11 SPECIALISTS · shared blackboard             │
   │  GIS → PFZ → OCEAN → WEATHER → TIDE → ALERT     │
   │  → GEOFENCING → ROUTE → RISK → HISTORICAL       │
   │  → VISUALIZE                                    │
   │        └── round 2: peer follow-ups ──┘         │
   └──────────────────────┬──────────────────────────┘
                          ▼
                    SYNTHESIZER ── evidence ledger
                          ▼
                    CRITIC ── audits the rendered text
                          │
                          ▼
              LIVE  Open-Meteo · ERA5 · GDACS
              REF   IMD · INCOIS (labelled)
```

---

## 4. Shot list

Record these in order. Total capture time: about 25 minutes.

| # | Shot | View | Notes |
|---|---|---|---|
| 1 | Malayalam question + stream | Decision Chat | Uncut SSE arrival |
| 2 | Three official sources | Screenshots | IMD, INCOIS, GDACS |
| 3 | Agent roster | Platform tab | Pause 2 s |
| 4 | Nearest PFZ | Dashboard + map | Distance, bearing, species |
| 5 | Go / no-go | Dashboard | Hold on risk matrix |
| 6 | Boundaries | GIS Map | Pan, tap a boundary |
| 7 | Tamil switch | Language modal | Same question |
| 8 | Fleet classes | Fleet Watch | Six vessel types |
| 9 | **Digha refusal** | Dashboard + `/api/status` | The key scene |
| 10 | `/api/ready` | Status | `live: false` visible |
| 11 | B-roll | On a boat | Phone in hand |

---

## 5. Technical requirements

| Item | Spec |
|---|---|
| Resolution | 1920×1080, 16:9 |
| Frame rate | 30 fps minimum, 60 fps for screen motion |
| Screen capture | OBS Studio, lossless or CRF 18 |
| Mic | Any USB condenser; record in a closet or under a duvet |
| Voiceover | Record in one pass, room tone first |
| Music | Royalty-free, −18 dB under voice, no vocals |
| Captions | Burned in, white on 40% black bar |
| File | H.264 MP4, ≤ 100 MB |

**Before you record:** open the app and let it warm for two minutes. The engine
spins down when idle and the first request can take ~50 seconds. A cold-start
spinning wheel in your video reads as a crash.

---

## 6. Editing notes

- **Cut every "um".** Then cut 10% more. Four and a half minutes is already
  generous.
- **Never show a loading spinner longer than two seconds.** If a call is slow,
  cut to the next scene and back.
- **The Digha scene gets no music.** Everything else can have it.
- **Show the source labels.** They are the proof. If a label is too small to
  read at 1080p, zoom the browser to 125% for that shot.
- **Do not show the terminal or the code.** Judges watch demos, not builds.
  The architecture diagram carries the technical weight.
- **End on the URL.** It is the only thing they will remember to type.

---

## 7. If you only have 90 seconds

Cut to this and you still have a complete video:

1. Malayalam question, answered in Malayalam (15 s)
2. The three failure modes as text (15 s)
3. Agent roster + architecture diagram (20 s)
4. Go / no-go with the risk matrix (20 s)
5. **The Digha refusal** (20 s)

The honesty moment is non-negotiable. Everything else is negotiable.
