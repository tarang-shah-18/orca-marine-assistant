import React from 'react';
import { Landmark, MapPinned, ShieldAlert, ShieldCheck, Waves } from 'lucide-react';
import { ADVISORY_WEIGHT } from '../../types';
import { Panel, AdvisoryBadge, OfflineTag, RiskBadge, SourceLine } from './widgets';
import type { DashboardProps } from './common';
import { getPhrasebook } from '../../core/i18n';

/**
 * Coastal authority dashboard — the jurisdiction compliance console.
 *
 * Alerts ranked by advisory weight rather than distance, geofenced water
 * with the regulating authority attached, and the situation at the selected
 * harbour.
 */
export const CoastalDashboard: React.FC<DashboardProps> = ({
  brief,
  briefOffline,
  briefLoading,
  bundle,
  bundleOffline,
  language,
  onAsk,
}) => {
  const book = getPhrasebook(language.code);
  const ui = book.ui;
  const alerts = bundle?.alerts ?? [];
  const nearby = bundle?.geofencing?.nearbyBoundaries ?? [];
  const violations = bundle?.geofencing?.violations ?? [];
  const reduced = bundle?.geofences ?? [];

  const rankedAlerts = [...alerts].sort(
    (a, b) => ADVISORY_WEIGHT[b.advisoryLevel] - ADVISORY_WEIGHT[a.advisoryLevel],
  );
  const nonGreen = rankedAlerts.filter((a) => a.advisoryLevel !== 'GREEN');
  const green = rankedAlerts.filter((a) => a.advisoryLevel === 'GREEN');

  const criticalBoundaries = reduced.filter((g) => g.severity === 'CRITICAL' || g.severity === 'HIGH');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Harbour situation */}
      <section className="xl:col-span-4">
        <Panel
          title={ui.harbourSituationWord}
          icon={Landmark}
          accent="amber"
          loading={briefLoading}
          right={<OfflineTag offline={briefOffline} label={ui.offlineEngine} />}
        >
          {brief ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{brief.headline}</span>
                <RiskBadge level={brief.riskLevel} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/60 p-2.5">
                  <span className="hud-label text-slate-500">{ui.safetyIndexWord}</span>
                  <p className="hud-num text-xl font-bold text-slate-100 mt-0.5">
                    {brief.safetyScore}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/60 p-2.5">
                  <span className="hud-label text-slate-500">{book.labels.risk}</span>
                  <p className="text-sm font-bold mt-1.5">
                    <RiskBadge level={brief.riskLevel} />
                  </p>
                </div>
              </div>
              {brief.geofencing && brief.geofencing.nearbyCount > 0 && (
                <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-2.5">
                  <span className="hud-label text-amber-300 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> {ui.geofenceProximityWord}
                  </span>
                  <p className="text-xs text-slate-200 mt-1">
                    {ui.boundariesWithinReachWord.replace(
                      '{count}',
                      String(brief.geofencing.nearbyCount),
                    )}{' '}
                    ·{' '}
                    {ui.violationsWord.replace('{count}', String(brief.geofencing.violations.length))}
                  </p>
                </div>
              )}
              {brief && <SourceLine sources={brief.sources} label={book.labels.sources} />}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{ui.briefUnavailable}</p>
          )}
        </Panel>
      </section>

      {/* Advisory log */}
      <section className="xl:col-span-8">
        <Panel
          title={ui.activeAdvisoriesCoastWord}
          icon={Waves}
          accent="amber"
          loading={briefLoading}
          right={
            <button
              onClick={() => onAsk('List the active marine alerts on this coast.')}
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
            >
              {ui.askOrcaWord}
            </button>
          }
        >
          {nonGreen.length === 0 && (
            <p className="text-xs text-emerald-300 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> {ui.noElevatedAdvisoriesWord}
            </p>
          )}
          <div className="space-y-2.5 overflow-y-auto max-h-[26rem] pr-1">
            {nonGreen.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-start gap-3">
                  <AdvisoryBadge level={alert.advisoryLevel} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-100">{alert.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {alert.affectedCoast} · {alert.distanceKm.toFixed(0)} km {alert.bearing}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">{alert.action}</p>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">
                    {alert.validUntil}
                  </span>
                </div>
              </div>
            ))}
            {green.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{alert.title}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* Regulated waters */}
      <section className="xl:col-span-7">
        <Panel
          title={ui.regulatedWatersWord}
          icon={MapPinned}
          accent="amber"
          loading={briefLoading}
          right={<OfflineTag offline={bundleOffline} label={ui.offlineEngine} />}
        >
          {reduced.length === 0 ? (
            <p className="text-xs text-slate-500">{ui.noGeofencesWord}</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {criticalBoundaries.map((zone) => (
                <div
                  key={zone.id}
                  className="rounded-xl border border-amber-500/25 bg-slate-900/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-300">{zone.name}</span>
                    <span
                      className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold border ${
                        zone.severity === 'CRITICAL'
                          ? 'border-rose-500/50 text-rose-300'
                          : 'border-orange-500/50 text-orange-300'
                      }`}
                    >
                      {zone.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {zone.type.replace(/_/g, ' ')} ·{' '}
                    {ui.statutoryBufferWord.replace('{n}', String(zone.bufferKm))}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    <b className="text-slate-400">{ui.authorityWord}</b> {zone.authority}
                  </p>
                  <p className="text-[9px] text-slate-600 mt-0.5">{zone.regulation}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Compliance / violations */}
      <section className="xl:col-span-5">
        <Panel
          title={ui.geofenceComplianceWord}
          icon={ShieldAlert}
          accent="rose"
          right={
            <button
              onClick={() => onAsk('Which zones should vessels avoid near my jurisdiction?')}
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
            >
              {ui.askShortWord}
            </button>
          }
        >
          {violations.length === 0 && nearby.length === 0 ? (
            <p className="text-xs text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> {ui.noBoundariesBreachedWord}
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {[...violations, ...nearby].slice(0, 8).map((v, index) => (
                <div key={`${v.boundaryId}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-200 truncate">
                      {v.boundaryName}
                    </span>
                    <span
                      className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        v.inside
                          ? 'border-rose-500/60 bg-rose-500/10 text-rose-300'
                          : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      {v.inside
                        ? 'INSIDE'
                        : v.withinBuffer
                          ? ui.statutoryBufferWord.replace('{n}', String(v.bufferKm))
                          : `${v.distanceKm.toFixed(0)} km`}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5">{v.regulation}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
};