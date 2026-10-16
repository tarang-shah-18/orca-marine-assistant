# Contributing to ORCA

Thank you for your interest in contributing to **ORCA — Marine Ecosystem Reasoning with Collaborative Agents**!

ORCA is a Smart India Hackathon 2026 project (Problem ID 26176 · ISRO / Department of Space) that helps India's coastal fishermen make safer, data-driven decisions in 11 Indian languages.

---

## Table of Contents

- [Non-negotiable invariants](#non-negotiable-invariants)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Adding a new language](#adding-a-new-language)
- [Adding a new agent](#adding-a-new-agent)
- [Submitting a pull request](#submitting-a-pull-request)
- [Backlog and priorities](#backlog-and-priorities)

---

## Non-negotiable invariants

Every contribution **must** satisfy all of the following before it can be merged:

| # | Invariant | Where it is enforced |
|---|-----------|----------------------|
| 1 | `npm test` passes **all 3318 checks** | CI (`ci.yml`) |
| 2 | All **11 Indian languages** remain fully localised — every new user-facing string goes into `src/core/i18n.ts` + `src/core/localize.ts` | Unit tests |
| 3 | The engine stays **deterministic and keyless** — the app must run fully offline; a dead network must never produce a fake number, only a flagged reference fallback | Engine contract |
| 4 | Product tokens, agent names, units, severity codes and advisory levels stay **verbatim** — do not rename them | Domain model (`src/types.ts`) |

Breaking any of these invariants will block the PR regardless of how useful the change is.

---

## Getting started

### Prerequisites

- **Node.js** >= 22 (LTS)
- **npm** >= 10 (comes with Node 22)

### Clone and install

```bash
git clone https://github.com/tarang-shah-18/orca-marine-assistant.git
cd orca-marine-assistant
npm install
```

### Environment variables (optional)

Copy the example env file and fill in any keys you have access to:

```bash
cp .env.example .env
```

> **Note:** ORCA is designed to run fully offline without any API keys.
> Keys only unlock *live* data layers; all reference fallbacks are always active.

### Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (or the port shown in the terminal).

---

## Project structure

```
orca-marine-assistant/
├── src/
│   ├── agents/          # Specialist agents (weather, tide, PFZ, GIS, risk ...)
│   │   ├── orchestrator.ts   # Dispatches agents & runs multi-round loops
│   │   ├── planner.ts        # Builds the task graph from intent
│   │   ├── synthesizer.ts    # Merges agent results into a final answer
│   │   └── critic.ts         # Cross-checks agent findings
│   ├── core/            # Pure engine — runs identically on server and in browser
│   │   ├── dataset.ts        # Seeded reference data (harbours, tides, PFZ ...)
│   │   ├── live.ts           # Live data fetchers with reference fallbacks
│   │   ├── intent.ts         # 12-intent classifier (all 11 languages)
│   │   ├── i18n.ts           # Phrasebook (every user-facing string x 11 langs)
│   │   ├── localize.ts       # Template renderer (phrasebook -> final text)
│   │   ├── geo.ts            # Geodesy utilities (haversine, bearing ...)
│   │   ├── alerts.ts         # Advisory parsing & headline selection
│   │   ├── riskTrajectory.ts # Departure-window risk matrix (+0 to +48 h)
│   │   └── fleet.ts          # Harbour risk aggregation (Fleet Watch)
│   ├── components/      # React UI components
│   ├── server/          # Express API routes & session management
│   ├── types.ts         # Single source of truth for all domain types
│   ├── App.tsx          # Root React component & GPS integration
│   └── personas.ts      # Fisher persona definitions
├── scripts/
│   ├── unit-tests.ts    # 71 offline unit checks (run first on `npm test`)
│   └── test-sweep.ts    # Full 3318-check integration sweep
├── docs/                # Architecture diagrams & supplementary docs
├── mobile/              # React Native / Expo companion app
├── server.ts            # Express entry point
└── TODO.md              # Backlog with status per item
```

---

## Development workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/short-description
   ```

2. **Make your changes.** Keep commits small and focused.

3. **Run the full test suite locally** before pushing:

   ```bash
   npm test
   ```

   If only touching the engine, you can run unit tests first (much faster):

   ```bash
   npm run test:unit
   ```

4. **Lint** (TypeScript type-check):

   ```bash
   npm run lint
   ```

5. **Push** and open a PR against `main`.

---

## Coding standards

- **TypeScript** — strict mode is on. Do not use `any` without a comment explaining why.
- **No Node-only APIs in `src/core/`** — the core engine must run in the browser bundle. Use `typeof window` guards if needed.
- **No API keys in code** — use environment variables from `.env` (documented in `.env.example`).
- **Imports** — use relative paths within the project; no barrel `index.ts` files in `src/core/`.
- **Error handling** — every async route is wrapped in `asyncRoute` (see server routes). Never let a rejection hang a request.
- **Comments** — document *why*, not *what*. The code shows what; comments explain the non-obvious reasoning.
- **Naming conventions:**
  - Agent files: `<domain>Agent.ts` (e.g. `weatherAgent.ts`)
  - Type names: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Severity levels: verbatim from `src/types.ts` (`GREEN` / `YELLOW` / `ORANGE` / `RED`)

---

## Testing

ORCA has two test layers, both run by `npm test`:

### 1. Unit tests (`npm run test:unit`)

Located in `scripts/unit-tests.ts` — 71 offline checks covering:

- Geodesy edge cases (poles, antimeridian crossings)
- Advisory expiry and headline-selection rules
- i18n phrasebook integrity — every key present in all 11 languages
- Localisation invariants — no bare English fallback ternaries
- Dataset sanity (harbour coordinates, tide seeds)
- Freshness readout accuracy

**If you add a new phrasebook key, add a unit-test assertion for it.**

### 2. Integration sweep (`npm run test:sweep`)

Located in `scripts/test-sweep.ts` — fires the full agent pipeline against 3318 scenario x language x harbour combinations and asserts:

- Response shape (required fields present)
- No English leakage in non-English responses
- Severity codes are within the legal set
- Source attribution present for every factual claim
- Risk trajectory covers all six time bands (+0, +6, +12, +24, +36, +48 h)

**Both layers must stay green. Do not skip or comment out assertions.**

---

## Adding a new language

1. Add the `LanguageCode` and `LanguageOption` entry to `src/types.ts` (`SUPPORTED_LANGUAGES`).
2. Add the script code to `ScriptCode` in `src/types.ts` if it uses a new script.
3. Add translations for **every key** in `src/core/i18n.ts`.
4. Add every template in `src/core/localize.ts`.
5. Update the intent classifier patterns in `src/core/intent.ts`.
6. Run `npm run test:unit` — the i18n integrity check will list every missing key.
7. Update the language count badge in `README.md`.

---

## Adding a new agent

1. Create `src/agents/<domain>Agent.ts`. Extend `BaseAgent` from `src/agents/base.ts`.
2. Export and register the agent in `src/agents/orchestrator.ts` under the relevant intent(s).
3. Update `src/agents/planner.ts` to include the agent in the relevant task graphs.
4. Add the agent name to `AgentName` in `src/types.ts`.
5. Add domain-specific phrases for all 11 languages to `src/core/i18n.ts` and templates to `src/core/localize.ts`.
6. Write at least one unit-test assertion in `scripts/unit-tests.ts` covering the agent core logic.
7. Ensure the agent returns a **reference fallback** (never `null` data) when its upstream source is unreachable.

---

## Submitting a pull request

### PR title format

```
<type>(<scope>): <short summary>
```

| Type | When to use |
|------|-------------|
| `feat` | New capability or agent |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `test` | Test additions or fixes |
| `refactor` | Code restructure without behaviour change |
| `chore` | Build, CI, config changes |

**Examples:**
- `feat(agent): add fuel-consumption agent for route planning`
- `fix(i18n): add missing Odia translations for risk-strip labels`
- `docs: add contributing guide`

### PR checklist

- [ ] `npm test` passes (3318/3318)
- [ ] `npm run lint` passes (zero TypeScript errors)
- [ ] Every new user-facing string is in `src/core/i18n.ts` for all 11 languages
- [ ] No API keys or secrets are committed
- [ ] No `console.log` debug statements left in production paths
- [ ] PR description explains *what* changed and *why*
- [ ] Related `TODO.md` item updated if applicable (mark Done with explanation)

---

## Backlog and priorities

See [`TODO.md`](./TODO.md) for the full backlog with status per item.

**Priority legend:**
- **P0** — correctness / safety (fix immediately)
- **P1** — high user value (target next sprint)
- **P2** — polish / nice to have

Items marked **Blocked** require an external data source or licence that conflicts with the keyless/offline invariant — do not attempt these without first resolving the upstream blocker.

Items marked **Deferred** are code-completable and welcome contributions.

---

## Questions?

Open an issue or start a discussion on the GitHub repository. Please include:
- What you are trying to do
- What you expected to happen
- What actually happened (with logs if applicable)

---

*ORCA · Smart India Hackathon 2026 · Problem ID 26176 · ISRO / Department of Space*
