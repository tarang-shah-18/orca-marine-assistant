import React from 'react';
import {
  CloudLightning,
  CloudSun,
  Fish,
  MapPin,
  Navigation,
  Waves,
  Wind,
} from 'lucide-react';
import { AlertBanner } from '../AlertBanner';
import { Panel, Readout, RiskBadge, SafetyDial, SourceLine } from './widgets';
import { scenarioChipText, type QuickAsk } from './quickAsk';
import type { DashboardProps } from './common';
import { getPhrasebook, seaStateWord } from '../../core/i18n';

/**
 * Fisher dashboard — the go / no-go console.
 *
 * Everything a skipper needs before casting off, in the order they need it:
 * the verdict first, then the tide, the sea, the weather, and finally where
 * the fish are and how to get there.
 */
export const FisherDashboard: React.FC<DashboardProps> = ({
  brief,
  briefOffline,
  briefLoading,
  bundle,
  language,
  onAsk,
  onOpenMap,
}) => {
  const book = getPhrasebook(language.code);
  const ui = book.ui;
  const quickAsks: QuickAsk[] = [
    { q: 'Where is the nearest fishing zone from here?', label: scenarioChipText(language.code, 'nearest-pfz') },
    { q: 'Is it safe to venture out tomorrow morning?', label: scenarioChipText(language.code, 'safe-tomorrow') },
    { q: 'What are the tide and weather like near my fishing location today?', label: scenarioChipText(language.code, 'tide-weather-sea') },
    { q: 'Any lightning or cyclone alerts near my harbour?', label: scenarioChipText(language.code, 'lightning-cyclone') },
  ];
  const weather = brief?.weather;
  const ocean = brief?.ocean;
  const tide = brief?.tide;
  const zone = brief?.fishingZone;

  const windTone =
    weather && weather.windKnots > 25
      ? 'bad'
      : weather && weather.windKnots > 17
        ? 'warn'
        : 'good';
  const waveTone =
    ocean && ocean.waveHeightMeters > 2.5
      ? 'bad'
      : ocean && ocean.waveHeightMeters > 1.6
        ? 'warn'
        : 'good';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Verdict */}
      <section className="xl:col-span-4 ops-panel p-5">
        {briefLoading ? (
          <div className="min-h-64 flex items-center justify-center">
            <span className="hud-label text-slate-500 animate-pulse">{ui.scanningHorizon}</span>
          </div>
        ) : brief ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span className="hud-label text-slate-400">{brief.riskLabel}</span>
              </div>
              <RiskBadge level={brief.riskLevel} />
            </div>
            <SafetyDial score={brief.safetyScore} riskLevel={brief.riskLevel} label={ui.safetyIndexWord} />
            <p className="text-sm font-semibold text-slate-100 mt-3 leading-snug">
              {brief.headline}
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {brief.recommendation}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">
                {new Date(brief.timestamp).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {briefOffline && (
                <span className="text-[10px] font-bold text-amber-300 border border-amber-500/50 rounded px-1.5 py-0.5">
                  {ui.offlineEngine}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">{ui.briefUnavailable}</p>
        )}
      </section>

      {/* Alert */}
      <section className="xl:col-span-8 xl:row-span-1">
        {brief?.alert ? (
          <AlertBanner
            brief={brief}
            offline={briefOffline}
            language={language}
            expanded
            onOpenChat={() => onAsk('Tell me more about the current marine alert.')}
          />
        ) : (
          <Panel
            title={ui.activeAdvisory}
            icon={CloudSun}
            accent="emerald"
            empty={
              !briefLoading
                ? {
                    message: ui.noActiveAdvisory,
                    secondary: ui.standingBy,
                  }
                : undefined
            }
            loading={briefLoading}
          >
            <div />
          </Panel>
        )}
      </section>

      {/* Instruments */}
      <section className="xl:col-span-5">
        <Panel title={book.labels.tide} icon={Waves} accent="cyan" loading={briefLoading}>
          {tide && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Readout
                  label={ui.currentLevelWord}
                  value={tide.currentLevelMeters.toFixed(1)}
                  unit="m"
                />
                <span
                  className={`text-[11px] font-bold ${
                    tide.isRising ? 'text-emerald-300' : 'text-sky-300'
                  }`}
                >
                  {tide.isRising ? ui.risingWord : ui.fallingWord}
                </span>
              </div>
              <Readout
                label={ui.tideRangeWord}
                value={tide.rangeMeters.toFixed(2)}
                unit="m"
              />
              {tide.nextEvent && (
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/60 p-2.5">
                  <span className="hud-label text-slate-500">
                    {ui.nextEventWord} · {tide.nextEvent.type}
                  </span>
                  <p className="text-sm font-semibold text-slate-100 mt-0.5">
                    {tide.nextEvent.label}
                    <span className="text-slate-400 font-normal ml-2">
                      {tide.nextEvent.heightMeters.toFixed(1)} m
                    </span>
                  </p>
                </div>
              )}
              {tide.recommendedWindow && (
                <div className="rounded-lg bg-cyan-950/40 border border-cyan-500/30 p-2.5">
                  <span className="hud-label text-cyan-300">{ui.recommendedWindowWord}</span>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {tide.recommendedWindow.startLabel} → {tide.recommendedWindow.endLabel} ·{' '}
                    {tide.recommendedWindow.durationHours}h ({tide.recommendedWindow.quality})
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">{tide.recommendedWindow.reason}</p>
                </div>
              )}
            </div>
          )}
        </Panel>
      </section>

      <section className="xl:col-span-3">
        <Panel title={ui.oceanStateWord} icon={Navigation} accent="sky" loading={briefLoading}>
          {ocean && (
            <div className="space-y-3">
              <Readout
                label={ui.waveHeightWord}
                value={ocean.waveHeightMeters.toFixed(1)}
                unit="m"
                tone={waveTone}
              />
              <Readout
                label={ui.wavePeriodWord}
                value={ocean.wavePeriodSeconds.toFixed(0)}
                unit="s"
              />
              <Readout label={book.labels.sst} value={ocean.sstCelsius.toFixed(1)} unit="°C" />
              <Readout label={ui.currentWord} value={ocean.currentKnots.toFixed(1)} unit="kn" />
              <p className="text-[10px] text-slate-400">
                {seaStateWord(book, ocean.waveHeightMeters)} · {ui.swellWord} {ocean.swellDirection}
              </p>
            </div>
          )}
        </Panel>
      </section>

      <section className="xl:col-span-4">
        <Panel title={book.labels.weather} icon={Wind} accent="amber" loading={briefLoading}>
          {weather && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Readout
                  label={book.labels.wind}
                  value={weather.windKnots.toFixed(0)}
                  unit="kn"
                  tone={windTone}
                />
                <span className="text-[11px] text-slate-400">{weather.windDirection}</span>
              </div>
              <Readout label={ui.gustsWord} value={weather.gustKnots.toFixed(0)} unit="kn" tone={windTone} />
              <div className="grid grid-cols-2 gap-3">
                <Readout
                  label={ui.visibilityWord}
                  value={weather.visibilityKm.toFixed(0)}
                  unit="km"
                />
                <Readout
                  label={ui.rainChanceWord}
                  value={weather.rainProbability.toFixed(0)}
                  unit="%"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{weather.condition}</span>
                {weather.lightningRisk !== 'LOW' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                    <CloudLightning className="w-3.5 h-3.5" />
                    {ui.lightningWord} {weather.lightningRisk}
                  </span>
                )}
              </div>
            </div>
          )}
        </Panel>
      </section>

      {/* Fish & route */}
      <section className="xl:col-span-7">
        <Panel
          title={ui.potentialFishingZonesWord}
          icon={Fish}
          accent="emerald"
          loading={briefLoading}
          right={
            <button
              onClick={() => onOpenMap()}
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
            >
              {ui.openMap}
            </button>
          }
        >
          <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
            {(bundle?.fishingZones?.length ? bundle.fishingZones : zone ? [zone] : []).map(
              (z, index) => {
                const species =
                  'targetFishSpecies' in z ? z.targetFishSpecies : z.species;
                return (
                  <button
                    key={z.id}
                    onClick={() => onOpenMap()}
                    className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:border-cyan-600/50 hover:bg-slate-800/40 transition-colors p-3 flex items-center gap-3"
                  >
                    <span className="hud-num text-cyan-400 text-sm font-bold w-6">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-100 truncate">{z.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {z.distanceKm.toFixed(0)} km {z.bearing} · {species?.slice(0, 2).join(', ') ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="hud-num text-sm font-bold text-emerald-300">
                        {z.productivityIndex}
                      </span>
                      <span className="text-[9px] text-slate-500 block">INDEX</span>
                    </div>
                  </button>
                );
              },
            )}
            {bundle?.fishingZones?.length === 0 && !zone && (
              <p className="text-xs text-slate-500">{ui.noPfzAdvisories}</p>
            )}
          </div>
        </Panel>
      </section>

      <section className="xl:col-span-5">
        <Panel
          title={ui.typicalQuestionsWord}
          icon={Navigation}
          accent="cyan"
        >
          <div className="space-y-2">
            {quickAsks.map(({ q, label }) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 hover:border-cyan-600/50 hover:bg-slate-800/40 transition-colors px-3 py-2.5 text-xs text-slate-300"
              >
                {label}
              </button>
            ))}
          </div>
          {brief && <SourceLine sources={brief.sources} label={book.labels.sources} />}
        </Panel>
      </section>
    </div>
  );
};