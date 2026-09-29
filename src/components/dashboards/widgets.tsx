/**
 * Shared dashboard primitives.
 *
 * These are the instruments of the ops console: every persona dashboard is a
 * composition of the same panels, tiles and badges so the platform reads as a
 * single instrument suite even though each role sees a different layout.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import type { Accent } from '../../personas';
import type { AdvisoryLevel, RiskLevel } from '../../types';

/* ------------------------------------------------------------------ *
 * Accent maps
 * ------------------------------------------------------------------ */

export const ACCENT_TEXT: Record<Accent, string> = {
  cyan: 'text-cyan-400',
  violet: 'text-violet-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
  emerald: 'text-emerald-400',
};

export const ACCENT_BORDER: Record<Accent, string> = {
  cyan: 'border-cyan-500/40',
  violet: 'border-violet-500/40',
  amber: 'border-amber-500/40',
  rose: 'border-rose-500/40',
  sky: 'border-sky-500/40',
  emerald: 'border-emerald-500/40',
};

export const ACCENT_BG: Record<Accent, string> = {
  cyan: 'bg-cyan-500/10',
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
  rose: 'bg-rose-500/10',
  sky: 'bg-sky-500/10',
  emerald: 'bg-emerald-500/10',
};

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  accent?: Accent;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  /** Render a full-height empty state instead of the body. */
  empty?: { message: string; secondary?: string };
}

export const Panel: React.FC<PanelProps> = ({
  title,
  icon: Icon,
  accent = 'cyan',
  right,
  children,
  className = '',
  loading = false,
  empty,
}) => {
  return (
    <section className={`ops-panel flex flex-col min-h-0 ${className}`}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-slate-800/70">
        {Icon && (
          <span className={`${ACCENT_TEXT[accent]} shrink-0`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <h3 className="hud-label text-slate-300 truncate">{title}</h3>
        {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
      </header>
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        {loading ? (
          <div className="h-full min-h-24 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        ) : empty ? (
          <div className="h-full min-h-24 flex flex-col items-center justify-center text-center gap-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400/80" />
            <p className="text-xs text-slate-300 font-medium">{empty.message}</p>
            {empty.secondary && (
              <p className="text-[10px] text-slate-500 max-w-[26ch]">{empty.secondary}</p>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ *
 * Tiles & readouts
 * ------------------------------------------------------------------ */

interface ReadoutProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

const TONE_TEXT: Record<NonNullable<ReadoutProps['tone']>, string> = {
  default: 'text-slate-100',
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
};

/** One labelled numeric instrument, e.g. "WAVE HEIGHT → 2.4 m". */
export const Readout: React.FC<ReadoutProps> = ({ label, value, unit, tone = 'default' }) => (
  <div className="flex flex-col gap-0.5">
    <span className="hud-label text-slate-500">{label}</span>
    <span className={`hud-num text-lg leading-tight font-semibold ${TONE_TEXT[tone]}`}>
      {value}
      {unit && <span className="text-[11px] font-medium text-slate-500 ml-1">{unit}</span>}
    </span>
  </div>
);

interface MetricProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
}

/** A compact label/value row for dense panels. */
export const Metric: React.FC<MetricProps> = ({ label, value, sub }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-800/50 last:border-0">
    <span className="text-[11px] text-slate-400 truncate">{label}</span>
    <span className="text-right">
      <span className="text-xs font-semibold text-slate-100 hud-num">{value}</span>
      {sub && <span className="text-[10px] text-slate-500 block">{sub}</span>}
    </span>
  </div>
);

/* ------------------------------------------------------------------ *
 * Badges
 * ------------------------------------------------------------------ */

const RISK_STYLE: Record<RiskLevel, string> = {
  LOW: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  MODERATE: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  HIGH: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
  SEVERE: 'border-rose-500/60 bg-rose-500/15 text-rose-300',
};

export const RiskBadge: React.FC<{ level: RiskLevel; label?: string }> = ({ level, label }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wide ${RISK_STYLE[level]}`}
  >
    {level === 'SEVERE' || level === 'HIGH' ? (
      <TriangleAlert className="w-3 h-3" />
    ) : level === 'LOW' ? (
      <CheckCircle2 className="w-3 h-3" />
    ) : (
      <AlertTriangle className="w-3 h-3" />
    )}
    {label ?? level}
  </span>
);

const ADVISORY_STYLE: Record<AdvisoryLevel, string> = {
  GREEN: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  YELLOW: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  ORANGE: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
  RED: 'border-rose-500/60 bg-rose-500/15 text-rose-300',
};

export const AdvisoryBadge: React.FC<{ level: AdvisoryLevel }> = ({ level }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wider ${ADVISORY_STYLE[level]}`}
  >
    {level}
  </span>
);

export const OfflineTag: React.FC<{ offline: boolean; label?: string }> = ({
  offline,
  label = 'OFFLINE ENGINE',
}) =>
  offline ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/50 bg-amber-500/10 text-[10px] font-bold text-amber-300">
      {label}
    </span>
  ) : null;

/* ------------------------------------------------------------------ *
 * Safety dial
 * ------------------------------------------------------------------ */

interface DialProps {
  score: number;
  riskLevel: RiskLevel;
  label?: string;
}

const DIAL_COLOR: Record<RiskLevel, string> = {
  LOW: 'stroke-emerald-400',
  MODERATE: 'stroke-amber-400',
  HIGH: 'stroke-orange-400',
  SEVERE: 'stroke-rose-400',
};

/** Radial safety-score gauge, the single most asked instrument. */
export const SafetyDial: React.FC<DialProps> = ({ score, riskLevel, label = 'SAFETY INDEX' }) => {
  // Arc spans 270° starting at 135°, scored 0-100.
  const clamped = Math.max(0, Math.min(100, score));
  const arc = (clamped / 100) * 270;
  const dash = `${arc} ${360 - arc}`;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[135deg]">
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="270 360"
          pathLength="360"
        />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={dash}
          pathLength="360"
          className={`${DIAL_COLOR[riskLevel]} transition-all duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="hud-num text-4xl font-bold text-slate-50">{clamped}</span>
        <span className="hud-label text-slate-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export const SourceLine: React.FC<{ sources: string[]; label?: string }> = ({
  sources,
  label = 'Sources',
}) => {
  if (sources.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-2 border-t border-slate-800/60">
      <Info className="w-3 h-3 text-slate-500 shrink-0" />
      <span className="hud-label text-slate-500">{label}</span>
      {sources.slice(0, 3).map((source) => (
        <span
          key={source}
          className="px-1.5 py-0.5 rounded bg-slate-800/70 text-[9px] text-slate-400 border border-slate-700/60"
        >
          {source}
        </span>
      ))}
    </div>
  );
};