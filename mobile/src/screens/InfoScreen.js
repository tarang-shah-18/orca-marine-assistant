/**
 * About ORCA.
 *
 * The panel a judge opens: what the system is, how many agents are running,
 * which data products they reason over, and — most importantly — the safety
 * standard, stated plainly rather than buried in a disclaimer.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LANGUAGES, SAFETY_NOTICE, colors, space } from '../theme';
import { HARBOURS } from '../data/offline';
import { fetchStatus, BASE_URL } from '../services/api';
import { Badge, Card, Fact, Notice, SectionTitle } from '../components/ui';

export default function InfoScreen({ onBack }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.headerAction}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About ORCA</Text>
        <View />
      </View>

      <Text style={styles.title}>ORCA</Text>
      <Text style={styles.subtitle}>Marine Ecosystem Reasoning with Collaborative Agents</Text>
      <Text style={styles.metaLine}>
        SIH 2026 · Problem ID 26176 · ISRO / Department of Space · Software · Space Technology
      </Text>

      {/* Engine */}
      <SectionTitle>Engine</SectionTitle>
      {error ? (
        <Notice tone={colors.red} title="Engine unreachable">
          {error}
          {'\n\n'}Point the app at a running instance by editing BASE_URL in
          `mobile/src/services/api.js` (currently {BASE_URL}).
        </Notice>
      ) : status ? (
        <Card tone={status.ai.configured ? colors.violet : colors.cyan}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>ORCA engine v{status.version}</Text>
            <Badge
              label={status.ai.configured ? 'GEMINI' : 'DETERMINISTIC'}
              color={status.ai.configured ? colors.violet : colors.cyan}
            />
          </View>
          <Fact label="AI layer" value={status.ai.configured ? status.ai.model : 'not configured'} />
          <Fact label="Fallback" value={status.ai.fallback} mono={false} />
          <Fact label="Sessions" value={String(status.sessions)} />
          <Fact label="Data cycle" value={status.dataCycle?.label ?? '—'} />
          <Fact label="Sources" value={`${status.dataCycle?.sources?.length ?? 0} products`} />
          <Text style={styles.source}>
            ORCA is fully functional without an LLM. The model only rewrites the plan rationale
            and the answer prose — it can add agents to the roster but never remove a
            safety-critical one.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.muted}>Contacting the engine…</Text>
        </Card>
      )}

      {/* Roster */}
      <SectionTitle>Agent roster</SectionTitle>
      <Text style={styles.body}>
        A planner reads the question, resolves the intent and the slots, decomposes the request
        into a task graph, and selects a subset of these specialists. They publish typed findings
        to a shared blackboard, any agent may request collaboration from a peer, and a critic
        audits the final answer before it is shown.
      </Text>
      {(status?.agents ?? []).map((agent) => (
        <Card key={agent.id}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{agent.name}</Text>
          </View>
          <Text style={styles.agentDescription}>{agent.description}</Text>
          <View style={styles.sourceRow}>
            {agent.sources.map((s) => (
              <View key={s} style={styles.sourceChip}>
                <Text style={styles.sourceChipText}>{s}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}

      {/* Coverage */}
      <SectionTitle>Coverage</SectionTitle>
      <Card>
        <Fact label="Languages" value={`${LANGUAGES.length} Indian languages`} />
        <Text style={styles.body}>
          {LANGUAGES.map((l) => l.native).join(' · ')}
        </Text>
        <Fact label="Harbours" value={`${HARBOURS.length} Indian fishing harbours`} />
        <Text style={styles.body}>{HARBOURS.map((h) => h.shortName).join(', ')}</Text>
        {status ? (
          <>
            <Fact label="Fishing zones" value={String(status.counts.fishingZones)} />
            <Fact label="Tide stations" value={String(status.counts.tideStations)} />
            <Fact label="Boundaries" value={String(status.counts.geofences)} />
            <Fact label="Vessel classes" value={String(status.counts.vesselProfiles)} />
            <Fact label="Intents" value={String(status.counts.intents)} />
          </>
        ) : null}
      </Card>

      {/* Build */}
      <SectionTitle>Android build</SectionTitle>
      <Card>
        <Text style={styles.body}>Expo React Native client, TypeScript agent engine, Express API.</Text>
        <Text style={styles.code}>
          {'1. cd .. && npm install && npm run dev\n2. cd mobile && npm install\n3. npx expo start\n4. npx eas build -p android --profile preview'}
        </Text>
        <Text style={styles.source}>
          The emulator reaches the engine at 10.0.2.2:3000 by default. On a physical phone, set
          BASE_URL in mobile/src/services/api.js to your machine's LAN address.
        </Text>
      </Card>

      {/* Safety */}
      <Notice tone={colors.amber} title="Safety standard & responsible AI">
        {SAFETY_NOTICE}
        {'\n\n'}
        A dedicated critic agent re-reads every answer before it is shown. It removes
        over-confident phrasing, escalates any ORANGE or RED advisory, and appends the deferral to
        IMD, INCOIS and port authority warnings. The vessel remains the master's decision.
      </Notice>

      <Text style={styles.footer}>
        Built for the fishermen of the Indian coast. The reference snapshot in this build is
        aligned to a single model run; ORCA always shows the timestamp of the data behind every
        number.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  content: { padding: space.md, paddingBottom: space.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  headerAction: { color: colors.cyan, fontSize: 12, fontWeight: '800' },
  headerTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  title: { color: colors.white, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.cyan, fontSize: 13, fontWeight: '700', marginTop: 2 },
  metaLine: { color: colors.textFaint, fontSize: 10, marginTop: 6, lineHeight: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 11, lineHeight: 17, marginTop: 4 },
  agentDescription: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 2 },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  sourceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceChipText: { color: colors.textFaint, fontSize: 9 },
  source: { color: colors.textFaint, fontSize: 10, lineHeight: 15, marginTop: 6 },
  code: {
    color: colors.emerald,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  muted: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic' },
  footer: { color: colors.textFaint, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: space.md },
});
