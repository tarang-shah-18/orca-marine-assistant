import React from 'react';
import { Anchor, Gauge, Route as RouteIcon, TriangleAlert } from 'lucide-react';
import { RouteData } from '../types';
import { Phrasebook } from '../core/i18n';
import { localizeRouteReason } from '../core/localize';

/**
 * Route card.
 *
 * Shows the corridor the routing engine actually chose, why it beat the
 * alternatives, and — most importantly — which legs exceed this particular
 * vessel's limits. A route that is safe for a trawler can be lethal for a
 * surf canoe, so the per-leg limits are the point of the card, not decoration.
 */
interface RouteCardProps {
  route?: RouteData;
  compact?: boolean;
  book?: Phrasebook;
}

const ClockIcon: React.ReactNode = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const RouteCard: React.FC<RouteCardProps> = ({ route, compact = false, book }) => {
  if (!route) return null;

  const overLimit = route.segments.filter(
    (s) => s.riskLevel === 'HIGH' || s.riskLevel === 'SEVERE',
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
          <RouteIcon className="w-3.5 h-3.5" />
          <span>{book ? book.ui.safestCorridorWord : 'Safest corridor'}</span>
        </span>
        <span className="text-[10px] text-slate-500">
          {route.origin.name} → {route.destination.name}
        </span>
        <span
          className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            route.riskLevel === 'SEVERE' || route.riskLevel === 'HIGH'
              ? 'bg-red-500/20 text-red-300 border-red-500/50'
              : route.riskLevel === 'MODERATE'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
          }`}
        >
          {route.riskLevel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric icon={<RouteIcon className="w-3 h-3" />} label={book ? book.ui.distanceWord : 'Distance'} value={`${route.totalDistanceKm} km`} />
        {/* `ClockIcon` below is a pre-rendered element, not a component, so it
            is passed through as `{ClockIcon}` — `<ClockIcon />` would ask React
            to call a ReactNode. */}
        <Metric icon={ClockIcon} label="ETA" value={route.estimatedTimeHours} />
        <Metric icon={<Gauge className="w-3 h-3" />} label={book ? book.ui.safetyWord : 'Safety'} value={`${route.safetyScore}/100`} />
      </div>

      <p className="text-[11px] text-slate-300 leading-snug">{route.recommendation}</p>

      {overLimit.length > 0 && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/30 p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-300">
            <TriangleAlert className="w-3.5 h-3.5" />
            <span>
              {book
                ? book.ui.legsAboveLimitWord
                    .replace('{n}', String(overLimit.length))
                    .replace('{vessel}', route.vesselLabel)
                : `${overLimit.length} leg${overLimit.length === 1 ? '' : 's'} above the limit for ${route.vesselLabel}`}
            </span>
          </div>
          {overLimit.slice(0, compact ? 2 : 4).map((s) => (
            <div key={s.index} className="text-[10px] text-red-200/80">
              <span className="font-mono">
                {s.from} → {s.to}
              </span>{' '}
              · {s.maxWaveHeightMeters} m / {s.maxWindKnots} kt · {localizeRouteReason(s.reasons[0], book)}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1 pt-1 border-t border-slate-800">
        {route.segments.slice(0, compact ? 3 : route.segments.length).map((s) => (
          <div key={s.index} className="flex items-center gap-2 text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                s.riskLevel === 'SEVERE'
                  ? 'bg-red-500'
                  : s.riskLevel === 'HIGH'
                    ? 'bg-red-400'
                    : s.riskLevel === 'MODERATE'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
              }`}
            />
            <span className="text-slate-300 font-mono">
              {s.from} → {s.to}
            </span>
            <span className="text-slate-500">{s.distanceKm} km</span>
            <span className="text-slate-500">{s.estimatedHours} h</span>
            <span className="ml-auto text-slate-500">
              {s.maxWaveHeightMeters} m · {s.maxWindKnots} kt
            </span>
          </div>
        ))}
      </div>

      {route.alternatives.length > 0 && !compact && (
        <div className="pt-1 border-t border-slate-800">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
            {book ? book.ui.rejectedAlternativesWord : 'Rejected alternatives'}
          </div>
          {route.alternatives.map((alt) => (
            <div key={alt.id} className="text-[10px] text-slate-500">
              <span className="font-mono">{alt.id.replace('route-', '')}</span> · {alt.safetyScore}/100 ·{' '}
              {alt.totalDistanceKm} km — {alt.recommendation.split('.')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
      {icon}
      {label}
    </div>
    <div className="text-[12px] font-bold text-slate-50 font-mono">{value}</div>
  </div>
);

/** Compact one-liner used inside a chat bubble. */
export const RouteSummary: React.FC<{ route: RouteData; book?: Phrasebook }> = ({ route, book }) => (
  <div className="flex items-center gap-2 text-[11px]">
    <Anchor className="w-3.5 h-3.5 text-emerald-400" />
    <span className="text-slate-300">
      {route.totalDistanceKm} km · {route.estimatedTimeHours} · {book ? book.ui.safetyWord : 'safety'} {route.safetyScore}/100
    </span>
  </div>
);

export default RouteCard;
