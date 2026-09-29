import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Compass,
  Map as MapIcon,
  MessageSquare,
  Radio,
  RefreshCw,
  ShieldAlert,
  Waves,
} from 'lucide-react';
import type { HarborLocation, LanguageOption, PFZZone, RiskLevel } from '../types';
import type { FleetOverview } from '../types';
import { fleetWatch } from '../services/orcaApi';
import { HARBOR_BY_ID } from '../core/dataset';
import { getPhrasebook } from '../core/i18n';

interface FleetWatchScreenProps {
  onBack: () => void;
  harbor: HarborLocation;
  language: LanguageOption;
  onSelectHarbor: (harbor: HarborLocation) => void;
  onAsk: (question: string, harborId?: string) => void;
  onOpenMap: (zone?: PFZZone) => void;
}

const RISK_TONE: Record<RiskLevel, { badge: string; bar: string; ring: string }> = {
  LOW: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-600/60',
    bar: 'bg-emerald-400',
    ring: 'border-emerald-600/40',
  },
  MODERATE: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-600/60',
    bar: 'bg-amber-400',
    ring: 'border-amber-600/40',
  },
  HIGH: {
    badge: 'bg-orange-500/15 text-orange-300 border-orange-600/60',
    bar: 'bg-orange-400',
    ring: 'border-orange-600/40',
  },
  SEVERE: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-600/60',
    bar: 'bg-rose-400',
    ring: 'border-rose-600/40',
  },
};

const RISK_ORDER: RiskLevel[] = ['SEVERE', 'HIGH', 'MODERATE', 'LOW'];

/**
 * Fleet Watch — the whole coast on one screen.
 *
 * ORCA's chat and dashboards are harbour-bound by design; a fisheries
 * department, disaster cell or fleet owner needs the same weighted posture for
 * every port at once so a bad break elsewhere never waits for a tap on that
 * harbour. Each card is computed by the same risk matrix as the conversational
 * verdict, so the coast-wide view and a chat turn can never disagree.
 */
export const FleetWatchScreen: React.FC<FleetWatchScreenProps> = ({
  onBack,
  harbor,
  language,
  onSelectHarbor,
  onAsk,
  onOpenMap,
}) => {
  const ui = getPhrasebook(language.code).ui;
  const [fleet, setFleet] = useState<FleetOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);

  const load = useCallback(async () => {
    const t = ++ticket.current;
    setError(null);
    try {
      const data = await fleetWatch();
      if (t !== ticket.current) return;
      setFleet(data);
    } catch (cause) {
      if (t === ticket.current) setError(cause instanceof Error ? cause.message : ui.fleetErrorWord.replace('{error}', 'unavailable'));
    }
  }, [ui]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeHarborId = harbor.id;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50"
          title={ui.backWord}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="w-10 h-10 rounded-2xl flex items-center justify-center border border-cyan-600/50 bg-cyan-950/50 text-cyan-300">
          <Radio className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-50 leading-tight">{ui.fleetTitle}</h1>
          <p className="text-[11px] text-slate-400 truncate">{ui.fleetSubtitleWord}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300"
            title={ui.refreshFleetWord}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3 text-[11px] text-rose-200">
          {ui.fleetErrorWord.replace('{error}', error)}
        </div>
      )}

      {!fleet && !error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-[11px] text-slate-400">
          {ui.scanningCoastlineWord.replace('{language}', language.nativeLabel)}
        </div>
      )}

      {fleet && (
        <>
          {/* Posture summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                {ui.coastPostureWord} · {fleet.vesselLabel}
              </span>
              {RISK_ORDER.filter((level) => (fleet.counts[level] ?? 0) > 0).map((level) => {
                const tone = RISK_TONE[level];
                return (
                  <span
                    key={level}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${tone.badge}`}
                  >
                    {fleet.counts[level]} {level === 'LOW' ? ui.okWord : level}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 leading-snug">{ui.fleetNote}</p>
          </div>

          {/* Harbour grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {fleet.harbours.map((snap) => {
              const tone = RISK_TONE[snap.riskLevel];
              const isActive = snap.harborId === activeHarborId;
              return (
                <div
                  key={snap.harborId}
                  className={`rounded-2xl border p-3 space-y-2 bg-slate-900/70 ${
                    isActive ? 'border-cyan-500/60 ring-1 ring-cyan-500/30' : tone.ring
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Anchor className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[12px] text-slate-100 truncate">
                          {snap.shortName}
                        </span>
                        {isActive && (
                          <span className="px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[8px] font-bold uppercase tracking-wide">
                            {ui.selectedWord}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {snap.state} · {snap.basin}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-bold ${tone.badge}`}
                    >
                      {snap.riskLevel}
                    </span>
                  </div>

                  {/* Safety bar */}
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500">
                      <span>{ui.safetyIndexWord}</span>
                      <span className="font-mono font-bold text-slate-300">{snap.safetyScore}/100</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tone.bar}`}
                        style={{ width: `${snap.safetyScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Waves className="w-3 h-3 text-slate-500" />
                      {ui.wavesTemplateWord.replace('{n}', String(snap.waveHeightMeters))}
                    </span>
                    <span className="flex items-center gap-1">
                      <Compass className="w-3 h-3 text-slate-500" />
                      {ui.windTemplateWord.replace('{n}', String(snap.windSpeedKnots))}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapIcon className="w-3 h-3 text-slate-500" />
                      {snap.nearestPfzKm !== null
                        ? ui.kmToGroundWord
                            .replace('{n}', String(snap.nearestPfzKm))
                            .replace('{name}', snap.nearestPfzName ?? ui.fishingGroundWord)
                        : ui.noPfzInRangeWord}
                    </span>
                    {snap.reference ? (
                      <span
                        className="text-amber-400/90"
                        title={ui.referenceSnapshotTitleWord}
                      >
                        {ui.referenceDataWord}
                      </span>
                    ) : (
                      <span className="text-emerald-400/80">{ui.liveFeedWord}</span>
                    )}
                  </div>

                  {snap.topAdvisory ? (
                    <div className="flex items-start gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/30 px-2 py-1.5">
                      <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                      <span className="text-[10px] text-amber-200/90 leading-snug">
                        {snap.topAdvisory}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-800 px-2 py-1.5 text-[10px] text-slate-500">
                      {ui.noAdvisoryInRangeWord}
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={() => onAsk(`Give me the full marine situation report`, snap.harborId)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {ui.briefThisPortWord}
                    </button>
                    <button
                      onClick={() => {
                        const target = HARBOR_BY_ID[snap.harborId];
                        if (target) onSelectHarbor(target);
                        onOpenMap();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-[10px] font-bold"
                    >
                      <MapIcon className="w-3 h-3" />
                      {ui.mapWord}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default FleetWatchScreen;