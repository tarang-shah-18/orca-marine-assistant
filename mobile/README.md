# ORCA — Android client

**Smart India Hackathon 2026 · Problem ID 26176 · ISRO / Department of Space**

This folder is the Expo / React Native shell around the **TypeScript agent
engine** that lives in the repository root. It holds no marine logic of its
own: every tide reading, every fishing zone, every route and every advisory on
the phone is produced by the same agents that serve the web client, over the
same HTTP API.

```
mobile/            Expo React Native client (this folder)
├── App.js         screen router and the small amount of shared state
├── src/
│   ├── theme.js               design tokens, 11 languages, risk vocabulary
│   ├── data/offline.js        bundled harbour gazetteer + the 8 questions × 11 languages
│   ├── services/api.js        the only network boundary
│   ├── components/            ui.js, AgentTrace.js, ResultCards.js
│   └── screens/               Home, Chat, Map, Conditions, Info
../src/             the agent engine (TypeScript) — the source of truth
../server.ts        Express entry point (`npm run dev` in the root)
```

## What changed in v2

| v1 | v2 |
| --- | --- |
| Core UI primitives imported from `lucide-react-native` (they do not exist there) | All primitives imported from `react-native` |
| `import { StyleSheet, Text, View } from 'lucide-react-native'` — the app could not mount | Correct imports, five screens |
| 3 languages, hard-coded chips | **11 languages**, detected server-side, with the question and the short chip label both translated |
| Canned "offline demo" answers that looked like real forecasts | No fabricated readings. If the engine is unreachable, the app says so and names the fix |
| Chat-only | Tides, geofencing, route optimisation, marine GIS and the productivity diagnosis are first-class screens |
| No agent trace | Live SSE trace of the plan, every agent, collaboration requests, findings and the safety critique |
| No streaming | `XMLHttpRequest` + `onprogress` parses the SSE stream, falling back to `POST /api/chat` — same pipeline, same result |

## Prerequisites

- Node.js 18+
- The agent engine running (see the root `README.md`)
- Expo Go on a physical Android phone, **or** the Android emulator

## 1. Start the agent engine

```bash
cd ..          # repository root
npm install
npm run dev    # Express + agent engine on :3000
```

## 2. Run the app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go**, or press `a` for the Android emulator.

## 3. Point the app at the engine

The address lives in one place — `src/services/api.js`:

```js
export const BASE_URL =
  process.env.EXPO_PUBLIC_ORCA_API ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
```

| Where the app runs | What to set |
| --- | --- |
| Android emulator | nothing — `10.0.2.2` is the host's `localhost` |
| Physical phone, same Wi-Fi | your machine's LAN IP, e.g. `http://192.168.1.10:3000` |
| Demo / judge machine | a tunnel, e.g. `https://<subdomain>.ngrok.app` |
| CI or a shell | `EXPO_PUBLIC_ORCA_API=https://… npx expo start` |

## Build a standalone APK

```bash
npm install -g eas-cli
eas login
eas build:configure          # once, creates a project on Expo's servers
eas build -p android --profile preview
```

EAS prints a download link and a QR code for `orca-preview.apk`. Install it with
`adb install orca-preview.apk`, or open the link on the phone and tap
**Install** (allow installs from that browser the first time).

## Offline behaviour

The web client re-runs the whole engine in the browser because the engine is
pure TypeScript. Metro in this folder is not configured to compile the root
`src/`, so the native client instead bundles the *reference* half of the
knowledge base — the 13-harbour gazetteer and the 8 canonical questions in all
11 languages — and is explicit when it needs the engine.

**ORCA never invents a marine reading.** If the API is unreachable, the home
screen says so and names the fix; the data screen reports partial data rather
than substituting a plausible number.

## API surface consumed

| Endpoint | Used by |
| --- | --- |
| `GET /api/status` | Info screen — agent roster, counts, AI layer, data cycle |
| `GET /api/situation` | Home screen — the proactive marine brief |
| `POST /api/chat/stream` | Chat — live agent trace over SSE |
| `POST /api/chat` | Chat fallback when the device cannot stream |
| `POST /api/session/reset` | Chat "New" |
| `GET /api/tides` | Data screen — harmonic tide report and departure windows |
| `GET /api/weather` | Data screen — IMD forecast |
| `GET /api/ocean` | Data screen — sea state |
| `GET /api/alerts` | Data screen — advisories within range |
| `GET /api/geofences` | Data screen — regulated-water catalogue |
| `GET /api/map-data` | Map — every layer in one request |
| `GET /api/route` | Map — corridor to another harbour |
| `POST /api/geofence/check` | Corridor geofence check |

## Safety standard

ORCA is decision support, not a guarantee. Official warnings from **IMD**,
**INCOIS** and the **port authority** always take precedence, and the decision
to sail remains the master's. A critic agent re-reads every answer before it is
shown, strips over-confident phrasing, escalates any ORANGE or RED advisory,
and appends the deferral sentence. The footer on every screen says so.
