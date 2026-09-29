/**
 * Critic & Safety Agent — the last pass over a drafted answer.
 *
 * The critic runs *after* synthesis, on the rendered text, not on the data. Its
 * job is to catch the three failure modes that matter for a safety tool:
 *
 *   1. **Unsound confidence** — the draft says "safe", "go ahead", "no risk",
 *      or otherwise guarantees an outcome ORCA cannot guarantee.
 *   2. **Missing escalation** — a RED/ORANGE advisory or a vessel-limit breach
 *      is in the evidence but never reaches the user.
 *   3. **Missing deferral** — the draft never points at the official bulletin.
 *
 * It patches the text in place and reports what it changed, so the audit trail
 * in the UI shows the safety review rather than hiding it.
 */

import { AdvisoryLevel, AgentType, RiskLevel, RISK_ORDER } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok } from './base';
import { Phrasebook, riskWord } from '../core/i18n';

export interface CritiqueResult {
  text: string;
  /** Phrases the critic rewrote, for the audit panel. */
  corrections: string[];
  /** True when an escalation had to be forced into the answer. */
  escalated: boolean;
}

/**
 * Advisory colour → risk level. Single source of truth for the critic: the old
 * inline ternary appeared twice, and the two copies had to agree by luck.
 */
const ADVISORY_RISK: Record<AdvisoryLevel, RiskLevel> = {
  RED: 'SEVERE',
  ORANGE: 'HIGH',
  YELLOW: 'MODERATE',
  GREEN: 'LOW',
};

/** Patterns that over-promise. Deliberately blunt — false negatives are cheap. */
const OVERPROMISE: RegExp[] = [
  /\b(is|are|it'?s|you'?re)\s+(completely\s+|totally\s+|absolutely\s+)?safe\b/gi,
  /\bguarantee[ds]?\b/gi,
  /\b(perfectly|entirely|fully)\s+safe\b/gi,
  /\bno\s+(risk|danger|hazard)s?\s+(at\s+all|whatsoever)\b/gi,
  /\b(you|we)\s+(can|may|should)\s+go\s+(ahead\s+)?(safely|with\s+no\s+risk)\b/gi,
  /\bcompletely\s+safe\s+to\s+(sail|fish|venture)\b/gi,
  /\bno\s+need\s+to\s+worry\b/gi,
  /\bwill\s+definitely\s+be\s+safe\b/gi,
  /\b100%\s+safe\b/gi,
];

/** Official authorities ORCA must defer to. */
const AUTHORITIES = ['IMD', 'INCOIS', 'port authority', 'Coast Guard'];

export function critiqueAnswer(
  text: string,
  context: AgentContext,
  draftRisk: RiskLevel,
): CritiqueResult {
  const corrections: string[] = [];
  let output = text;

  // 1. Strip over-promising language.
  //
  // The replacement is the fisher's own language, not English: this string is
  // spliced into a sentence they are about to act on, so an English fragment in
  // a Malayalam answer would be worse than the phrasing it replaced.
  const calibrated = context.book.calibrated;
  for (const pattern of OVERPROMISE) {
    output = output.replace(pattern, (match) => {
      corrections.push(`Removed over-confident phrasing: “${match.trim()}”`);
      return calibrated;
    });
  }

  // 2. Force the escalation when the evidence demands it.
  const book = context.book;
  const alerts = context.artifacts.alerts ?? [];
  const active = alerts.filter((a) => a.withinInfluence);

  // Only ORANGE and RED are worth interrupting a fisher for. A YELLOW advisory
  // is already reflected in the MODERATE verdict, and promoting it here used to
  // produce a bare "ALERTS:" header with nothing after it.
  const severe = active.filter((a) => RISK_ORDER[ADVISORY_RISK[a.advisoryLevel]] >= RISK_ORDER.HIGH);
  const alreadyNamed = severe.some((a) => output.includes(a.title));

  let escalated = false;
  if (severe.length > 0 && !alreadyNamed) {
    escalated = true;
    const leading = `${book.labels.alerts.toUpperCase()}: ${severe
      .map((a) => `[${a.advisoryLevel}] ${a.title} — ${a.action}`)
      .join(' ')}`;
    output = `${leading}\n\n${output}`;
    corrections.push('Forced the in-force advisory to the top of the answer');
  }

  // 3. Guarantee the deferral sentence is present.
  const mentionsAuthority = AUTHORITIES.some((a) => output.includes(a));
  if (!mentionsAuthority) {
    output = `${output.trimEnd()}\n\n${book.disclaimer}`;
    corrections.push('Added the mandatory deferral to IMD / INCOIS / port authority');
  }

  // 4. If the verdict is bad, make sure the first line says so.
  if (RISK_ORDER[draftRisk] >= RISK_ORDER.HIGH) {
    const verdict = riskWord(book, draftRisk);
    // `verdict` is a translated word, so it is matched literally. Building a
    // RegExp straight from it would throw on a word containing `(`, `+` or `\`
    // and take the whole answer down with it.
    if (!output.split('\n')[0]?.toLowerCase().includes(verdict.toLowerCase())) {
      output = `${book.labels.risk.toUpperCase()}: ${verdict}\n\n${output}`;
      corrections.push('Moved the risk verdict onto the first line');
    }
  }

  return { text: output.trim(), corrections, escalated };
}

export const criticAgent: AgentDefinition = defineAgent('CRITIC_AGENT', (context: AgentContext) => {
  const book = context.book;
  const draft = context.artifacts.draftAnswer ?? '';
  const draftRisk = context.artifacts.riskLevel ?? 'LOW';
  const review = critiqueAnswer(draft, context, draftRisk);

  context.artifacts.draftAnswer = review.text;
  context.artifacts.criticCorrections = review.corrections;

  const findings = [
    finding(
      review.corrections.length === 0
        ? 'Safety review passed: the draft carries the risk verdict, the evidence and the official-authority deferral.'
        : `Safety review applied ${review.corrections.length} correction${review.corrections.length === 1 ? '' : 's'}: ${review.corrections.join('; ')}.`,
      {
        confidence: 1,
        riskLevel: draftRisk,
        evidence: review.corrections.map((c) => ev('Correction', c, 'ORCA critic')),
      },
    ),
  ];

  if (review.escalated) {
    findings.push(
      finding(
        'An in-force advisory at ORANGE or RED was not prominent enough in the draft, so it was forced to the top of the answer.',
        { confidence: 1, riskLevel: draftRisk, evidence: [ev('Escalation', 'Applied', 'ORCA critic')] },
      ),
    );
  }

  return ok(
    findings,
    book.ui.reviewCompleteWord.replace('{n}', String(review.corrections.length)),
    ['Synthesised draft', 'Evidence ledger'],
  );
});

/** Phrasebook accessor kept here so the critic owns the safety vocabulary. */
export function safetyWords(book: Phrasebook): Record<RiskLevel, string> {
  return {
    LOW: book.riskWords[0],
    MODERATE: book.riskWords[1],
    HIGH: book.riskWords[2],
    SEVERE: book.riskWords[3],
  };
}

export const CRITIC: AgentType = 'CRITIC_AGENT';
