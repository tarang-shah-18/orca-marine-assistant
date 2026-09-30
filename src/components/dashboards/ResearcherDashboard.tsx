import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  FlaskConical,
  Radar,
  Table2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  historicalProductivity,
  hotspotScience,
  type HistoricalOutcome,
  type HotspotOutcome,
} from '../../services/orcaApi';
import { Charts } from '../Charts';
import { Panel, Readout, SourceLine } from './widgets';
import { scenarioChipText, type QuickAsk } from './quickAsk';
import type { DashboardProps } from './common';
import { getPhrasebook } from '../../core/i18n';

/**
 * Researcher dashboard — the productivity science console.
 *
 * Fetches the same `/historical` and `/hotspots` products the DECISION_CHAT
 * answers with, so the dashboard and a conversational answer can never
 * disagree about a trend.
 */
export const ResearcherDashboard: React.FC<DashboardProps> = ({
  harbor,
  language,
  onAsk,
}) => {
  const book = getPhrasebook(language.code);
  const ui = book.ui;
  const quickAsks: QuickAsk[] = [
    { q: 'Why has fish productivity declined in my region?', label: scenarioChipText(language.code, 'productivity-decline') },
    { q: 'Show the chlorophyll and SST trend for the last three years.', label: ui.questionResTrend },
    { q: 'What factors correlate with the landing index here?', label: ui.questionResFactor },
    { q: 'Compare productivity across the last two monsoon seasons.', label: ui.questionResMonsoon },
  ];
  const [history, setHistory] = useState<HistoricalOutcome | null>(null);
  const [science, setScience] = useState<HotspotOutcome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      historicalProductivity(harbor.id, language.code),
      hotspotScience(harbor.id, language.code),
    ]).then(([h, s]) => {
      if (!alive) return;
      setHistory(h);
      setScience(s);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [harbor.id, language.code]);

  const diag = history?.diagnosis;
  const trendUp = diag && diag.fishProductivityTrend === 'increasing';
  const trendDown = diag && diag.fishProductivityTrend === 'decreasing';
  const hotspot = science?.hotspot;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Diagnosis */}
      <section className="xl:col-span-5">
        <Panel
          title={book.labels.productivity}
          icon={Activity}
          accent="violet"
          loading={loading}
          right={
            diag && (
              <span className="hud-label text-slate-500">
                {diag.timeRange.start} → {diag.timeRange.end}
              </span>
            )
          }
        >
          {diag && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">{diag.region}</span>
                {trendUp && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                {trendDown && <TrendingDown className="w-4 h-4 text-rose-400" />}
                <span
                  className={`ml-auto inline-flex items-center gap-1 text-xs font-bold ${
                    trendUp
                      ? 'text-emerald-300'
                      : trendDown
                        ? 'text-rose-300'
                        : 'text-slate-300'
                  }`}
                >
                  {trendUp && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {trendDown && <ArrowDownRight className="w-3.5 h-3.5" />}
                  {diag.productivityChangePercent > 0 ? '+' : ''}
                  {diag.productivityChangePercent.toFixed(0)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Readout
                  label={ui.landingsEffortWord}
                  value={diag.cpue.toFixed(1)}
                  unit="t/1000 boat-days"
                />
                <Readout
                  label={ui.cpueChangeWord}
                  value={`${diag.cpueChangePercent > 0 ? '+' : ''}${diag.cpueChangePercent.toFixed(0)}`}
                  unit="%"
                />
              </div>

              <div>
                <span className="hud-label text-slate-500 mb-1.5 block">{ui.keyFactorsWord}</span>
                <ul className="space-y-1">
                  {diag.keyFactors.map((factor) => (
                    <li
                      key={factor}
                      className="text-[11px] text-slate-300 flex gap-2 border-b border-slate-800/50 pb-1 last:border-0"
                    >
                      <span className="text-violet-400 shrink-0">▸</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="hud-label text-slate-500 mb-1.5 block">
                  {ui.correlationAnalysisWord}
                </span>
                <ul className="space-y-1">
                  {diag.correlationAnalysis.map((c) => (
                    <li key={c} className="text-[11px] text-slate-300 flex gap-2">
                      <span className="text-cyan-400 shrink-0">▪</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-slate-400">
                  {ui.chlorophyllWord}: <b className="text-slate-200">{diag.chlorophyllTrend}</b>
                </span>
                <span className="text-[10px] text-slate-400">
                  {book.labels.sst}: <b className="text-slate-200">{diag.sstTrend}</b>
                </span>
              </div>
            </div>
          )}
        </Panel>
      </section>

      {/* Hotspot science */}
      <section className="xl:col-span-7">
        <Panel
          title={ui.hotspotScanWord}
          icon={Radar}
          accent="emerald"
          loading={loading}
          right={
            <button
              onClick={() =>
                onAsk('Which regions show high chlorophyll and favourable sea surface temperature?')
              }
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
            >
              {ui.askOrcaWord}
            </button>
          }
        >
          {hotspot ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3">
                <p className="text-sm font-semibold text-slate-100">{hotspot.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{hotspot.note}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <Readout
                    label={ui.chlorophyllWord}
                    value={hotspot.chlorophyllMgM3.toFixed(2)}
                    unit="mg/m³"
                  />
                  <Readout
                    label={book.labels.sst}
                    value={hotspot.sstCelsius.toFixed(1)}
                    unit="°C"
                  />
                  <Readout
                    label={ui.sstAnomalyWord}
                    value={`${hotspot.sstAnomalyC > 0 ? '+' : ''}${hotspot.sstAnomalyC.toFixed(1)}`}
                    unit="°C"
                  />
                  <Readout
                    label={book.labels.productivity}
                    value={hotspot.productivityIndex.toFixed(0)}
                    unit="/100"
                  />
                </div>
                {hotspot.dominantSpecies.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <span className="hud-label text-slate-500">{ui.targetSpeciesWord}</span>
                    {hotspot.dominantSpecies.map((species) => (
                      <span
                        key={species}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300"
                      >
                        {species}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {science && (
                <SourceLine
                  sources={['INCOIS PFZ advisory', 'MODIS/VIIRS ocean colour']}
                  label={book.labels.sources}
                />
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{ui.noHotspotScanWord}</p>
          )}
        </Panel>
      </section>

      {/* Time series */}
      <section className="xl:col-span-8">
        <Panel title={ui.longRunOceanographyWord} icon={BarChart3} accent="cyan" loading={loading}>
          {history && history.visualizations.length > 0 ? (
            <div className="overflow-y-auto max-h-96">
              <Charts visualizations={history.visualizations} book={book} />
            </div>
          ) : (
            <p className="text-xs text-slate-500">{ui.noVisualisationsWord}</p>
          )}
        </Panel>
      </section>

      {/* Zones table */}
      <section className="xl:col-span-4">
        <Panel title={ui.nearestGroundsWord} icon={Table2} accent="sky">
          {science && science.zones.length > 0 ? (
            <div className="space-y-1.5 overflow-y-auto max-h-96">
              {science.zones.map((zone, index) => (
                <button
                  key={zone.id}
                  onClick={() => onAsk(`How good is fishing at ${zone.name}?`)}
                  className="w-full text-left rounded-lg border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 transition-colors px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-200 truncate">
                      {index + 1}. {zone.name}
                    </span>
                    <span className="hud-num text-[11px] font-bold text-emerald-300">
                      {zone.productivityIndex}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500">
                    {zone.distanceKm.toFixed(0)} km {zone.bearing} · {zone.status}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{ui.noGroundsWord}</p>
          )}
        </Panel>
        </section>

        {/* Quick science */}
        <section className="xl:col-span-12">
          <Panel title={ui.researchQuestionsWord} icon={FlaskConical} accent="violet">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {quickAsks.map(({ q, label }) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/40 hover:bg-slate-800/40 transition-colors px-3 py-2.5 text-left text-xs text-slate-300"
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
};