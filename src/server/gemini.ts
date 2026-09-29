/**
 * Gemini bridge.
 *
 * Gemini is the *optional* intelligence layer. ORCA must work with no key, no
 * network and no quota, so every entry point here degrades to `null` rather
 * than throwing, and the orchestrator simply keeps the deterministic result.
 *
 * What Gemini is actually used for, and what it is deliberately not used for:
 *
 *   - **Planning**: it may *add* specialists to the roster, never remove a
 *     safety-critical one. `buildPlan` enforces that regardless.
 *   - **Synthesis**: it rewrites the deterministic brief as natural prose in
 *     the detected language. It never sees raw data it can misquote, only the
 *     already-computed findings, and the critic re-audits its output.
 *
 * It is never used to compute a distance, a tide or a risk level.
 */

import { AgentType, EvidenceItem, LanguageCode, RiskLevel, TimeHorizon } from '../types';
import { SUPPORTED_LANGUAGES } from '../types';
import { GeminiBridge } from '../agents/orchestrator';
import { detectLanguage } from '../core/language';

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
const MODEL = process.env.ORCA_GEMINI_MODEL ?? 'gemini-2.5-flash';

const HORIZON_SCHEMA = ['NOW', 'TODAY', 'TOMORROW', 'NEXT_3_DAYS', 'WEEK'] as const;

const AGENT_SCHEMA = [
  'GIS_AGENT',
  'PFZ_AGENT',
  'WEATHER_AGENT',
  'OCEAN_AGENT',
  'TIDE_AGENT',
  'MARINE_ALERT_AGENT',
  'GEOFENCING_AGENT',
  'ROUTE_OPTIMIZATION_AGENT',
  'RISK_VALIDATION_AGENT',
  'HISTORICAL_ANALYSIS_AGENT',
  'VISUALIZATION_AGENT',
] as const;

export function isGeminiConfigured(): boolean {
  return API_KEY.trim().length > 0;
}

/** Language names handed to the model so it writes in the right language. */
const LANGUAGE_NAMES: Record<LanguageCode, string> = SUPPORTED_LANGUAGES.reduce(
  (acc, l) => ({ ...acc, [l.code]: l.label }),
  {} as Record<LanguageCode, string>,
);

/* ------------------------------------------------------------------ *
 * Client
 * ------------------------------------------------------------------ */

let clientPromise: Promise<unknown> | null = null;

async function getClient(): Promise<unknown | null> {
  if (!isGeminiConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@google/genai')
      .then((mod) => {
        const GoogleGenAI = (mod as { GoogleGenAI?: new (opts: { apiKey: string }) => unknown }).GoogleGenAI;
        if (!GoogleGenAI) throw new Error('@google/genai did not export GoogleGenAI');
        return new GoogleGenAI({ apiKey: API_KEY });
      })
      .catch(() => null);
  }
  return clientPromise;
}

interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  /** Ask for JSON; the bridge parses and validates before returning. */
  json?: boolean;
  temperature?: number;
}

async function generate(options: GenerateOptions): Promise<string | null> {
  const client = (await getClient()) as {
    models: {
      generateContent(params: Record<string, unknown>): Promise<{
        text?: string;
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }>;
    };
  } | null;

  if (!client) return null;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0.2,
      topP: 0.9,
      maxOutputTokens: 2048,
      ...(options.json
        ? {
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                roster: { type: 'array', items: { type: 'string', enum: [...AGENT_SCHEMA] } },
                reasoning: { type: 'string' },
                horizon: { type: 'string', enum: [...HORIZON_SCHEMA] },
              },
              required: ['roster', 'reasoning', 'horizon'],
            },
          }
        : {}),
    },
  });

  return (
    response.text ??
    response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    null
  );
}

/* ------------------------------------------------------------------ *
 * Planner refinement
 * ------------------------------------------------------------------ */

const PLANNER_SYSTEM = `You are the planning module of ORCA, a marine decision-support
platform for Indian artisanal fishers built for ISRO / Dept. of Space problem 26176.

Given a fisherman's question (in any Indian language) and the plan the deterministic
engine already produced, decide whether any ADDITIONAL specialist agent is needed.

Available agents:
${AGENT_SCHEMA.map((a) => `- ${a}`).join('\n')}

Rules:
- You may only ADD agents. Never suggest removing one.
- Always keep GIS_AGENT, MARINE_ALERT_AGENT and RISK_VALIDATION_AGENT in the roster.
- If the deterministic plan is already right, return it unchanged.
- If the question mentions tides, weather, sea state, alerts, a route, restricted
  water or historical decline and the corresponding agent is missing, add it.
- Set "horizon" to the time range the question is about.
- "reasoning" is one short sentence, max 30 words, naming what you changed and why.
- Respond in the same language as the question for the reasoning field.`;

export async function refinePlanWithGemini(input: {
  utterance: string;
  language: LanguageCode;
  plan: { intent: string; horizon: TimeHorizon; agents: AgentType[]; reasoning: string };
}): Promise<{ roster?: AgentType[]; reasoning?: string; horizon?: TimeHorizon } | null> {
  const prompt = [
    `Question: ${input.utterance}`,
    `Detected language: ${LANGUAGE_NAMES[input.language] ?? input.language}`,
    `Deterministic intent: ${input.plan.intent}`,
    `Deterministic horizon: ${input.plan.horizon}`,
    `Deterministic roster: ${input.plan.agents.join(', ')}`,
    `Deterministic reasoning: ${input.plan.reasoning}`,
  ].join('\n');

  const raw = await generate({ systemInstruction: PLANNER_SYSTEM, prompt, json: true });
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed) return null;

  const roster = Array.isArray(parsed.roster)
    ? (parsed.roster as string[]).filter((a): a is AgentType =>
        (AGENT_SCHEMA as readonly string[]).includes(a),
      )
    : undefined;

  const horizon = HORIZON_SCHEMA.includes(parsed.horizon as (typeof HORIZON_SCHEMA)[number])
    ? (parsed.horizon as TimeHorizon)
    : undefined;

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 240) : undefined;

  if (!roster && !reasoning && !horizon) return null;

  return { roster, reasoning, horizon };
}

/* ------------------------------------------------------------------ *
 * Answer synthesis
 * ------------------------------------------------------------------ */

const SYNTHESIZER_SYSTEM = `You are the response writer for ORCA, a marine decision-support
platform for Indian artisanal fishers, built for ISRO / Dept. of Space problem 26176.

You will receive a question, a deterministic draft brief, and the machine-computed
evidence behind it. Rewrite the brief as clear, respectful, plain prose in the SAME
language as the question.

Non-negotiable rules:
1. Use ONLY the numbers, names and locations present in the draft and the evidence.
   Never invent a value, never round differently, never add a fact.
2. Never guarantee safety. You may say conditions look favourable on current data,
   but you must never say or imply the trip is safe, risk-free or guaranteed.
3. If the risk level is HIGH or SEVERE, the first line must state that clearly and
   must advise staying in port or postponing.
4. Always end by deferring to official IMD, INCOIS and port authority warnings,
   which override anything ORCA says.
5. Keep every technical term, unit, coordinate and species name exactly as given —
   they are already language-neutral and must not be translated.
6. Be concise: 120-220 words, or the same order as the draft. Use short paragraphs.
7. If an advisory is in force, quote its prescribed action verbatim.

Write only the answer body. No preamble, no markdown headers, no sign-off.`;

export async function synthesizeWithGemini(input: {
  utterance: string;
  language: LanguageCode;
  offlineDraft: string;
  riskLevel: RiskLevel;
  evidence: EvidenceItem[];
  agentSummaries: Array<{ agent: string; summary: string }>;
}): Promise<string | null> {
  const languageName = LANGUAGE_NAMES[input.language] ?? input.language;

  const evidenceBlock = input.evidence
    .slice(0, 28)
    .map((e) => `- ${e.label}: ${e.value} (source: ${e.source})`)
    .join('\n');

  const summaryBlock = input.agentSummaries
    .slice(0, 12)
    .map((s) => `- ${s.agent}: ${s.summary}`)
    .join('\n');

  const prompt = [
    `Question: ${input.utterance}`,
    `Reply language: ${languageName} (${input.language})`,
    `Computed risk level: ${input.riskLevel}`,
    '',
    'DETERMINISTIC DRAFT (rewrite this, do not add to it):',
    input.offlineDraft,
    '',
    'AGENT SUMMARIES:',
    summaryBlock || '(none)',
    '',
    'EVIDENCE LEDGER:',
    evidenceBlock || '(none)',
  ].join('\n');

  const raw = await generate({
    systemInstruction: SYNTHESIZER_SYSTEM,
    prompt,
    temperature: 0.35,
  });

  if (!raw) return null;

  const cleaned = raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim();

  return cleaned.length > 40 ? cleaned : null;
}

/* ------------------------------------------------------------------ *
 * Bridge
 * ------------------------------------------------------------------ */

export const geminiBridge: GeminiBridge = {
  available: isGeminiConfigured,

  async refinePlan(input) {
    if (!isGeminiConfigured()) return null;
    try {
      return await refinePlanWithGemini(input as Parameters<typeof refinePlanWithGemini>[0]);
    } catch {
      return null;
    }
  },

  async synthesize(input) {
    if (!isGeminiConfigured()) return null;
    try {
      return await synthesizeWithGemini(input as Parameters<typeof synthesizeWithGemini>[0]);
    } catch {
      return null;
    }
  },
};

/** Status blob for `/api/status`. */
export function geminiStatus() {
  return {
    configured: isGeminiConfigured(),
    model: MODEL,
    /** What the platform does when this is false. */
    fallback: 'deterministic multi-agent engine (src/agents)',
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function safeParse(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
  try {
    const value = JSON.parse(cleaned);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Exposed for the intent API, which reports the model's language guess. */
export const detectForBridge = detectLanguage;
