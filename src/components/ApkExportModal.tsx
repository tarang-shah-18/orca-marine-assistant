/**
 * Build & demonstration hub.
 *
 * Reachable from the Info screen. Everything in here is copy-pasteable and
 * true: the commands run, the endpoints exist, and the file tree is the
 * repository as it actually is. A judge who copies from here must not hit a
 * wall.
 *
 * LOCALISATION BOUNDARY. All navigational chrome — titles, headings, step
 * captions, button labels, the prose ORCA wrote around each block — is
 * translated into all eleven languages. The *payloads* are not, and cannot be:
 *
 *   - shell commands (`npx eas build -p android --profile production`) have no
 *     translation and would be broken by one;
 *   - file paths (`mobile/src/services/api.js`, `src/agents/routeAgent.ts`) are
 *     repository identifiers, not prose;
 *   - the endpoint table's one-line descriptions are API reference, the same
 *     category as the published IMD/INCOIS bulletins ORCA quotes verbatim.
 *
 * A judge reads the payloads in English and navigates the hub in their own
 * language. That is the same rule the rest of the product follows: identifiers
 * and quoted source material stay verbatim, ORCA's own words get translated.
 */

import React, { useState } from 'react';
import {
  Check,
  Copy,
  FolderTree,
  Server,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { Phrasebook } from '../core/i18n';
import { codeText } from './LocalizedCode';

interface ApkExportModalProps {
  onClose: () => void;
  /**
   * Required, not optional. An optional phrasebook with an English `? :`
   * fallback once let a whole screen render English in all eleven languages;
   * making it required turns that bug class into a compile error.
   */
  book: Phrasebook;
}

type TabId = 'build' | 'engine' | 'structure' | 'judge_demo';

/** Tab captions live in the phrasebook, so the table is built per language. */
const tabCaption = (
  ui: Phrasebook['ui'],
  id: TabId,
): string =>
  ({
    build: ui.apkTabBuildWord,
    engine: ui.apkTabEngineWord,
    structure: ui.apkTabStructureWord,
    judge_demo: ui.apkTabDemoWord,
  })[id];

const TABS: Array<{ id: TabId; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'build', Icon: Smartphone },
  { id: 'engine', Icon: Server },
  { id: 'structure', Icon: FolderTree },
  { id: 'judge_demo', Icon: Terminal },
];

export const ApkExportModal: React.FC<ApkExportModalProps> = ({ onClose, book }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('build');
  const ui = book.ui;

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const EAS_BUILD_COMMANDS = `# 1. Navigate to the mobile client
cd mobile

# 2. Install dependencies
npm install

# 3. Install Expo Application Services (EAS) CLI globally
npm install -g eas-cli

# 4. Log in to your free Expo account
eas login

# 5. Configure the Android build project (once)
eas build:configure

# 6. Build the standalone Android APK (preview profile produces a direct .apk)
eas build -p android --profile preview

# 7. EAS prints a download link and a QR code for orca-preview.apk
# Install it over ADB, or open the link on the phone and tap "Install":
adb install orca-preview.apk`;

  const EXPO_GO_COMMANDS = `# Instant testing on a physical Android phone with Expo Go.
# 1. Start the agent engine in the repository root (this is the app's backend):
cd ..
npm install
npm run dev            # Express + the multi-agent engine, on :3000

# 2. Start the client
cd mobile
npm install
npx expo start --clear

# 3. Scan the QR code with Expo Go from the Play Store.
# The emulator reaches the engine at 10.0.2.2:3000 with no configuration.
# On a physical phone, set the LAN address instead:
#   EXPO_PUBLIC_ORCA_API=http://192.168.1.10:3000 npx expo start`;

  const ENGINE_COMMANDS = `# The agent engine is the repository root. There is no second backend.

cd .
npm install
cp .env.example .env        # optional: add GEMINI_API_KEY
npm run dev                 # tsx server.ts -> http://localhost:3000

# Verify
curl http://localhost:3000/api/health
curl http://localhost:3000/api/status     # agent roster, counts, AI layer

# Ask a question in any of the 11 supported languages
curl -X POST http://localhost:3000/api/chat \\
  -H 'Content-Type: application/json' \\
  -d '{"message":"कल सुबह मछली पकड़ने जाना सुरक्षित है?","harbor":"mumbai"}'

# Production bundle: static client + a single Node server
npm run build
npm start                   # serves dist/ and dist/server.cjs on :3000`;

  const DEMO_FLOW_GUIDE = `SIH 2026 — 3-MINUTE JUDGE DEMONSTRATION SCRIPT
Problem ID 26176 · ISRO / Department of Space · Software · Space Technology

--- 0:00  Language auto-detection (0:20) ---
Type, in Malayalam, without touching the language selector:
   "ഇവിടെ നിന്ന് അടുത്തുള്ള മീൻ പിടിക്കുന്ന സ്ഥലം എവിടെയാണ്?"
Point out: the response comes back in Malayalam. No language was selected —
ORCA detected the script and the intent. Do the same in Bengali.

--- 0:20  The plan is made visible (0:25) ---
Expand "Agents". The planner has not guessed: it resolved the intent
(NEXT_NEAREST_PFZ), the anchor (Sassoon Dock, Mumbai) and the horizon,
then decomposed the request into a task graph.
Point out the 13-agent roster and that only the specialists this question
needed were dispatched.

--- 0:45  Evidence, not prose (0:40) ---
Open "Data" and "Evidence".
   * 2.9 m significant wave height, Douglas sea state 4
   * chlorophyll-a and sea-surface temperature from the PFZ agent
   * every row carries the upstream product it came from
Say: "I can check this. Nothing here is asserted without a source."

--- 1:25  Multi-agent synthesis + a real follow-up round (0:45) ---
Ask: "Is it safe to go there tomorrow?"
Point out three things:
   1. ORCA resolved "there" to the zone named 3 questions ago — memory.
   2. The roster changed: weather, ocean, alert and risk were added, and a
      second round ran because the risk agent asked the weather agent to
      re-check the squall window.
   3. The verdict is MODERATE and carries a named, actionable reason.

--- 2:10  Capabilities the judges look for (0:30) ---
Tap the chips, in order:
   "Tide, weather and sea conditions near my spot"  -> real harmonic
        summation from seven constituents, with a departure window
   "What is the safest route to reach the fishing zone?"
        -> three corridors scored; a geofence check on the track, not
           just the endpoints
   "Which zones should I avoid?"  -> international boundary, MPAs,
        ecologically sensitive areas, oil installations, with the
        statutory text and the buffer distance
   "Why has fish productivity declined in my harbour?"
        -> 36 months of landings, a lagged correlation against rainfall
           and SST, and a CPUE trend
Open the Marine Map: the plotted corridor is the corridor that was scored.

--- 2:40  The safety standard, stated out loud (0:20) ---
Point at the footer, then say it directly:
   "ORCA never guarantees safety. It ranks evidence and names its sources,
    and it always defers to IMD, INCOIS and the port authority.
    The decision to sail is the master's."

Close on the "About" tab: the engine runs with no LLM at all. Gemini is
optional and can only add agents to the roster, never remove a
safety-critical one.`;

  const ENGINE_ENDPOINTS: Array<[string, string]> = [
    ['POST /api/chat', 'Full multi-agent pipeline. Returns the OrchestrationResult.'],
    ['POST /api/chat/stream', 'The same pipeline as SSE, so the agent trace is live, not scripted.'],
    ['GET /api/situation', 'Proactive marine brief: current risk, advisories, nearest PFZ.'],
    ['GET /api/status', 'Agent roster, inventory counts, AI layer, data cycle.'],
    ['GET /api/agents', 'Roster plus which specialists are actually wired up.'],
    ['GET /api/languages', 'The 11 supported languages and their speech tags.'],
    ['GET /api/harbors', 'The 13 harbour gazetteer and the 6 vessel classes.'],
    ['GET /api/scenarios', 'The 8 canonical questions, in all 11 languages.'],
    ['GET /api/pfz', 'Potential Fishing Zones near a point or harbour.'],
    ['GET /api/hotspots', 'Chlorophyll-a and SST productivity grid.'],
    ['GET /api/weather', 'IMD coastal forecast with wind, gust, visibility, lightning.'],
    ['GET /api/ocean', 'INCOIS sea state: waves, swell, SST, current, Douglas code.'],
    ['GET /api/tides', 'Harmonic tide report with departure windows.'],
    ['GET /api/alerts', 'Advisories within range, sorted by weight.'],
    ['GET /api/geofences', 'Regulated-water catalogue with statutory text.'],
    ['POST /api/geofence/check', 'Check a position or a whole planned track.'],
    ['GET /api/route', 'Scored corridors between two points, with alternatives.'],
    ['GET /api/historical', '36-month productivity diagnosis.'],
    ['GET /api/map-data', 'Every map layer in one request.'],
    ['POST /api/session/reset', 'Clear conversation memory for a session.'],
  ];

  const PROJECT_TREE = `orca-marine-assistant/
├── server.ts                  # Express entry: API, Vite middleware, static dist/
├── src/
│   ├── types.ts               # The one domain model, shared by server and client
│   ├── core/
│   │   ├── geo.ts             # WGS-84 geodesy: haversine, bearing, polygons, offsets
│   │   ├── dataset.ts         # Marine knowledge base (see "Data sources" in README)
│   │   ├── language.ts        # Script-range + romanised detection for 11 languages
│   │   ├── i18n.ts            # Phrasebook, risk words, headline keys
│   │   └── intent.ts          # 12 intents, weighted n-gram lexicons, slot resolution
│   ├── agents/
│   │   ├── base.ts            # AgentContext, artifacts blackboard, runAgent()
│   │   ├── planner.ts         # Intent -> task graph -> agent roster
│   │   ├── gisAgent.ts        # 13      anchor resolution, distance, bearing
│   │   ├── pfzAgent.ts        # 1       chlorophyll-a / SST fronts
│   │   ├── weatherAgent.ts    # 2       IMD coastal forecast
│   │   ├── oceanAgent.ts      # 3       INCOIS sea state
│   │   ├── tideAgent.ts       # 4       harmonic summation + departure windows
│   │   ├── alertAgent.ts      # 5       squall, lightning, cyclone, high wave
│   │   ├── geofencingAgent.ts # 6       statutory boundaries and buffers
│   │   ├── routeAgent.ts      # 7       corridor search and scoring
│   │   ├── riskAgent.ts       # 8       weighted, explainable verdict
│   │   ├── historicalAgent.ts # 9       trend, correlation, CPUE diagnosis
│   │   ├── visualizationAgent.ts # 10    chart and geospatial payloads
│   │   ├── synthesizer.ts     # 11      evidence ledger -> answer
│   │   ├── critic.ts          # 12      safety audit of the rendered text
│   │   └── orchestrator.ts    # 7-stage pipeline + typed event stream
│   ├── server/
│   │   ├── routes.ts          # 21 HTTP endpoints, SSE, data endpoints
│   │   ├── session.ts         # In-process conversation store (LRU + TTL)
│   │   ├── context.ts         # Untrusted-input coercion, buildContext, runChain
│   │   ├── scenarios.ts       # 8 capabilities x 11 languages
│   │   └── gemini.ts          # Optional AI layer
│   ├── components/            # React UI: chat, home, map, info, charts, trace
│   ├── services/
│   │   ├── orcaApi.ts         # The client's only network boundary
│   │   └── speechService.ts   # SpeechRecognition / SpeechSynthesis per language
│   └── App.tsx                # Single state owner
├── mobile/                    # Expo React Native client for Android
│   ├── App.js                 # Five screens, one state owner
│   └── src/{screens,components,services,data,theme.js}
└── index.html                 # Vite entry`;

  const CopyButton = ({ value, id, label }: { value: string; id: string; label: string }) => (
    <button
      onClick={() => copyToClipboard(value, id)}
      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0"
    >
      {copiedKey === id ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      <span>{copiedKey === id ? ui.copiedWord : ui.copyWord}</span>
      <span className="sr-only">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-6 text-slate-100 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-slate-50">{ui.apkTitleWord}</h2>
              <p className="text-xs text-slate-400">{ui.apkSubtitleWord}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50"
            aria-label={ui.closeWord}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 py-3 border-b border-slate-800 overflow-x-auto shrink-0 text-xs font-semibold">
          {TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tabCaption(ui, id)}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {activeTab === 'build' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-cyan-400 text-sm">{ui.apkStep1Word}</span>
                  <CopyButton value={EAS_BUILD_COMMANDS} id="eas" label={ui.copyApkBuildWord} />
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre p-2 bg-slate-900 rounded-lg">
                  {EAS_BUILD_COMMANDS}
                </pre>
                <p className="text-[11px] text-slate-400">{ui.apkStep1BodyWord}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-emerald-400 text-sm">{ui.apkStep2Word}</span>
                  <CopyButton value={EXPO_GO_COMMANDS} id="expo" label={ui.copyExpoGoWord} />
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre p-2 bg-slate-900 rounded-lg">
                  {EXPO_GO_COMMANDS}
                </pre>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 text-sm block">{ui.apkStep3Word}</span>
                <p className="text-slate-300">
                  {codeText(ui.apkStep3BodyWord, ['mobile/src/services/api.js'])}
                </p>
                <div className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-slate-300">
                  {`export const BASE_URL =
  process.env.EXPO_PUBLIC_ORCA_API ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');`}
                </div>
                <p className="text-slate-300">
                  {codeText(ui.apkStep3Body2Word, [
                    'eas.json',
                    'EXPO_PUBLIC_ORCA_API=https://your-host',
                  ])}{' '}
                  <span className="text-slate-400">{ui.apkStep3NoteWord}</span>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-cyan-400 text-sm">{ui.apkEngineHeadingWord}</span>
                  <CopyButton value={ENGINE_COMMANDS} id="engine" label={ui.copyEngineWord} />
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre p-2 bg-slate-900 rounded-lg">
                  {ENGINE_COMMANDS}
                </pre>
                <p className="text-[11px] text-slate-400">
                  {codeText(ui.apkEngineKeyNoteWord, ['GEMINI_API_KEY'], 'text-emerald-300')}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-50 text-sm block">
                  HTTP surface <span className="text-slate-500">(all under /api)</span>
                </span>
                <ul className="space-y-1 text-slate-300">
                  {ENGINE_ENDPOINTS.map(([route, what]) => (
                    <li key={route}>
                      <code className="text-emerald-400 font-bold">{route}</code>
                      <span className="text-slate-500"> — {what}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-400 pt-1">
                  Data endpoints do not fabricate output. Each one builds the same context a chat
                  turn would and runs the same real agent, so{' '}
                  <code className="text-cyan-300">/api/weather</code> and the weather paragraph in
                  an answer are computed by one piece of code and cannot disagree.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-50 text-sm block">{ui.apkProjectOrgWord}</span>
                <CopyButton value={PROJECT_TREE} id="tree" label={ui.copyFolderWord} />
              </div>
              <pre className="text-cyan-300 font-mono text-[11px] overflow-x-auto whitespace-pre p-3 bg-slate-900 rounded-xl leading-relaxed">
                {PROJECT_TREE}
              </pre>
            </div>
          )}

          {activeTab === 'judge_demo' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-cyan-400 text-sm">{ui.apkDemoHeadingWord}</span>
                <CopyButton value={DEMO_FLOW_GUIDE} id="script" label={ui.copyDemoWord} />
              </div>
              <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre p-3 bg-slate-900 rounded-xl leading-relaxed">
                {DEMO_FLOW_GUIDE}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          {/* Deliberately verbatim: the event name and the organiser's problem
              identifier, which a judge matches against the submission form. */}
          <span className="text-slate-400">SIH 2026 • Problem ID: 26176</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-xl font-semibold cursor-pointer"
          >
            {ui.closeWord}
          </button>
        </div>
      </div>
    </div>
  );
};
