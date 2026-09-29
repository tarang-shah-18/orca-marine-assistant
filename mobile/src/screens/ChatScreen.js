/**
 * Conversation.
 *
 * The centrepiece. ORCA answers in the fisher's own language, shows the plan
 * and every agent as it happens, and then attaches the structured products —
 * the fishing ground, the advisories, the tide table, the geofence check, the
 * route, the productivity diagnosis — underneath the prose so the reasoning can
 * be checked rather than trusted.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { LANGUAGES, colors, languageByCode, riskWord, space } from '../theme';
import { CAPABILITIES, INTRO, labelFor } from '../data/offline';
import { ask, resetConversation } from '../services/api';
import AgentTrace, { emptyTrace, reduceTrace, traceFromResult } from '../components/AgentTrace';
import {
  AlertsCard,
  ChartsCard,
  EvidenceCard,
  GeofenceCard,
  HistoricalCard,
  HotspotsCard,
  PfzCard,
  RouteCard,
  TideCard,
} from '../components/ResultCards';
import { Badge, Card, Chip, RiskBadge } from '../components/ui';

export default function ChatScreen({
  language,
  harbourId,
  gps,
  messages,
  onMessages,
  onBack,
  onOpenMap,
  /** A question queued by the home screen, or `null`. */
  queued,
  onQueuedConsumed,
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [trace, setTrace] = useState(emptyTrace());
  const [openPanels, setOpenPanels] = useState({});
  const [speakingId, setSpeakingId] = useState(null);
  const endRef = useRef(null);

  // The SSE callback fires far faster than React re-renders, so events are
  // accumulated in a ref and flushed on a timer.
  const traceRef = useRef(emptyTrace());
  const flushTimer = useRef(null);
  // `busy` is read inside `send` but must not be one of its dependencies, or
  // the identity of `send` would change on every turn and re-fire the queued
  // question effect.
  const busyRef = useRef(false);

  useEffect(() => () => clearTimeout(flushTimer.current), []);

  const onEvent = useCallback((event) => {
    traceRef.current = reduceTrace(traceRef.current, event);
    if (flushTimer.current === null) {
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        setTrace(traceRef.current);
      }, 90);
    }
  }, []);

  const send = useCallback(
    async (text, options = {}) => {
      const query = (text ?? '').trim();
      if (!query || busyRef.current) return;

      if (options.echo !== false) {
        onMessages((prev) => [
          ...prev,
          {
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: 'user',
            text: query,
            at: new Date().toLocaleTimeString(),
          },
        ]);
      }

      Speech.stop();
      setSpeakingId(null);
      setInput('');
      setNotice(null);
      busyRef.current = true;
      setBusy(true);
      traceRef.current = emptyTrace();
      setTrace(traceRef.current);

      try {
        const outcome = await ask({
          message: query,
          language,
          harbor: harbourId,
          latitude: gps.state === 'on' ? gps.latitude : undefined,
          longitude: gps.state === 'on' ? gps.longitude : undefined,
          onEvent,
        });

        if (!outcome.result) {
          setNotice(outcome.error ?? 'The ORCA engine did not answer.');
          return;
        }

        const id = `o-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        onMessages((prev) => [
          ...prev,
          {
            id,
            sender: 'orca',
            text: outcome.result.answer,
            result: outcome.result,
            offline: outcome.offline,
            at: new Date().toLocaleTimeString(),
          },
        ]);
        setTrace(traceRef.current);
        setOpenPanels((prev) => ({ ...prev, [id]: 'why' }));
      } catch (e) {
        setNotice(e.message ?? 'The ORCA engine did not answer.');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [language, harbourId, gps, onMessages, onEvent],
  );

  // A question dispatched from the home screen or a capability chip arrives as
  // a queued string; answer it exactly once.
  useEffect(() => {
    if (!queued) return;
    onQueuedConsumed();
    void send(queued, { echo: true });
  }, [queued, onQueuedConsumed, send]);

  useEffect(() => {
    endRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, busy]);

  const speak = (message) => {
    if (speakingId === message.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    const tag = message.result?.detectedLanguage ?? language;
    Speech.stop();
    setSpeakingId(message.id);
    Speech.speak(`${message.text} ${message.result?.recommendation ?? ''}`, {
      language: tag,
      rate: 0.95,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  const newest = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === 'orca') return messages[i];
    }
    return null;
  }, [messages]);

  const startOver = async () => {
    Speech.stop();
    await resetConversation();
    onMessages(() => []);
    setTrace(emptyTrace());
    traceRef.current = emptyTrace();
    setOpenPanels({});
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.headerAction}>← Home</Text>
        </TouchableOpacity>
        <View style={styles.headerCentre}>
          <Text style={styles.headerTitle}>ORCA</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {languageByCode(language).native} · {gps.state === 'on' ? 'GPS' : 'harbour'} anchor
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onOpenMap} hitSlop={10}>
            <Text style={styles.headerAction}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startOver} hitSlop={10} style={styles.reset}>
            <Text style={styles.headerAction}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <Card>
            <Text style={styles.introTitle}>Collaborative marine decision support</Text>
            <Text style={styles.intro}>{INTRO[language] ?? INTRO['en-IN']}</Text>
            <Text style={styles.introHint}>
              Tap any capability below, or type in any of the {LANGUAGES.length} languages.
            </Text>
          </Card>
        ) : null}

        {messages.map((m) =>
          m.sender === 'user' ? (
            <View key={m.id} style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
              <Text style={styles.stamp}>{m.at}</Text>
            </View>
          ) : (
            <OrcaAnswer
              key={m.id}
              message={m}
              live={trace}
              isNewest={newest()?.id === m.id}
              panel={openPanels[m.id] ?? null}
              onTogglePanel={(id, p) =>
                setOpenPanels((prev) => ({ ...prev, [id]: prev[id] === p ? null : p }))
              }
              speaking={speakingId === m.id}
              onSpeak={() => speak(m)}
              onOpenMap={onOpenMap}
            />
          ),
        )}

        {busy ? (
          <Card tone={colors.cyan}>
            <View style={styles.workingRow}>
              <ActivityIndicator color={colors.cyan} size="small" />
              <Text style={styles.workingText}>
                {trace.language
                  ? `Detected ${languageByCode(trace.language).native} · planning`
                  : 'Planning…'}
              </Text>
            </View>
            <AgentTrace trace={trace} live />
            {trace.findings.length > 0 ? (
              <View style={styles.findingList}>
                {trace.findings.slice(-4).map((f, i) => (
                  <Text key={`${f.agent}-${i}`} style={styles.finding}>
                    ✓ {f.statement}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {notice ? (
          <Card tone={colors.red}>
            <Text style={styles.noticeTitle}>ORCA could not answer</Text>
            <Text style={styles.noticeBody}>{notice}</Text>
            <TouchableOpacity onPress={() => setNotice(null)}>
              <Text style={styles.link}>Dismiss</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        <View ref={endRef} />
      </ScrollView>

      {/* Capability chips — the problem statement's eight questions */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CAPABILITIES.map((c, i) => (
            <Chip
              key={c.id}
              label={labelFor(i, language)}
              onPress={() => send(c.questions[language] ?? c.questions['en-IN'])}
              disabled={busy}
            />
          ))}
        </ScrollView>
      </View>

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Ask in ${languageByCode(language).native}…`}
          placeholderTextColor={colors.textFaint}
          editable={!busy}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity
          style={[styles.send, { opacity: input.trim() && !busy ? 1 : 0.35 }]}
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
        >
          <Text style={styles.sendText}>Ask</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ *
 * One answer
 * ------------------------------------------------------------------ */

const OrcaAnswer = ({
  message,
  live,
  isNewest,
  panel,
  onTogglePanel,
  speaking,
  onSpeak,
  onOpenMap,
}) => {
  const result = message.result;
  // The turn still on screen keeps the live stream; older turns replay from
  // their own agent results, so no narration is ever invented after the fact.
  const trace = useMemo(
    () => (result && isNewest && live.finished && live.steps.length ? live : traceFromResult(result)),
    [result, isNewest, live],
  );
  const language = result?.detectedLanguage ?? 'en-IN';

  if (!result) {
    return (
      <View style={styles.orcaRow}>
        <View style={styles.orcaBubble}>
          <Text style={styles.orcaText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  const toggle = (p) => onTogglePanel(message.id, p);

  return (
    <View style={styles.orcaRow}>
      <View style={styles.orcaBubble}>
        <View style={styles.orcaHeader}>
          <Text style={styles.orcaName}>ORCA</Text>
          <RiskBadge level={result.riskLevel} label={riskWord(result.riskLevel, language)} />
          <Badge label={languageByCode(language).native} color={colors.cyan} />
          {result.aiGenerated ? <Badge label="GEMINI" color={colors.violet} /> : null}
          {message.offline ? <Badge label="OFFLINE" color={colors.textFaint} /> : null}
        </View>

        <Text style={styles.orcaText}>{message.text}</Text>

        <View style={styles.recommendation}>
          <Text style={styles.recommendationLabel}>RECOMMENDATION</Text>
          <Text style={styles.recommendationText}>{result.recommendation}</Text>
        </View>

        {/* Structured products, in the order a decision is actually made. */}
        {result.marineAlerts?.length ? <AlertsCard alerts={result.marineAlerts} /> : null}
        {result.pfzZone ? <PfzCard zone={result.pfzZone} /> : null}
        {result.hotspots?.length ? <HotspotsCard hotspots={result.hotspots} /> : null}
        {result.tideReport ? <TideCard report={result.tideReport} /> : null}
        {result.geofencingData ? <GeofenceCard data={result.geofencingData} /> : null}
        {result.routeData ? <RouteCard route={result.routeData} /> : null}
        {result.historicalData ? <HistoricalCard data={result.historicalData} /> : null}
        <ChartsCard visualizations={result.visualizations} />

        {/* Panel switcher */}
        <View style={styles.tabs}>
          <PanelTab
            active={panel === 'why'}
            onPress={() => toggle('why')}
            label={`Agents (${result.selectedAgents.length})`}
          />
          <PanelTab
            active={panel === 'data'}
            onPress={() => toggle('data')}
            label="Data"
          />
          <PanelTab
            active={panel === 'evidence'}
            onPress={() => toggle('evidence')}
            label={`Evidence (${result.evidence.length})`}
          />
          <TouchableOpacity onPress={onSpeak} style={styles.listen}>
            <Text style={styles.listenText}>{speaking ? '■ Stop' : '▶ Listen'}</Text>
          </TouchableOpacity>
        </View>

        {panel === 'why' ? <AgentTrace trace={trace} /> : null}
        {panel === 'data' ? <DataPanel result={result} /> : null}
        {panel === 'evidence' ? <EvidenceCard result={result} /> : null}

        <View style={styles.footer}>
          <Text style={styles.stamp}>{message.at}</Text>
          {result.pfzZone ? (
            <TouchableOpacity onPress={() => onOpenMap(result.pfzZone)}>
              <Text style={styles.link}>View zone on map →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const PanelTab = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.tab, active ? styles.tabActive : null]}>
    <Text style={[styles.tabText, active ? { color: colors.cyan } : null]}>{label}</Text>
  </TouchableOpacity>
);

/** Raw numbers, for a fisher who wants to check the arithmetic. */
const DataPanel = ({ result }) => {
  const w = result.weatherData;
  const o = result.oceanData;
  const t = result.tideReport;

  if (!w && !o && !t) {
    return (
      <Card>
        <Text style={styles.metaMuted}>This question did not need an instrumented reading.</Text>
      </Card>
    );
  }

  return (
    <Card>
      {w ? (
        <>
          <Text style={styles.dataHeading}>IMD coastal marine forecast</Text>
          <Row label="Wind" value={`${w.windSpeedKnots} kt (${w.windSpeedKmph} km/h) ${w.windDirection}`} />
          <Row label="Gusts" value={`${w.gustKnots} kt`} />
          <Row label="Visibility" value={`${w.visibilityKm} km`} />
          <Row label="Rain" value={`${w.rainProbability}%`} />
          <Row label="Lightning" value={w.lightningRisk} />
          <Row label="Squall" value={w.squallWarning ? 'YES — do not venture' : 'No'} />
          <Row label="Slots" value={`${w.forecast.length} over ${w.forecastDays ?? new Set(w.forecast.map((s) => s.date)).size} days`} />
          <Text style={styles.source}>{w.source}</Text>
        </>
      ) : null}

      {o ? (
        <>
          <Text style={styles.dataHeading}>INCOIS ocean state</Text>
          <Row label="Wave height" value={`${o.waveHeightMeters} m`} />
          <Row label="Period" value={`${o.wavePeriodSeconds} s`} />
          <Row label="Swell" value={`${o.swellDirection} ${o.swellDirectionDeg}°`} />
          <Row
            label="SST"
            value={`${o.seaSurfaceTempCelsius}°C (anomaly ${o.sstAnomalyC >= 0 ? '+' : ''}${o.sstAnomalyC}°C)`}
          />
          <Row label="Current" value={`${o.currentKnots} kt ${o.currentDirection}`} />
          <Row label="Sea state" value={`Douglas ${o.seaStateCode} — ${o.seaCondition}`} />
          <Text style={styles.source}>{o.source}</Text>
        </>
      ) : null}

      {t ? (
        <>
          <Text style={styles.dataHeading}>Tide gauge · {t.station.name}</Text>
          <Row label="Now" value={`${t.currentLevel.toFixed(2)} m (${t.isRising ? 'rising' : 'falling'})`} />
          <Row label="Range" value={`${t.maxRangeMeters.toFixed(2)} m`} />
          <Row
            label="Best window"
            value={
              t.recommendedWindow
                ? `${t.recommendedWindow.startLabel}–${t.recommendedWindow.endLabel} (${t.recommendedWindow.quality})`
                : '—'
            }
          />
          <Row label="Constituents" value={String(t.station.harmonics.length)} />
          <Text style={styles.source}>{t.source}</Text>
        </>
      ) : null}
    </Card>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.dataRow}>
    <Text style={styles.dataLabel}>{label}</Text>
    <Text style={styles.dataValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAction: { color: colors.cyan, fontSize: 12, fontWeight: '800' },
  headerCentre: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  headerSub: { color: colors.textFaint, fontSize: 9 },
  headerRight: { flexDirection: 'row', gap: 10 },
  reset: { paddingLeft: 4 },
  transcript: { flex: 1 },
  transcriptContent: { padding: space.md, paddingBottom: space.xl },
  userRow: { alignItems: 'flex-end', marginBottom: space.md },
  userBubble: {
    maxWidth: '88%',
    backgroundColor: colors.cyan,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    padding: space.md,
  },
  userText: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  orcaRow: { alignItems: 'flex-start', marginBottom: space.md },
  orcaBubble: {
    width: '97%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderBottomColor: colors.border,
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    padding: space.md,
  },
  orcaHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  orcaName: { color: colors.cyan, fontSize: 12, fontWeight: '900', marginRight: 6 },
  orcaText: { color: colors.text, fontSize: 14, lineHeight: 21, marginVertical: space.sm },
  recommendation: {
    backgroundColor: colors.cyanWash,
    borderRadius: 10,
    padding: space.sm,
    marginTop: space.xs,
  },
  recommendationLabel: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  recommendationText: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 2 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.md },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tabActive: { backgroundColor: colors.void, borderColor: colors.cyanDim },
  tabText: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  listen: { marginLeft: 'auto', backgroundColor: colors.cyan, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  listenText: { color: colors.void, fontSize: 10, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.sm },
  stamp: { color: colors.textFaint, fontSize: 9 },
  link: { color: colors.cyan, fontSize: 10, fontWeight: '700' },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.sm },
  workingText: { color: colors.cyan, fontSize: 12, fontWeight: '700' },
  findingList: { marginTop: space.sm },
  finding: { color: colors.textDim, fontSize: 10, lineHeight: 15 },
  noticeTitle: { color: colors.red, fontSize: 12, fontWeight: '800' },
  noticeBody: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginVertical: 4 },
  introTitle: { color: colors.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  intro: { color: colors.text, fontSize: 12, lineHeight: 19, marginTop: 6 },
  introHint: { color: colors.textFaint, fontSize: 10, marginTop: 6, lineHeight: 15 },
  chipBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    maxHeight: 46,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.void,
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  send: { backgroundColor: colors.cyan, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  sendText: { color: colors.void, fontSize: 13, fontWeight: '900' },
  dataHeading: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 3,
  },
  dataRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  dataLabel: { color: colors.textFaint, fontSize: 10, width: 92 },
  dataValue: { color: colors.text, fontSize: 11, flex: 1 },
  source: { color: colors.textFaint, fontSize: 9, marginTop: 4 },
  metaMuted: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic' },
});
