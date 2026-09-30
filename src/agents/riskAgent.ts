/**
 * Risk Validation Agent — multi-agent evidence fusion.
 *
 * This is the agent that turns a pile of specialist findings into one number a
 * fisherman can act on. It only ever escalates: it recomputes a weighted risk
 * from the contributors on the blackboard, reconciles that with the worst
 * individual contribution, and then states plainly what would have to change
 * for the verdict to improve.
 *
 * The weighting is intentionally conservative. A single RED advisory or a
 * cyclone in the influence area dominates everything else, because that is how
 * the IMD decision matrix behaves and because a false "all clear" is the one
 * failure mode this platform cannot afford.
 */

import { RiskLevel } from '../types';
import {
  AgentContext,
  AgentDefinition,
  RISK_RANK,
  defineAgent,
  ev,
  finding,
  ok,
} from './base';
import { computeRiskTrajectory, describeTrend } from '../core/riskTrajectory';
import { currentBulletins } from '../core/alerts';
import { vesselName } from '../core/localize';

/** Contribution of each agent to the composite risk score. */
const WEIGHTS = {
  MARINE_ALERT_AGENT: 34,
  WEATHER_AGENT: 22,
  OCEAN_AGENT: 22,
  GEOFENCING_AGENT: 14,
  ROUTE_OPTIMIZATION_AGENT: 12,
  TIDE_AGENT: 8,
  PFZ_AGENT: 4,
} as const;

type Contributor = keyof typeof WEIGHTS;

export const riskAgent: AgentDefinition = defineAgent('RISK_VALIDATION_AGENT', (context: AgentContext) => {
  const notes = context.artifacts.riskNotes ?? [];
  const { book } = context;

  /* ---- Composite weighted score ---- */
  let weighted = 0;
  let totalWeight = 0;
  for (const note of notes) {
    const weight = WEIGHTS[note.agent as Contributor] ?? 6;
    weighted += RISK_RANK[note.level] * weight;
    totalWeight += weight;
  }
  const normalised = totalWeight > 0 ? weighted / totalWeight : 0;

  const scoreToRisk = (score: number): RiskLevel =>
    score >= 2.6 ? 'SEVERE' : score >= 1.6 ? 'HIGH' : score >= 0.7 ? 'MODERATE' : 'LOW';

  const composite = scoreToRisk(normalised);
  const worstSingle = notes.reduce<RiskLevel>((acc, n) => (RISK_RANK[n.level] > RISK_RANK[acc] ? n.level : acc), 'LOW');

  // Escalation floor: any RED advisory, or a vessel-limit breach, pins the
  // verdict regardless of how comfortable the other agents are. Only bulletins
  // still within their validity window may pin — a lapsed advisory stops
  // governing decisions the moment it lapses.
  const alerts = context.artifacts.alerts ?? [];
  const current = currentBulletins(alerts);
  const hardOverride = current.some(
    (a) => a.advisoryLevel === 'RED' || a.type === 'CYCLONE' || a.type === 'TSUNAMI',
  );
  const vesselBreach =
    notes.some((n) => n.level === 'HIGH' && /exceeds the/.test(n.reason)) ||
    (context.artifacts.ocean?.waveHeightMeters ?? 0) > context.vessel.maxWaveHeightMeters;

  const finalRisk: RiskLevel = hardOverride
    ? 'SEVERE'
    : vesselBreach
      ? RISK_RANK[worstSingle] > RISK_RANK.HIGH
        ? worstSingle
        : 'HIGH'
      : RISK_RANK[composite] > RISK_RANK[worstSingle]
        ? composite
        : worstSingle;

  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - normalised * 26)));
  context.artifacts.riskLevel = finalRisk;
  context.artifacts.safetyScore = safetyScore;

  /* ---- Departure-window trajectory --------------------------------- */
  const trajectory = computeRiskTrajectory({
    weather: context.artifacts.weather,
    ocean: context.artifacts.ocean,
    alerts: context.artifacts.alerts,
    tide: context.artifacts.tideReport,
    // The boundary/corridor/productivity contributions have no forecast slots;
    // they are carried forward at their published level so the window series
    // and the instantaneous verdict share one weighted matrix.
    constantNotes: (context.artifacts.riskNotes ?? []).filter((n) =>
      ['GEOFENCING_AGENT', 'ROUTE_OPTIMIZATION_AGENT', 'PFZ_AGENT'].includes(n.agent),
    ),
    vessel: context.vessel,
  });
  if (trajectory) context.artifacts.riskTrajectory = trajectory;

  const findings = [
    finding(
      `${book.ui.overallConditionsWord
        .replace('{risk}', book.riskWords[RISK_RANK[finalRisk]])
        .replace('{score}', String(safetyScore))} ${verdictSentence(finalRisk, context)}`,
      {
        confidence: 0.85,
        riskLevel: finalRisk,
        evidence: [
          ev(book.evidenceKeys.riskLevel, book.riskWords[RISK_RANK[finalRisk]], 'ORCA weighted risk matrix'),
          ev(book.evidenceKeys.safetyScore, `${safetyScore}/100`, 'ORCA weighted risk matrix'),
          ev('Contributors', String(notes.length), 'Multi-agent evidence ledger'),
        ],
      },
    ),
  ];

  if (notes.length > 0) {
    const ranked = [...notes].sort((a, b) => RISK_RANK[b.level] - RISK_RANK[a.level]);
    findings.push(
      finding(
        `Ranked contributions: ${ranked
          .map((n) => `${n.agent.replace(/_AGENT$/, '').replace(/_/g, ' ').toLowerCase()} ${book.riskWords[RISK_RANK[n.level]]}`)
          .join(', ')}.`,
        {
          confidence: 0.9,
          evidence: ranked.map((n) =>
            ev(n.agent.replace(/_AGENT$/, '').replace(/_/g, ' '), n.reason, 'ORCA evidence ledger'),
          ),
        },
      ),
    );
  }

  /* ---- Departure-window verdict ------------------------------------- */
  if (!trajectory) {
    findings.push(
      finding(
        'No forecast-window series is available because neither the weather nor the ocean product carried one; the verdict above is instantaneous.',
        { confidence: 0.5, evidence: [ev('Trajectory', 'Unavailable', 'Forecast basis')] },
      ),
    );
  } else {
    const best = trajectory.bestWindow;
    const nowWord = book.riskWords[RISK_RANK[trajectory.points[0].riskLevel]];
    const bestWord = best ? book.riskWords[RISK_RANK[best.riskLevel]] : '';
    const windowSentence = best
      ? ` The least-risky departure window in the next two days is ${best.label} (${bestWord}, safety ${best.safetyScore}/100, driven by ${best.dominant}).`
      : '';
    findings.push(
      finding(
        `Window outlook over the next 48 h: now ${nowWord}, then ${trajectory.points
          .slice(1)
          .map((p) => `${p.label} ${book.riskWords[RISK_RANK[p.riskLevel]]}`)
          .join(', ')}. ${describeTrend(trajectory.trend).replace(/^./, (c) => c.toUpperCase())}.${windowSentence} ${trajectory.fromLive ? book.ui.computedFromLiveWord : book.ui.computedFromReferenceWord}`,
        {
          confidence: 0.75,
          riskLevel: finalRisk,
          evidence: trajectory.points.map((p) =>
            ev(
              p.label,
              `${book.riskWords[RISK_RANK[p.riskLevel]]} · ${p.safetyScore}/100 · ${p.dominant}`,
              'ORCA windowed risk matrix',
            ),
          ),
        },
      ),
    );
  }

  if (hardOverride) {
    findings.push(
      finding(
        `The verdict is pinned to severe by an overriding advisory: ${current
          .filter((a) => a.advisoryLevel === 'RED' || a.type === 'CYCLONE' || a.type === 'TSUNAMI')
          .map((a) => a.title)
          .join('; ')}. No amount of favourable detail elsewhere overrides this.`,
        {
          confidence: 0.95,
          riskLevel: 'SEVERE',
          evidence: [ev('Override', 'Advisory-driven', 'IMD / INCOIS bulletin')],
        },
      ),
    );
  }

  const improvement = whatWouldImprove(context, finalRisk);
  if (improvement.length > 0) {
    findings.push(
      finding(`The verdict improves if: ${improvement.join('; ')}.`, {
        confidence: 0.8,
        evidence: [ev('Sensitivity', 'Counterfactual', 'ORCA risk matrix')],
      }),
    );
  }

  findings.push(
    finding(
      'ORCA rates conditions; it does not clear them for sailing. Official IMD, INCOIS and port authority warnings always take precedence over this assessment.',
      { confidence: 1, evidence: [ev('Safety framing', 'Advisory only', 'ORCA policy')] },
    ),
  );

  return ok(
    findings,
    book.ui.riskSummaryWord
      .replace('{risk}', book.riskWords[RISK_RANK[finalRisk]])
      .replace('{score}', String(safetyScore))
      .replace('{n}', String(notes.length)),
    ['All upstream agent findings'],
  );
});

function verdictSentence(risk: RiskLevel, context: AgentContext): string {
  const ui = context.book.ui;
  switch (risk) {
    case 'LOW':
      return ui.verdictLowWord;
    case 'MODERATE':
      return ui.verdictModerateWord;
    case 'HIGH':
      return ui.verdictHighWord;
    case 'SEVERE':
    default:
      return ui.verdictSevereWord.replace('{vessel}', vesselName(context.vessel, context.book).label);
  }
}

function whatWouldImprove(context: AgentContext, current: RiskLevel): string[] {
  const out: string[] = [];
  const active = currentBulletins(context.artifacts.alerts ?? []);

  if (active.some((a) => a.advisoryLevel === 'RED' || a.type === 'CYCLONE')) {
    out.push('the cyclone or red advisory is downgraded to a watch');
  }
  if (active.some((a) => a.type === 'LIGHTNING' || a.type === 'SQUALL')) {
    out.push('the convective cell passes and the lightning risk drops to low');
  }
  if (current !== 'LOW') {
    out.push('the next IMD bulletin is re-read and the window is re-checked');
  }
  if ((context.artifacts.ocean?.waveHeightMeters ?? 0) > context.vessel.maxWaveHeightMeters) {
    out.push(`a smaller vessel with a higher ${context.vessel.maxWaveHeightMeters}+ m freeboard is used`);
  }
  const geofence = context.artifacts.geofencingData?.violations?.[0];
  if (geofence?.inside) {
    out.push(`the vessel clears ${geofence.boundaryName} and its statutory buffer`);
  }

  return out;
}
