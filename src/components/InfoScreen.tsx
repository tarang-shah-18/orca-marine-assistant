import React, { useEffect, useState } from 'react';
import {
  OctagonAlert,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  Globe,
  MapPin,
  MessageSquare,
  Network,
  Server,
  WifiOff,
} from 'lucide-react';
import { AGENT_REGISTRY, HarborLocation, LanguageOption, SUPPORTED_LANGUAGES } from '../types';
import { DATA_CYCLE, HARBORS, VESSEL_PROFILES } from '../core/dataset';
import { getPhrasebook, fillTemplate } from '../core/i18n';
import { codeText } from './LocalizedCode';
import { engineStatus } from '../services/orcaApi';
import type { EngineStatus } from '../services/orcaApi';

interface InfoScreenProps {
  onBack: () => void;
  onOpenApkModal: () => void;
  onOpenChat: () => void;
  harbor: HarborLocation;
  onSelectHarbor: (harbor: HarborLocation) => void;
  currentLanguage: LanguageOption;
}

/**
 * The engineering panel.
 *
 * Judges ask two questions: what does it actually do, and how do you know it
 * works. This screen answers the first from the live agent registry and the
 * server's own `/status` endpoint, and the second from the eight canonical
 * capability chips wired into the conversation.
 */
export const InfoScreen: React.FC<InfoScreenProps> = ({
  onBack,
  onOpenApkModal,
  onOpenChat,
  harbor,
  onSelectHarbor,
  currentLanguage,
}) => {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const ui = getPhrasebook(currentLanguage.code).ui;

  useEffect(() => {
    let cancelled = false;
    engineStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const agents = status?.agents ?? Object.values(AGENT_REGISTRY);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50"
          title={ui.backToHomeWord}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          {/* Deliberately verbatim: ORCA is the product name, "SIH 2026" the
              event, "Problem ID 26176" the organiser's identifier, and the line
              below names the submitting institution and the submission's own
              technology bucket. Translating an identifier or an organisation's
              name would make it harder to match against the form, not easier. */}
          <h2 className="font-bold text-sm text-slate-50">ORCA — SIH 2026, Problem ID 26176</h2>
          <p className="text-[10px] text-slate-400">
            ISRO / Department of Space · Software · Space Technology
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Build hub */}
        <div className="bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/50 rounded-2xl p-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <FileCode2 className="w-4 h-4" />
            <span>{ui.infoBuildHubWord}</span>
          </div>
          <h3 className="font-extrabold text-sm text-slate-50 mt-0.5">{ui.infoApkGuideWord}</h3>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug">{ui.infoApkGuideBodyWord}</p>
          <button
            onClick={onOpenApkModal}
            className="mt-3 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
          >
            {ui.infoOpenBuildWord}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Engine status */}
        <Section icon={<Cpu className="w-4 h-4" />} title={ui.infoEngineStatusWord}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px]">
              {status?.offline ? (
                <WifiOff className="w-4 h-4 text-amber-400" />
              ) : (
                <Server className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-slate-300">
                {status?.offline ? ui.infoBrowserEngineWord : ui.infoServerConnectedWord}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Stat label={ui.infoVersionWord} value={status?.version ?? '—'} />
              <Stat
                label={ui.infoAiLayerWord}
                value={status?.ai.configured ? status.ai.model : ui.infoDeterministicWord}
                tone={status?.ai.configured ? 'text-violet-300' : 'text-cyan-300'}
              />
              <Stat
                label={ui.infoSessionsWord}
                value={
                  status
                    ? status.offline
                      ? ui.infoLocalWord
                      : String(status.sessions ?? 0)
                    : '—'
                }
              />
              <Stat
                label={ui.infoReferenceCycleWord}
                value={status?.dataCycle?.label ?? (status?.offline ? ui.infoBundledSnapshotWord : '—')}
              />
            </div>

            {status && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(status.counts).map(([key, value]) => (
                  <span
                    key={key}
                    className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-300 border border-slate-800"
                  >
                    {value} {key}
                  </span>
                ))}
              </div>
            )}

            {status && !status.ai.configured && (
              <p className="text-[10px] text-slate-500 leading-snug">
                {codeText(ui.infoNoApiKeyWord, ['GEMINI_API_KEY'], 'text-slate-400')}
              </p>
            )}
          </div>
        </Section>

        {/* Agent roster */}
        <Section
          icon={<Bot className="w-4 h-4" />}
          title={fillTemplate(ui.infoRosterWord, { n: agents.length })}
        >
          <p className="text-[11px] text-slate-400 leading-snug">{ui.infoRosterBodyWord}</p>
          <div className="space-y-1.5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  style={{ background: colourFor(agent.color) }}
                />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-[11px] text-slate-200 block">{agent.name}</span>
                  <span className="text-[10px] text-slate-400 leading-snug">{agent.description}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agent.sources.map((source) => (
                      <span
                        key={source}
                        className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] text-slate-500 border border-slate-800"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Coverage */}
        <Section icon={<Network className="w-4 h-4" />} title={ui.infoCoverageWord}>
          <div className="space-y-1.5 text-[11px]">
            <Row icon={<Globe className="w-3.5 h-3.5" />}>
              <strong className="text-slate-200">
                {fillTemplate(ui.infoLanguagesWord, { n: SUPPORTED_LANGUAGES.length })}
              </strong>
              {' — '}
              {SUPPORTED_LANGUAGES.map((lang) => lang.nativeLabel).join(' · ')}
            </Row>
            <Row icon={<MapPin className="w-3.5 h-3.5" />}>
              <strong className="text-slate-200">
                {fillTemplate(ui.infoHarboursWord, { n: HARBORS.length })}
              </strong>
              {' — '}
              {HARBORS.map((h) => h.shortName).join(', ')}
            </Row>
            <Row icon={<Database className="w-3.5 h-3.5" />}>
              <strong className="text-slate-200">
                {fillTemplate(ui.infoVesselProfilesWord, { n: VESSEL_PROFILES.length })}
              </strong>{' '}
              — {ui.infoVesselBodyWord}
            </Row>
            <Row icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              <strong className="text-slate-200">{ui.infoReferenceCycleWord}</strong> —{' '}
              {DATA_CYCLE.label},{' '}
              {fillTemplate(ui.infoCycleBodyWord, {
                cycle: DATA_CYCLE.cycle,
                sources: DATA_CYCLE.sources.length,
              })}
            </Row>
          </div>
        </Section>

        {/* Base harbour */}
        <Section icon={<MapPin className="w-4 h-4" />} title={ui.infoBaseHarbourWord}>
          <p className="text-[11px] text-slate-400">{ui.infoBaseHarbourBodyWord}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {HARBORS.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => onSelectHarbor(candidate)}
                className={`p-2 rounded-xl text-left border text-[10px] transition-all ${
                  candidate.id === harbor.id
                    ? 'bg-cyan-950 border-cyan-500 text-slate-50 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="truncate font-semibold">{candidate.shortName}</div>
                <div className="text-[9px] text-slate-400 truncate">{candidate.state}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Acceptance */}
        <Section icon={<MessageSquare className="w-4 h-4" />} title={ui.infoAcceptanceWord}>
          <p className="text-[11px] text-slate-400 leading-snug">
            {fillTemplate(ui.infoAcceptanceBodyWord, { n: SUPPORTED_LANGUAGES.length })}
          </p>
          <button
            onClick={onOpenChat}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            {fillTemplate(ui.infoOpenChatWord, { lang: currentLanguage.nativeLabel })}
          </button>
        </Section>

        {/* Safety */}
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
            <OctagonAlert className="w-4 h-4" />
            <span>{ui.infoSafetyWord}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{ui.infoSafetyBodyWord}</p>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
    <div className="flex items-center gap-2 font-bold text-sm text-slate-50">
      <span className="text-cyan-400">{icon}</span>
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-[11px] font-bold font-mono truncate ${tone ?? 'text-slate-50'}`}>{value}</div>
  </div>
);

const Row: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-start gap-2 text-slate-300 leading-snug">
    <span className="mt-0.5 shrink-0 text-cyan-500">{icon}</span>
    <span className="flex-1">{children}</span>
  </div>
);

/** Map an agent's declared Tailwind family onto a concrete swatch colour. */
const AGENT_COLOUR: Record<string, string> = {
  cyan: '#22d3ee',
  emerald: '#10b981',
  sky: '#38bdf8',
  blue: '#3b82f6',
  indigo: '#818cf8',
  red: '#ef4444',
  amber: '#f59e0b',
  orange: '#f97316',
  violet: '#a855f7',
  purple: '#c084fc',
  pink: '#ec4899',
  rose: '#f43f5e',
};

const colourFor = (family: string): string => AGENT_COLOUR[family] ?? '#22d3ee';

export default InfoScreen;
