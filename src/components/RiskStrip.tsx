import React from 'react';
import type { RiskTrajectory, RiskTrajectoryPoint } from '../types';
import { RISK_ORDER } from '../types';
import type { Phrasebook } from '../core/i18n';

const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
};

const RISK_RANK: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };

/**
 * Departure-window risk strip.
 *
 * A compact, hand-rolled SVG reading the `riskTrajectory` product the risk
 * agent publishes: one bar per forecast horizon, coloured by the same risk
 * vocabulary as the answer badge, with the least-risky future window ringed
 * as "BEST". It answers the question the go/no-go decision turns on — not just
 * "how risky now" but "when is the least-bad time to sail".
 */
export const RiskStrip: React.FC<{ trajectory: RiskTrajectory; book: Phrasebook }> = ({
  trajectory,
  book,
}) => {
  const ui = book.ui;
  const { points, bestWindow, trend } = trajectory;
  if (!points || points.length === 0) return null;

  const W = 312;
  const H = 46;
  const step = W / points.length;
  const barW = Math.min(26, step * 0.5);
  const maxRank = Math.max(...points.map((p) => RISK_RANK[p.riskLevel] ?? 0), 1);
  const barHeight = (p: RiskTrajectoryPoint): number => 10 + ((RISK_RANK[p.riskLevel] ?? 0) / maxRank) * (H - 16);

  const isBest = (p: RiskTrajectoryPoint): boolean =>
    bestWindow !== null &&
    bestWindow.validHours === p.validHours &&
    bestWindow.riskLevel === p.riskLevel;

  const trendTone =
    trend === 'improving'
      ? 'text-emerald-300 border-emerald-700 bg-emerald-950/40'
      : trend === 'deteriorating'
        ? 'text-rose-300 border-rose-700 bg-rose-950/40'
        : 'text-slate-300 border-slate-700 bg-slate-800/60';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-400">
          {ui.departureWindowRiskWord}
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${trendTone}`}>
          {trend === 'improving' ? ui.easingWord : trend === 'deteriorating' ? ui.tighteningWord : ui.steadyWord}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="w-full"
        role="img"
        aria-label={ui.departureWindowRiskWord}
      >
        {points.map((p, index) => {
          const x = index * step + (step - barW) / 2;
          const h = barHeight(p);
          const y = H - h;
          const best = isBest(p);
          return (
            <g key={p.validHours}>
              {best && (
                <rect
                  x={x - 3}
                  y={-1}
                  width={barW + 6}
                  height={H + 4}
                  rx={4}
                  fill="none"
                  stroke="#22d3ee"
                  strokeDasharray="3 2"
                />
              )}
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2.5}
                fill={RISK_COLOR[p.riskLevel] ?? '#64748b'}
                opacity={best ? 1 : 0.85}
              />
              <text
                x={x + barW / 2}
                y={H + 11}
                textAnchor="middle"
                fontSize="7.5"
                fill="#94a3b8"
              >
                {p.label}
              </text>
              {best ? (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="bold"
                  fill="#22d3ee"
                >
                  {ui.bestWord}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <p className="text-[10px] text-slate-400 leading-snug">
        {bestWindow ? (
          <>
            {ui.leastRiskyWindowWord
              .replace('{label}', bestWindow.label)
              .replace('{risk}', book.riskWords[RISK_ORDER[bestWindow.riskLevel]] ?? bestWindow.riskLevel)
              .replace('{score}', String(bestWindow.safetyScore))
              .replace('{driver}', bestWindow.dominant)}{' '}
            {ui.ratingsNoteWord}
          </>
        ) : (
          ui.noBetterWindowWord
        )}
      </p>
    </div>
  );
};

export default RiskStrip;