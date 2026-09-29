import React from 'react';
import { AlarmClock, CloudLightning, Radar, Siren, TimerReset, TriangleAlert } from 'lucide-react';
import { ADVISORY_WEIGHT } from '../../types';
import { Panel, AdvisoryBadge, RiskBadge, SafetyDial, SourceLine } from './widgets';
import { scenarioChipText, type QuickAsk } from './quickAsk';
import type { DashboardProps } from './common';
import { getPhrasebook } from '../../core/i18n';

/**
 * Disaster management dashboard — the escalation watch.
 *
 * Severity-ranked alerts with the operational action each bulletin prescribes,
 * a safety verdict, and the legal/operational limits in force. Safety framing
 * is mandatory here: severity is shown, judgement is left to the authority.
 */
export const DisasterDashboard: React.FC<DashboardProps> = ({
  brief,
  briefLoading,
  bundle,
  language,
  onAsk,
}) => {
  const book = getPhrasebook(language.code);
  const ui = book.ui;
  const quickAsks: QuickAsk[] = [
    { q: 'Any lightning or cyclone alerts active right now?', label: scenarioChipText(language.code, 'lightning-cyclone') },
    { q: 'Is it safe to venture out tomorrow?', label: scenarioChipText(language.code, 'safe-tomorrow') },
    { q: 'Which parts of the coast are under a HIGH or SEVERE advisory?', label: ui.questionDisHighSevere },
    { q: 'What action is prescribed for the current alerts?', label: ui.questionDisAction },
  ];
  const alerts = bundle?.alerts ?? [];
  const ranked = [...alerts].sort(
    (a, b) => ADVISORY_WEIGHT[b.advisoryLevel] - ADVISORY_WEIGHT[a.advisoryLevel],
  );
  const red = ranked.filter((a) => a.advisoryLevel === 'RED');
  const orange = ranked.filter((a) => a.advisoryLevel === 'ORANGE');
  const yellow = ranked.filter((a) => a.advisoryLevel === 'YELLOW');

  const worst = ranked[0] ?? null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Verdict */}
      <section className="xl:col-span-4">
        <Panel
          title={ui.sectorRiskWord}
          icon={Radar}
          accent="rose"
          loading={briefLoading}
        >
          {brief ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="hud-label text-slate-400">{book.labels.risk}</span>
                <RiskBadge level={brief.riskLevel} />
              </div>
              <SafetyDial score={brief.safetyScore} riskLevel={brief.riskLevel} label={ui.safetyIndexWord} />
              <p className="text-xs text-slate-300 leading-relaxed text-center">
                {brief.headline}
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                {brief.disclaimer}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">{ui.briefUnavailable}</p>
          )}
        </Panel>
      </section>

      {/* Worst active bulletin */}
      <section className="xl:col-span-8">
        {worst && worst.advisoryLevel !== 'GREEN' ? (
          <div
            className={`rounded-2xl border p-4 ${
              worst.advisoryLevel === 'RED'
                ? 'border-rose-500/60 bg-rose-950/30 sonar-ping'
                : worst.advisoryLevel === 'ORANGE'
                  ? 'border-orange-500/50 bg-orange-950/25'
                  : 'border-amber-500/40 bg-amber-950/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <Siren
                className={`w-6 h-6 ${
                  worst.advisoryLevel === 'RED'
                    ? 'text-rose-400'
                    : worst.advisoryLevel === 'ORANGE'
                      ? 'text-orange-400'
                      : 'text-amber-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="hud-label text-slate-300">{ui.mostSevereBulletinWord}</span>
                  <AdvisoryBadge level={worst.advisoryLevel} />
                </div>
                <h3 className="text-sm font-bold text-slate-50 mt-1">{worst.title}</h3>
                <p className="text-[11px] text-slate-300 mt-0.5">{worst.description}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  <b className="text-slate-300">{ui.affectedWord}</b> {worst.affectedCoast} ·{' '}
                  {worst.distanceKm.toFixed(0)} km {worst.bearing}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Panel
            title={ui.mostSevereBulletinWord}
            icon={Siren}
            accent="emerald"
            empty={{
              message: ui.noElevatedAdvisoryWord,
              secondary: ui.allSectorsStandingByWord,
            }}
          >
            <div />
          </Panel>
        )}
      </section>

      {/* Prescribed actions */}
      <section className="xl:col-span-5">
        <Panel
          title={ui.prescribedActionsWord}
          icon={AlarmClock}
          accent="rose"
          loading={briefLoading}
          right={
            <button
              onClick={() => onAsk('What action is prescribed for the current alerts?')}
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
            >
              {ui.askShortWord}
            </button>
          }
        >
          {ranked.filter((a) => a.advisoryLevel !== 'GREEN').length === 0 ? (
            <p className="text-xs text-emerald-300">{ui.noActionsRequiredWord}</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {ranked
                .filter((a) => a.advisoryLevel !== 'GREEN')
                .map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-100 truncate">
                        {alert.title}
                      </span>
                      <AdvisoryBadge level={alert.advisoryLevel} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 flex gap-2">
                      <TriangleAlert className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                      {alert.action}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-1.5 flex items-center gap-1">
                      <TimerReset className="w-3 h-3" />
                      {ui.validUntilWord.replace('{date}', alert.validUntil)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Severity matrix */}
      <section className="xl:col-span-7">
        <Panel
          title={ui.severityMatrixWord}
          icon={CloudLightning}
          accent="rose"
          loading={briefLoading}
        >
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-3 text-center">
              <span className="hud-num text-2xl font-bold text-rose-300">{red.length}</span>
              <span className="hud-label text-slate-400 block mt-1">RED</span>
            </div>
            <div className="rounded-xl border border-orange-500/40 bg-orange-950/25 p-3 text-center">
              <span className="hud-num text-2xl font-bold text-orange-300">{orange.length}</span>
              <span className="hud-label text-slate-400 block mt-1">ORANGE</span>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-center">
              <span className="hud-num text-2xl font-bold text-amber-300">{yellow.length}</span>
              <span className="hud-label text-slate-400 block mt-1">YELLOW</span>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
            {ranked.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 text-[11px] text-slate-300 border-b border-slate-800/50 pb-1.5">
                <AdvisoryBadge level={alert.advisoryLevel} />
                <span className="truncate flex-1">{alert.title}</span>
                <span className="text-[9px] text-slate-500 shrink-0">
                  {alert.distanceKm.toFixed(0)} km
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* Quick ask */}
      <section className="xl:col-span-12">
        <Panel title={ui.disasterQuestionsWord} icon={Siren} accent="rose">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {quickAsks.map(({ q, label }) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-rose-500/40 hover:bg-slate-800/40 transition-colors px-3 py-2.5 text-left text-xs text-slate-300"
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