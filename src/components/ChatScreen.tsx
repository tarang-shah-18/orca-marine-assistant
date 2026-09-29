import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Compass,
  FlaskConical,
  Globe,
  Info,
  Loader2,
  Mic,
  MicOff,
  Network,
  ScrollText,
  Send,
  Square,
  Table2,
  Trash2,
  Volume2,
  Waves,
} from 'lucide-react';
import {
  AGENT_REGISTRY,
  ChatMessage,
  EvidenceItem,
  HarborLocation,
  LanguageOption,
  OrchestrationResult,
  PFZZone,
  RiskLevel,
} from '../types';
import type { LatLon } from '../core/geo';
import { getPhrasebook, qualityWord } from '../core/i18n';
import type { Phrasebook, UiStrings } from '../core/i18n';
import { nativeLanguageName, speechTagFor } from '../core/language';
import { CANONICAL_SCENARIOS } from '../server/scenarios';
import { ask, toChatMessage } from '../services/orcaApi';
import { SpeechService } from '../services/speechService';
import { AgentTrace, TraceState, emptyTrace, reduceTrace } from './AgentTrace';
import { Charts, ChartLegend } from './Charts';
import { RiskStrip } from './RiskStrip';
import { TideTable } from './TideTable';
import { RouteCard, RouteSummary } from './RouteCard';
import { GeofencePanel } from './GeofencePanel';

interface ChatScreenProps {
  onBack: () => void;
  onOpenMap: (zone?: PFZZone) => void;
  onOpenLanguage: () => void;
  onOpenInfo: () => void;
  currentLanguage: LanguageOption;
  harbor: HarborLocation;
  messages: ChatMessage[];
  onMessagesChange: (updater: (previous: ChatMessage[]) => ChatMessage[]) => void;
  onNewConversation: () => void;
  gpsFix: LatLon | null;
}

/** How many panel tabs an answer offers. */
type PanelId = 'why' | 'data' | 'evidence';

export const ChatScreen: React.FC<ChatScreenProps> = ({
  onBack,
  onOpenMap,
  onOpenLanguage,
  onOpenInfo,
  currentLanguage,
  harbor,
  messages,
  onMessagesChange,
  onNewConversation,
  gpsFix,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveTrace, setLiveTrace] = useState<TraceState>(emptyTrace());
  const [openPanel, setOpenPanel] = useState<Record<string, PanelId | null>>({});
  const [showAllScenarios, setShowAllScenarios] = useState(false);

  // The SSE callback fires far faster than React re-renders, so the trace is
  // accumulated in a ref and flushed to state on a timer.
  const traceRef = useRef<TraceState>(emptyTrace());
  const flushTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /**
   * User messages that have already been dispatched.
   *
   * A turn can start from three places — the composer, a capability chip, or a
   * message seeded from the home screen — and this set is what makes all three
   * idempotent instead of racing to answer the same utterance twice.
   */
  const dispatchedRef = useRef<Set<string>>(new Set());

  const book = getPhrasebook(currentLanguage.code);
  const ui = book.ui;

  /* --- Conversation lifecycle ------------------------------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, liveTrace]);

  useEffect(() => {
    return () => {
      SpeechService.stopListening();
      SpeechService.stopSpeaking();
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    };
  }, []);

  const onEvent = useCallback((event: Parameters<typeof reduceTrace>[1]) => {
    traceRef.current = reduceTrace(traceRef.current, event);
    if (flushTimer.current === null) {
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        setLiveTrace(traceRef.current);
      }, 80);
    }
  }, []);

  const handleSend = useCallback(
    async (raw: string, options: { echo?: boolean } = {}) => {
      const query = raw.trim();
      if (!query || isProcessing) return;

      if (options.echo !== false) {
        const userMessageId = `user-${Date.now()}`;
        dispatchedRef.current.add(userMessageId);
        onMessagesChange((prev) => [...prev, toChatMessage(userMessageId, 'user', query)]);
      }

      setInputText('');
      setNotice(null);
      SpeechService.stopSpeaking();
      setSpeakingId(null);
      setIsProcessing(true);
      traceRef.current = emptyTrace();
      setLiveTrace(traceRef.current);

      try {
        const outcome = await ask({
          message: query,
          language: currentLanguage.code,
          harborId: harbor.id,
          latitude: gpsFix?.latitude,
          longitude: gpsFix?.longitude,
          onEvent,
        });

        const orcaId = `orca-${Date.now()}`;
        const answer = toChatMessage(
          orcaId,
          'orca',
          outcome.result.answer,
          outcome.result,
          outcome.offline,
        );
        onMessagesChange((prev) => [...prev, answer]);

        // Keep the live trace attached to the turn it belongs to, so re-opening
        // an older answer shows the reasoning that actually produced it.
        setLiveTrace(traceRef.current);
        setOpenPanel((prev) => ({ ...prev, [orcaId]: 'why' }));
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `${ui.couldNotCompleteWord}: ${error.message}`
            : `${ui.couldNotCompleteWord}.`,
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [currentLanguage.code, gpsFix, harbor.id, isProcessing, onEvent, onMessagesChange],
  );

  // Answers anything that arrived from outside the composer: a capability chip
  // tapped on the home screen, or a "why?" tap on the map.
  useEffect(() => {
    const pending = messages[messages.length - 1];
    if (!pending || pending.sender !== 'user' || pending.result) return;
    if (dispatchedRef.current.has(pending.id)) return;
    dispatchedRef.current.add(pending.id);
    void handleSend(pending.text, { echo: false });
  }, [messages, handleSend]);

  /* --- Voice ------------------------------------------------------- */

  const handleToggleVoice = useCallback(() => {
    if (isListening) {
      SpeechService.stopListening();
      setIsListening(false);
      return;
    }

    setNotice(null);
    // The recogniser is handed a real BCP-47 tag, not an ORCA locale code, or
    // it starts and then matches nothing.
    const started = SpeechService.startListening({
      language: speechTagFor(currentLanguage.code),
      onResult: (transcript) => setInputText(transcript),
      onError: (message) => {
        setIsListening(false);
        setNotice(message);
      },
      onEnd: () => setIsListening(false),
    });

    setIsListening(started);
  }, [currentLanguage.code, isListening]);

  const handleSpeak = useCallback(
    (message: ChatMessage) => {
      if (speakingId === message.id) {
        SpeechService.stopSpeaking();
        setSpeakingId(null);
        return;
      }
      const language = message.language ?? currentLanguage.code;
      SpeechService.stopSpeaking();
      setSpeakingId(message.id);
      SpeechService.speak({
        text: message.text,
        language: speechTagFor(language),
        onEnd: () => setSpeakingId(null),
        onError: () => {
          setSpeakingId(null);
          setNotice(ui.ttsUnavailableWord);
        },
      });
    },
    [currentLanguage.code, speakingId],
  );

  /* --- Scenario chips ---------------------------------------------- */

  /**
   * The eight capabilities from the problem statement, rendered in whatever
   * language the fisher is currently using. Each one is a real question fed
   * through the real pipeline — not a canned answer — so tapping a chip is a
   * live test of intent detection, roster selection and synthesis in that
   * language.
   */
  const scenarios = useMemo(
    () =>
      CANONICAL_SCENARIOS.map((scenario) => {
        const chosen = scenario.translations.find((t) => t.language === currentLanguage.code);
        const english = scenario.translations.find((t) => t.language === 'en-IN');
        const text = chosen?.text ?? english?.text ?? '';
        return {
          id: scenario.id,
          capability: scenario.capability,
          harborId: scenario.harborId,
          label: shorten(text),
          query: text,
        };
      }),
    [currentLanguage.code],
  );

  const visibleScenarios = showAllScenarios ? scenarios : scenarios.slice(0, 5);

  /** The newest answer is the one still on screen, so it keeps the live trace. */
  const latestOrcaId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === 'orca') return messages[i].id;
    }
    return undefined;
  }, [messages]);

  /* --- Render ------------------------------------------------------ */

  const title = currentScreenTitle(harbor);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="px-3 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            id="chat-back-btn"
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors"
            title={ui.backToHomeWord}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-50">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>ORCA</span>
              <span className="text-[10px] font-medium text-slate-500">{ui.engineLabelWord}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {title}
              {gpsFix ? ` · GPS ${gpsFix.latitude.toFixed(2)}°, ${gpsFix.longitude.toFixed(2)}°` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="chat-lang-btn"
            onClick={onOpenLanguage}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium"
            title={ui.changeLanguage}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentLanguage.nativeLabel}</span>
          </button>
          <button
            id="chat-reset-btn"
            onClick={onNewConversation}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors"
            title={ui.newConversationTooltip}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            id="chat-info-btn"
            onClick={onOpenInfo}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title={ui.projectInfoTooltip}
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            id="chat-open-map-btn"
            onClick={() => onOpenMap()}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
            title={ui.openMapTooltip}
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && <Welcome ui={ui} intro={book.intro} onPick={handleSend} />}

        {messages.map((message) =>
          message.sender === 'user' ? (
            <UserBubble key={message.id} message={message} />
          ) : (
            <OrcaBubble
              key={message.id}
              message={message}
              trace={traceFor(message, liveTrace, message.id === latestOrcaId)}
              panel={openPanel[message.id] ?? null}
              onTogglePanel={(panel) =>
                setOpenPanel((prev) => ({ ...prev, [message.id]: prev[message.id] === panel ? null : panel }))
              }
              speaking={speakingId === message.id}
              onSpeak={() => handleSpeak(message)}
              onOpenMap={onOpenMap}
            />
          ),
        )}

        {isProcessing && <LiveTurn ui={ui} trace={liveTrace} />}

        {notice && (
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200 flex items-start gap-2">
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="font-bold underline">
              {ui.dismissWord}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Canonical capability chips — the problem statement's eight questions */}
      <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800 shrink-0">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
            {ui.problemStatementCapabilitiesWord}
          </span>
          <button
            onClick={() => setShowAllScenarios((v) => !v)}
            className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300"
          >
            {showAllScenarios ? ui.showFewerWord : ui.showAll8Word}
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {visibleScenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleSend(scenario.query)}
              disabled={isProcessing}
              title={scenario.capability}
              className="shrink-0 px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-cyan-900 border border-slate-700 text-[11px] font-medium text-slate-200 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      {isListening && (
        <div className="px-4 py-2 bg-rose-950/90 border-t border-rose-800 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold">
              {ui.listeningInWord
                .replace('{language}', currentLanguage.nativeLabel)
                .replace('{tag}', speechTagFor(currentLanguage.code))}
            </span>
          </div>
          <button
            onClick={() => {
              SpeechService.stopListening();
              setIsListening(false);
            }}
            className="text-xs font-semibold px-2 py-0.5 bg-rose-800 rounded text-white"
          >
            {ui.stopWord}
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend(inputText);
        }}
        className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 flex items-center gap-2"
      >
        <input
          id="chat-input-field"
          type="text"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={ui.askPlaceholderWord.replace('{language}', currentLanguage.nativeLabel)}
          disabled={isProcessing}
          className="flex-1 bg-slate-950 text-slate-50 placeholder-slate-500 text-sm px-3.5 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
        />
        <button
          id="chat-mic-btn"
          type="button"
          onClick={handleToggleVoice}
          disabled={isProcessing}
          title={isListening ? ui.stopListeningWord : ui.voiceInputWord}
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all shadow-md ${
            isListening ? 'bg-rose-600 scale-105' : 'bg-cyan-600 hover:bg-cyan-500 active:scale-95'
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          title={ui.sendWord}
          className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-400 font-bold flex items-center justify-center border border-slate-700 transition-all"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function currentScreenTitle(harbor: HarborLocation): string {
  return `${harbor.shortName} · ${harbor.basin}`;
}

/** Capability chip label: short enough for a phone, still recognisable. */
const shorten = (text: string, max = 30): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const UserBubble: React.FC<{ message: ChatMessage }> = ({ message }) => (
  <div className="flex flex-col items-end">
    <div className="max-w-[88%] rounded-2xl rounded-br-xs px-3.5 py-2.5 text-sm leading-relaxed bg-cyan-600 text-white font-medium">
      {message.text}
    </div>
    <span className="text-[10px] text-slate-500 mt-1 px-1">{message.timestamp}</span>
  </div>
);

/** First turn: greet, and offer the question a fisher is most likely to ask. */
const Welcome: React.FC<{ ui: UiStrings; intro: string; onPick: (question: string) => void }> = ({
  ui,
  intro,
  onPick,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wide">
      <Waves className="w-4 h-4" />
      {ui.welcomeTitleWord}
    </div>
    <p className="text-sm text-slate-200 leading-relaxed">{intro}</p>
    <p className="text-xs text-slate-400 leading-relaxed">{ui.welcomeProseWord}</p>
    <button
      onClick={() => onPick(ui.fullReportQueryWord)}
      className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2"
    >
      <FlaskConical className="w-4 h-4" />
      {ui.runSituationReportWord}
    </button>
  </div>
);

const LiveTurn: React.FC<{ ui: UiStrings; trace: TraceState }> = ({ ui, trace }) => (
  <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-3 space-y-2.5">
    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{ui.agentsWorkingWord}</span>
      {trace.language && (
        <span className="ml-auto text-[10px] font-medium text-slate-400">
          {ui.detectedWord.replace('{language}', trace.language)}
        </span>
      )}
    </div>

    {trace.plan && (
      <p className="text-[11px] text-slate-400 leading-snug">
        <span className="text-slate-200 font-semibold">{trace.plan.intent}</span> · {trace.plan.reasoning}
      </p>
    )}

    <AgentTrace trace={trace} />

    {trace.findings.length > 0 && (
      <div className="pt-1 border-t border-slate-800 space-y-1">
        {trace.findings.slice(-4).map((f, i) => (
          <div key={`${f.agent}-${i}`} className="flex items-start gap-1.5 text-[10px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
            <span>
              <span className="text-slate-300">{AGENT_REGISTRY[f.agent]?.name ?? f.agent}:</span>{' '}
              {f.statement}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * Reconstruct the trace for a finished turn.
 *
 * The `done` frame carries the full result but not the intermediate narration,
 * so the turn that is still on screen reuses the live trace and every older
 * answer is replayed from its own `agentResults` — the summaries, timings,
 * findings and collaboration requests those agents actually returned.
 */
function traceFor(message: ChatMessage, liveTrace: TraceState, isLatest: boolean): TraceState {
  const result = message.result;
  if (!result) return emptyTrace();

  if (isLatest && liveTrace.finished && liveTrace.steps.length > 0) {
    return liveTrace;
  }

  return {
    steps: result.agentResults.map((r, index) => ({
      id: `replay-${r.agent}-${index}`,
      agent: r.agent,
      goal: AGENT_REGISTRY[r.agent]?.description ?? r.agent,
      status: r.status === 'ERROR' ? ('error' as const) : ('done' as const),
      summary: r.summary,
      durationMs: r.durationMs,
      findingCount: r.findings.length,
    })),
    links: result.agentResults.flatMap((r) =>
      r.requestedAgents.map((to) => ({ from: r.agent, to })),
    ),
    round: Math.max(1, ...result.agentResults.map((r) => r.round)),
    plan: result.plan,
    language: result.detectedLanguage,
    risk: { level: result.riskLevel, safetyScore: result.safetyScore },
    findings: result.agentResults.flatMap((r) =>
      r.findings.map((f) => ({
        agent: r.agent,
        statement: f.statement,
        confidence: f.confidence,
        riskLevel: f.riskLevel,
      })),
    ),
    aiGenerated: result.aiGenerated,
    finished: true,
  };
}

interface OrcaBubbleProps {
  message: ChatMessage;
  trace: TraceState;
  panel: PanelId | null;
  onTogglePanel: (panel: PanelId) => void;
  speaking: boolean;
  onSpeak: () => void;
  onOpenMap: (zone?: PFZZone) => void;
}

const OrcaBubble: React.FC<OrcaBubbleProps> = ({
  message,
  trace,
  panel,
  onTogglePanel,
  speaking,
  onSpeak,
  onOpenMap,
}) => {
  const result = message.result;
  if (!result) {
    return (
      <div className="flex flex-col items-start">
        <div className="max-w-[92%] rounded-2xl rounded-bl-xs px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-800 text-slate-400">
          {message.text}
        </div>
      </div>
    );
  }

  const book = getPhrasebook(result.detectedLanguage);

  return (
    <div className="flex flex-col items-start">
      <div className="w-[96%] rounded-2xl rounded-bl-xs bg-slate-900 border border-slate-800 text-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1.5 flex-wrap px-3.5 pt-3 pb-2 border-b border-slate-800 text-[10px]">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-cyan-400">ORCA</span>
          <RiskBadge level={result.riskLevel} label={book.riskWords[RISK_INDEX[result.riskLevel]]} />
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {nativeLanguageName(result.detectedLanguage)}
          </span>
          {result.aiGenerated && (
            <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
              GEMINI
            </span>
          )}
          {message.offline && (
            <span
              className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold"
              title={book.ui.engineRunTitleWord}
            >
              {book.ui.offlineEngine}
            </span>
          )}
        </div>

        {/* Answer text */}
        <p className="px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">{message.text}</p>

        {/* Structured products */}
        <div className="px-3.5 pb-3 space-y-2.5">
          {result.routeData ? <RouteCard route={result.routeData} compact book={book} /> : null}
          {result.tideReport ? <TideTable report={result.tideReport} compact book={book} /> : null}
          {result.geofencingData ? <GeofencePanel data={result.geofencingData} compact /> : null}
          {result.riskTrajectory ? (
            <RiskStrip trajectory={result.riskTrajectory} book={book} />
          ) : null}
          <Charts visualizations={result.visualizations} limit={2} book={book} />
          {result.visualizations.length > 0 && (
            <ChartLegend viz={result.visualizations[0]} />
          )}

          {result.pfzZone && (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-2.5 space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                {book.labels.zone}
              </div>
              <div className="text-[12px] font-bold text-slate-50">{result.pfzZone.name}</div>
              <div className="text-[10px] text-slate-300">
                {result.pfzZone.distanceKm} km {result.pfzZone.bearing} ·{' '}
                {book.ui.chlorophyllWord} {result.pfzZone.chlorophyllMgM3} mg/m³ · SST{' '}
                {result.pfzZone.sstCelsius}°C · INDEX {result.pfzZone.productivityIndex}/100
              </div>
              <div className="text-[10px] text-slate-400">
                {result.pfzZone.targetFishSpecies.join(', ')} ·{' '}
                {book.ui.validUntilWord.replace('{date}', result.pfzZone.validTill)}
              </div>
            </div>
          )}

          {result.marineAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-2.5 space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                {book.labels.alerts}
              </div>
              {result.marineAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="text-[10px] text-slate-300 leading-snug">
                  <span className="font-semibold text-slate-50">{alert.title}</span>{' '}
                  <span className="text-amber-300">({alert.advisoryLevel})</span> — {alert.action}
                </div>
              ))}
            </div>
          )}

          {result.historicalData && <HistoricalSummary data={result.historicalData} book={book} />}

          {result.hotspots && result.hotspots.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                {book.ui.hotspotsTitleWord}
              </div>
              <div className="space-y-0.5">
                {result.hotspots.slice(0, 4).map((hotspot) => (
                  <div key={hotspot.id} className="flex items-center gap-2 text-[10px] text-slate-300">
                    <span className="font-semibold text-slate-50">{hotspot.name}</span>
                    <span className="text-slate-500">{hotspot.distanceKm} km</span>
                    <span className="ml-auto font-mono text-emerald-400">
                      chl {hotspot.chlorophyllMgM3} · {hotspot.sstCelsius}°C · {hotspot.productivityIndex}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="rounded-xl bg-cyan-950/40 border border-cyan-800/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-300 mb-0.5">
              {book.labels.recommendation}
            </div>
            <p className="text-[11px] text-slate-100 leading-snug">{result.recommendation}</p>
          </div>

          {/* Panel switcher */}
          <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
            <PanelTab
              active={panel === 'why'}
              onClick={() => onTogglePanel('why')}
              icon={<Network className="w-3 h-3" />}
              label={`${book.ui.agentsWord.charAt(0).toUpperCase()}${book.ui.agentsWord.slice(1)} (${result.selectedAgents.length})`}
            />
            <PanelTab
              active={panel === 'data'}
              onClick={() => onTogglePanel('data')}
              icon={<Table2 className="w-3 h-3" />}
              label={book.ui.dataWord}
            />
            <PanelTab
              active={panel === 'evidence'}
              onClick={() => onTogglePanel('evidence')}
              icon={<ScrollText className="w-3 h-3" />}
              label={`${book.ui.evidenceWord} (${result.evidence.length})`}
            />
            <button
              onClick={onSpeak}
              className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                speaking
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500'
              }`}
              title={book.ui.readAloudTitleWord}
            >
              {speaking ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
              <span>{speaking ? book.ui.stopWord : book.ui.listenWord}</span>
            </button>
          </div>

          {panel === 'why' && (
            <div className="pt-1">
              <AgentTrace trace={trace} results={result.agentResults} />
            </div>
          )}

          {panel === 'data' && <DataPanel result={result} book={book} />}

          {panel === 'evidence' && <EvidencePanel result={result} book={book} />}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 px-1 flex-wrap">
        <span>{message.timestamp}</span>
        {result.pfzZone && (
          <button
            onClick={() => onOpenMap(result.pfzZone)}
            className="flex items-center gap-1 text-emerald-400 font-semibold hover:underline"
          >
            <Compass className="w-3 h-3" />
            {book.ui.viewOnMapWord}
          </button>
        )}
        {result.routeData && (
          <span className="flex items-center gap-1">
            <RouteSummary route={result.routeData} book={book} />
          </span>
        )}
      </div>
    </div>
  );
};

const RISK_INDEX: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };

const RISK_STYLE: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  MODERATE: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
  SEVERE: 'bg-red-500/25 text-red-300 border-red-500/60',
};

const RiskBadge: React.FC<{ level: RiskLevel; label: string }> = ({ level, label }) => (
  <span className={`px-1.5 py-0.5 rounded-full font-bold border ${RISK_STYLE[level]}`}>
    {label}
  </span>
);

const PanelTab: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
      active
        ? 'bg-slate-800 text-cyan-300 border-cyan-700'
        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
    }`}
  >
    {icon}
    {label}
  </button>
);

/** Raw numbers, for a fisher who wants to check ORCA's arithmetic. */
const DataPanel: React.FC<{ result: OrchestrationResult; book: Phrasebook }> = ({ result, book }) => {
  const { weatherData: weather, oceanData: ocean, tideReport: tide } = result;

  return (
    <div className="space-y-2 pt-1">
      {weather && (
        <FactGrid
          title={book.ui.imdForecastTitleWord}
          rows={[
            [book.labels.wind, `${weather.windSpeedKnots} kt (${weather.windSpeedKmph} km/h) ${weather.windDirection}`],
            [book.ui.gustsWord, `${weather.gustKnots} kt`],
            [book.ui.visibilityWord, `${weather.visibilityKm} km`],
            [book.ui.rainProbabilityWord, `${weather.rainProbability}%`],
            [book.ui.lightningRiskRowWord, weather.lightningRisk],
            [book.ui.squallWarningRowWord, weather.squallWarning ? book.ui.yesDoNotVentureWord : book.ui.noShortWord],
            [
              book.ui.forecastSlotsWord,
              book.ui.overDaysWord
                .replace('{n}', String(weather.forecast.length))
                .replace('{days}', String(new Set(weather.forecast.map((s) => s.date)).size)),
            ],
            [book.ui.sourceRowWord, weather.source],
          ]}
        />
      )}

      {ocean && (
        <FactGrid
          title={book.ui.incoisOceanTitleWord}
          rows={[
            [book.evidenceKeys.waveHeight, `${ocean.waveHeightMeters} m`],
            [book.ui.wavePeriodWord, `${ocean.wavePeriodSeconds} s`],
            [book.ui.swellWord, `${ocean.swellDirection} (${ocean.swellDirectionDeg}°)`],
            [book.evidenceKeys.sst, `${ocean.seaSurfaceTempCelsius}°C (${book.ui.sstAnomalyWord} ${ocean.sstAnomalyC >= 0 ? '+' : ''}${ocean.sstAnomalyC}°C)`],
            [book.ui.currentWord, `${ocean.currentKnots} kt ${ocean.currentDirection}`],
            [
              book.ui.seaStateRowWord,
              `Douglas ${ocean.seaStateCode} — ${book.seaStates[Math.min(ocean.seaStateCode, book.seaStates.length - 1)]}`,
            ],
            [book.ui.sourceRowWord, ocean.source],
          ]}
        />
      )}

      {tide && (
        <FactGrid
          title={`${book.ui.tideGaugeWord} — ${tide.station.name}`}
          rows={[
            [book.ui.currentLevelWord, `${tide.currentLevel.toFixed(2)} m (${tide.isRising ? book.ui.risingWord : book.ui.fallingWord})`],
            [book.ui.rangeRowWord, `${tide.maxRangeMeters.toFixed(2)} m`],
            [
              book.ui.nextEventWord,
              tide.events[0] ? `${tide.events[0].label} · ${tide.events[0].type} · ${tide.events[0].heightMeters.toFixed(2)} m` : '—',
            ],
            [
              book.ui.bestWindowRowWord,
              tide.recommendedWindow
                ? `${tide.recommendedWindow.startLabel}–${tide.recommendedWindow.endLabel} (${qualityWord(book, tide.recommendedWindow.quality)})`
                : '—',
            ],
            [book.ui.datumOffsetWord, `${tide.station.datumOffsetMeters} m`],
            [book.ui.harmonicConstituentsWord, String(tide.station.harmonics.length)],
            [book.ui.sourceRowWord, tide.source],
          ]}
        />
      )}

      {!weather && !ocean && !tide && (
        <p className="text-[11px] text-slate-500 italic">
          {book.ui.noInstrumentedReadingWord}
        </p>
      )}
    </div>
  );
};

const FactGrid: React.FC<{ title: string; rows: Array<[string, string]> }> = ({ title, rows }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">{title}</div>
    <div className="space-y-0.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-2 text-[10px]">
          <span className="text-slate-500 w-36 shrink-0">{label}</span>
          <span className="text-slate-200 font-mono">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const EvidencePanel: React.FC<{ result: OrchestrationResult; book: Phrasebook }> = ({ result, book }) => (
  <div className="space-y-2 pt-1">
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
        {book.labels.sources}
      </div>
      <div className="flex flex-wrap gap-1">
        {result.sources.length === 0 ? (
          <span className="text-[10px] text-slate-500 italic">{book.ui.noExternalSourcesWord}</span>
        ) : (
          result.sources.map((source) => (
            <span
              key={source}
              className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-300 border border-slate-800"
            >
              {source}
            </span>
          ))
        )}
      </div>
    </div>

    <EvidenceTable items={result.evidence} book={book} />
  </div>
);

export const EvidenceTable: React.FC<{ items: EvidenceItem[]; book: Phrasebook }> = ({ items, book }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
      {book.ui.evidenceLedgerWord}
    </div>
    {items.length === 0 ? (
      <p className="text-[10px] text-slate-500 italic">{book.ui.noEvidenceWord}</p>
    ) : (
      <table className="w-full text-[10px]">
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.label}-${index}`} className="border-t border-slate-800/60 align-top">
              <td className="py-1 pr-2 text-slate-500">{item.label}</td>
              <td className="py-1 pr-2 text-slate-200 font-mono">{item.value}</td>
              <td className="py-1 text-slate-500 text-right">{item.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const HistoricalSummary: React.FC<{
  data: NonNullable<OrchestrationResult['historicalData']>;
  book: Phrasebook;
}> = ({ data, book }) => (
  <div className="rounded-xl border border-purple-800/50 bg-purple-950/20 p-2.5 space-y-1.5">
    <div className="text-[10px] uppercase tracking-wider font-bold text-purple-300">
      {book.ui.productivityDiagnosisWord.replace('{region}', data.region)}
    </div>
    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
      <div>
        <span className="text-slate-500">{book.labels.evidence}</span>
        <div className="font-bold text-slate-50">
          {data.productivityChangePercent >= 0 ? '+' : ''}
          {data.productivityChangePercent}%
        </div>
      </div>
      <div>
        <span className="text-slate-500">{book.ui.cpueRowWord}</span>
        <div className="font-bold text-slate-50">{data.cpue}</div>
      </div>
    </div>
    {data.keyFactors.slice(0, 3).map((factor) => (
      <div key={factor} className="text-[10px] text-slate-300 leading-snug">
        • {factor}
      </div>
    ))}
    <p className="text-[10px] text-slate-500">
      {data.timeRange.start} → {data.timeRange.end} · {data.dataSources.join(' · ')}
    </p>
  </div>
);

export default ChatScreen;
