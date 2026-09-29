import React from 'react';
import {
  OctagonAlert,
  TriangleAlert,
  BellRing,
  CloudLightning,
  CloudRain,
  Fish,
  Navigation,
  ShieldCheck,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import type { SituationBrief } from '../services/orcaApi';
import type { AdvisoryLevel, LanguageOption } from '../types';
import { getPhrasebook, seaStateWord } from '../core/i18n';

/**
 * Proactive alert banner.
 *
 * ORCA is not only reactive: this is what the app shows before a fisher has
 * asked anything. It renders from the same pipeline that answers questions, so
 * the banner can never tell a fisherman to go out while the chat would tell
 * them to wait.
 */

const ADVISORY_STYLE: Record<AdvisoryLevel, { ring: string; text: string; bg: string; label: string }> = {
  GREEN: { ring: 'border-emerald-600/40', text: 'text-emerald-300', bg: 'bg-emerald-950/40', label: 'GREEN' },
  YELLOW: { ring: 'border-amber-500/50', text: 'text-amber-300', bg: 'bg-amber-950/40', label: 'YELLOW' },
  ORANGE: { ring: 'border-orange-500/60', text: 'text-orange-300', bg: 'bg-orange-950/50', label: 'ORANGE' },
  RED: { ring: 'border-red-500/70', text: 'text-red-300', bg: 'bg-red-950/60', label: 'RED' },
};

const RISK_STYLE: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  MODERATE: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  SEVERE: 'bg-red-500/25 text-red-300 border-red-500/60',
};

interface AlertBannerProps {
  brief: SituationBrief;
  /** Offline answers must be visibly marked as not-live. */
  offline?: boolean;
  language: LanguageOption;
  onDismiss?: () => void;
  onOpenChat?: () => void;
  expanded?: boolean;
  onToggle?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  brief,
  offline = false,
  language,
  onDismiss,
  onOpenChat,
  expanded = false,
  onToggle,
}) => {
  const book = getPhrasebook(language.code);
  const ui = book.ui;
  const advisory = brief.alert?.advisoryLevel ?? 'GREEN';
  const style = ADVISORY_STYLE[advisory] ?? ADVISORY_STYLE.GREEN;
  const urgent = advisory === 'RED' || advisory === 'ORANGE' || brief.riskLevel === 'SEVERE' || brief.riskLevel === 'HIGH';

  return (
    <div className={`rounded-2xl border ${style.ring} ${style.bg} p-3 space-y-2`}>
      {/* Headline */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          {urgent ? (
            <OctagonAlert className={`w-5 h-5 ${style.text} ${urgent ? 'animate-pulse' : ''}`} />
          ) : brief.alert ? (
            <TriangleAlert className={`w-5 h-5 ${style.text}`} />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-black tracking-wide ${style.text}`}>
              {brief.alert
                ? ui.advisoryWord.replace('{level}', style.label)
                : ui.noActiveAdvisoryWord}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${RISK_STYLE[brief.riskLevel]}`}
            >
              {ui.riskWord} {brief.riskLabel}
            </span>
            {offline && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                {ui.offlineEngine}
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-slate-50 leading-snug mt-0.5">
            {brief.alert?.title ?? brief.headline}
          </p>

          {brief.alert && (
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              {brief.alert.distanceKm} km {brief.alert.bearing} ·{' '}
              {ui.validUntilWord.replace('{date}', brief.alert.validUntil)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              {expanded ? ui.lessWord : ui.detailsWord}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800"
              aria-label={ui.dismissAdvisoryWord}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Prescribed action — quoted, never paraphrased */}
      {brief.alert?.action && urgent && (
        <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5 flex items-center gap-1">
            <BellRing className="w-3 h-3" />
            {ui.prescribedActionWord}
          </div>
          <p className="text-[11px] text-slate-50 leading-snug">{brief.alert.action}</p>
        </div>
      )}

      {/* Quick facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {brief.weather && (
          <Fact
            icon={<Wind className="w-3 h-3" />}
            label={book.labels.wind}
            value={`${brief.weather.windKnots} kt ${brief.weather.windDirection}`}
            sub={ui.gustWord.replace('{n}', String(brief.weather.gustKnots))}
            tone={brief.weather.windKnots >= 20 ? 'warn' : 'calm'}
          />
        )}
        {brief.ocean && (
          <Fact
            icon={<Waves className="w-3 h-3" />}
            label={ui.seaWord}
            value={`${brief.ocean.waveHeightMeters} m`}
            sub={seaStateWord(book, brief.ocean.waveHeightMeters)}
            tone={brief.ocean.waveHeightMeters >= 2 ? 'warn' : 'calm'}
          />
        )}
        {brief.weather && brief.weather.lightningRisk !== 'LOW' && (
          <Fact
            icon={<CloudLightning className="w-3 h-3 text-amber-400" />}
            label={ui.lightningWord}
            value={brief.weather.lightningRisk}
            sub={ui.avoidOpenWaterWord}
            tone="warn"
          />
        )}
        {brief.fishingZone && (
          <Fact
            icon={<Fish className="w-3 h-3" />}
            label={book.labels.ground}
            value={`${brief.fishingZone.distanceKm} km`}
            sub={brief.fishingZone.bearing}
            tone="calm"
          />
        )}
        {brief.tide && (
          <Fact
            icon={<Navigation className="w-3 h-3" />}
            label={book.labels.tide}
            value={`${brief.tide.currentLevelMeters.toFixed(2)} m`}
            sub={brief.tide.isRising ? ui.risingWord : ui.fallingWord}
            tone="calm"
          />
        )}
        {brief.geofencing && brief.geofencing.nearbyCount > 0 && (
          <Fact
            icon={<TriangleAlert className="w-3 h-3" />}
            label={ui.geofenceProximityWord}
            value={ui.nearbyWord.replace('{n}', String(brief.geofencing.nearbyCount))}
            sub={ui.checkBeforeTransitWord}
            tone={brief.geofencing.violations.length > 0 ? 'warn' : 'calm'}
          />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-slate-800/70">
          {brief.weather?.squallWarning && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
              <CloudRain className="w-3.5 h-3.5" />
              {ui.squallWarningWord}
            </div>
          )}
          {brief.recommendation && (
            <p className="text-[11px] text-slate-200 leading-snug">{brief.recommendation}</p>
          )}
          {brief.sources.length > 0 && (
            <p className="text-[10px] text-slate-500">
              {ui.sourcesPrefixWord} {brief.sources.slice(0, 3).join(' · ')}
            </p>
          )}
          <p className="text-[10px] text-amber-200/70 leading-snug">{brief.disclaimer}</p>
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold"
            >
              {ui.askOrcaAboutWord}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'calm' | 'warn';
}> = ({ icon, label, value, sub, tone }) => (
  <div
    className={`rounded-lg border px-2 py-1.5 ${
      tone === 'warn' ? 'border-amber-700/50 bg-amber-950/30' : 'border-slate-800 bg-slate-950/40'
    }`}
  >
    <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
      {icon}
      {label}
    </div>
    <div className="text-[12px] font-bold text-slate-50 font-mono leading-tight">{value}</div>
    {sub && <div className="text-[9px] text-slate-400 truncate">{sub}</div>}
  </div>
);

export default AlertBanner;
