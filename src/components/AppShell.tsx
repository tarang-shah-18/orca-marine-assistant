import React from 'react';
import {
  Anchor,
  Bot,
  Compass,
  Fish,
  FlaskConical,
  Globe,
  Info,
  Landmark,
  LayoutDashboard,
  Map,
  MessageSquare,
  Moon,
  Radar,
  RefreshCw,
  Satellite,
  Siren,
  Sun,
  Waves,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PERSONAS, PersonaId } from '../personas';
import type { HarborLocation, LanguageOption } from '../types';
import type { EngineStatus } from '../services/orcaApi';
import { HARBORS } from '../core/dataset';
import { UiStrings, getPhrasebook } from '../core/i18n';
import { localizeProductSource } from '../core/localize';

export type ViewId = 'dashboard' | 'map' | 'chat' | 'info' | 'fleet';

interface AppShellProps {
  persona: PersonaId;
  onPersonaChange: (persona: PersonaId) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  harbor: HarborLocation;
  onSelectHarbor: (harbor: HarborLocation) => void;
  language: LanguageOption;
  onOpenLanguage: () => void;
  status: EngineStatus | null;
  onRefreshBrief: () => void;
  briefLoading: boolean;
  gpsFix: { latitude: number; longitude: number } | null;
  gpsState: 'idle' | 'locating' | 'ok' | 'denied';
  onToggleGps: () => void;
  children: React.ReactNode;
}

const PERSONA_ICON: Record<PersonaId, React.ComponentType<{ className?: string }>> = {
  fisher: Fish,
  researcher: FlaskConical,
  coastal: Landmark,
  disaster: Siren,
  maritime: Anchor,
};

const VIEW_TABS: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'GIS Map', icon: Map },
  { id: 'chat', label: 'Decision Chat', icon: MessageSquare },
  { id: 'fleet', label: 'Fleet Watch', icon: Waves },
  { id: 'info', label: 'Platform', icon: Info },
];

/** Translates a persona chip's label, tagline and description for the active language. */
function personaUi(ui: UiStrings) {
  return {
    fisher: { label: ui.personaFisher, tag: ui.tagFisher, desc: ui.descFisher },
    researcher: { label: ui.personaResearcher, tag: ui.tagResearcher, desc: ui.descResearcher },
    coastal: { label: ui.personaCoastal, tag: ui.tagCoastal, desc: ui.descCoastal },
    disaster: { label: ui.personaDisaster, tag: ui.tagDisaster, desc: ui.descDisaster },
    maritime: { label: ui.personaMaritime, tag: ui.tagMaritime, desc: ui.descMaritime },
  } as const;
}

const NAV_UI_KEYS: Record<ViewId, keyof UiStrings> = {
  dashboard: 'navDashboard',
  map: 'navMap',
  chat: 'navChat',
  fleet: 'navFleet',
  info: 'navInfo',
};

export const AppShell: React.FC<AppShellProps> = ({
  persona,
  onPersonaChange,
  theme,
  onToggleTheme,
  view,
  onViewChange,
  harbor,
  onSelectHarbor,
  language,
  onOpenLanguage,
  status,
  onRefreshBrief,
  briefLoading,
  gpsFix,
  gpsState,
  onToggleGps,
  children,
}) => {
  const offline = status?.offline ?? false;
  const version = offline ? `in-browser v${status?.version ?? ''}` : `v${status?.version ?? '—'}`;
  const ui = getPhrasebook(language.code).ui;
  const book = getPhrasebook(language.code);
  const personaNames = personaUi(ui);
  const tabs = VIEW_TABS.map((tab) => ({ ...tab, label: ui[NAV_UI_KEYS[tab.id]] })) as typeof VIEW_TABS;

  return (
    <div className="h-screen overflow-hidden flex flex-col text-slate-100">
      {/* ============ Top bar ============ */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="px-4 lg:px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative w-9 h-9 rounded-xl border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-cyan-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 sonar-ping" />
            </span>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold tracking-[0.22em] text-slate-50 text-sm">ORCA</h1>
                <span className="hidden sm:inline text-[9px] font-bold text-cyan-300 border border-cyan-500/40 rounded px-1.5 py-0.5 tracking-wider">
                  SIH 2026 · 26176
                </span>
              </div>
              <p className="text-[9px] text-slate-400 tracking-[0.14em] uppercase">
                {ui.platformTagline}
              </p>
            </div>
          </div>

          {/* Engine status */}
          <div className="flex items-center gap-2 ml-auto">
            <span
              className={`hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold ${
                offline ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {offline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              {offline ? ui.offlineEngine : ui.live}
              <span className="text-slate-500 font-medium">· {version}</span>
            </span>
            <button
              onClick={onRefreshBrief}
              disabled={briefLoading}
              className="p-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50"
              title={ui.refresh}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onToggleGps}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                gpsState === 'ok'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : gpsState === 'locating'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
              title={ui.useGps}
            >
              {gpsState === 'locating' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Compass className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">
                {gpsFix
                  ? `GPS ${gpsFix.latitude.toFixed(2)}°, ${gpsFix.longitude.toFixed(2)}°`
                  : gpsState === 'denied'
                    ? ui.gpsDenied
                    : ui.useGps}
              </span>
            </button>
            <button
              onClick={onOpenLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors"
              title={ui.changeLanguage}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{language.nativeLabel}</span>
            </button>
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 transition-colors"
              title={theme === 'dark' ? ui.themeLightWord : ui.themeDarkWord}
              aria-label={theme === 'dark' ? ui.themeLightWord : ui.themeDarkWord}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
          </div>
        </div>

        {/* Persona switcher */}
        <div className="px-4 lg:px-6 pb-2 flex gap-1.5 overflow-x-auto scroll-thin">
          {PERSONAS.map((p) => {
            const active = p.id === persona;
            const Icon = PERSONA_ICON[p.id];
            const localized = personaNames[p.id];
            return (
              <button
                key={p.id}
                onClick={() => onPersonaChange(p.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title={localized.desc}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{localized.label}</span>
              </button>
            );
          })}
        </div>

        {/* Controls row: harbour + tabs */}
        <div className="px-4 lg:px-6 pb-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Compass className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={harbor.id}
              onChange={(event) => {
                const next = HARBORS.find((h) => h.id === event.target.value);
                if (next) onSelectHarbor(next);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-cyan-500/60"
            >
              {HARBORS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.shortName} · {h.state}
                </option>
              ))}
            </select>
          </label>

          <nav className="flex items-center gap-1 ml-auto">
            {tabs.map((tab) => {
              const active = view === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onViewChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Data cycle strip */}
      <div className="px-4 lg:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800/60 bg-slate-900/30">
        <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">
          <Satellite className="w-3 h-3 text-cyan-500" />
          {ui.dataCycle}
        </span>
        {status?.dataCycle ? (
          <>
            <span className="text-[10px] text-slate-300 font-medium">{status.dataCycle.label}</span>
            <span className="text-[10px] text-slate-500 hud-num">#{status.dataCycle.cycle}</span>
            <span className="hidden lg:flex items-center gap-1.5 flex-wrap">
              {status.dataCycle.sources.slice(0, 4).map((source) => (
                <span
                  key={source}
                  className="px-1.5 py-0.5 rounded bg-slate-800/70 text-[9px] text-slate-400 border border-slate-700/60"
                >
                  {localizeProductSource(source, book)}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-slate-500">
            {offline ? ui.browserDataset : ui.loading}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-slate-500">
          <Bot className="w-3 h-3" />
          {status?.counts.agents ?? '—'} {ui.agentsWord} · {status?.counts.languages ?? '—'}{' '}
          {ui.languagesWord} · {status?.counts.harbours ?? '—'} {ui.harboursWord}
        </span>
      </div>

      {/* Main */}
      <main className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 p-4 lg:p-6 overflow-y-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-4 lg:px-6 py-2.5 text-[9px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>ORCA Marine Intelligence · SIH 2026 Problem 26176 · ISRO / Dept. of Space</span>
        <span className="hidden sm:inline">{ui.footerDisclaimer}</span>
      </footer>
    </div>
  );
};