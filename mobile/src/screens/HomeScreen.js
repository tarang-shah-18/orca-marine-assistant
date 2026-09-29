/**
 * Home.
 *
 * A fisher who opens ORCA at 4 a.m. should learn two things before typing
 * anything: what ORCA currently knows about their coast, and that it is
 * reachable. Everything else — which harbour, which language — is a control
 * that changes the anchor for the whole conversation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { LANGUAGES, SAFETY_NOTICE, colors, riskColor, space } from '../theme';
import { HARBOURS, CAPABILITIES, harbourById, labelFor } from '../data/offline';
import { fetchSituation, fetchStatus } from '../services/api';
import { Badge, Button, Card, Chip, Notice, RiskBadge, SectionTitle } from '../components/ui';

/** Douglas sea state → plain words, for the marine picture card. */
const SEA_STATE = (code) =>
  ({ 0: 'Calm (glassy)', 1: 'Calm (rippled)', 2: 'Smooth', 3: 'Slight', 4: 'Moderate', 5: 'Rough' }[
    code
  ] ?? '—');

export default function HomeScreen({
  language,
  onLanguage,
  harbourId,
  onHarbour,
  gps,
  onGps,
  onAsk,
  onOpenMap,
  onOpenInfo,
}) {
  const [brief, setBrief] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [situation, engine] = await Promise.allSettled([
      fetchSituation(harbourId, language),
      fetchStatus(),
    ]);
    if (situation.status === 'fulfilled') setBrief(situation.value);
    else setError(situation.reason?.message ?? 'The ORCA engine is unreachable.');
    if (engine.status === 'fulfilled') setStatus(engine.value);
    setLoading(false);
  }, [harbourId, language]);

  useEffect(() => {
    load();
  }, [load]);

  const acquireGps = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      onGps({ state: 'denied' });
      return;
    }
    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onGps({
        state: 'on',
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
      });
    } catch (e) {
      onGps({ state: 'error', message: e.message });
    }
  }, [onGps]);

  const toggleGps = useCallback(() => {
    if (gps.state === 'on') onGps({ state: 'off' });
    else acquireGps();
  }, [gps.state, acquireGps, onGps]);

  const alert = brief?.alert;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading && brief !== null}
          onRefresh={load}
          tintColor={colors.cyan}
        />
      }
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>SIH 2026 · PROBLEM ID 26176</Text>
      </View>

      <Text style={styles.title}>ORCA</Text>
      <Text style={styles.subtitle}>
        Marine Ecosystem Reasoning with Collaborative Agents
      </Text>
      <Text style={styles.blurb}>
        Thirteen agents plan, cross-check and explain every answer. Ask in any of 11 Indian
        languages and get the same language back.
      </Text>

      {/* Proactive brief — a fisher should not have to ask to be warned. */}
      <SectionTitle
        right={
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={styles.link}>Refresh</Text>
          </TouchableOpacity>
        }
      >
        Marine picture now
      </SectionTitle>

      {loading && !brief ? (
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.cyan} size="small" />
            <Text style={styles.loadingText}>Agents are reading the latest bulletins…</Text>
          </View>
        </Card>
      ) : error ? (
        <Notice tone={colors.red} title="Engine unreachable">
          {error}
          {'\n\n'}ORCA will not invent a forecast. Start the agent engine with `npm run dev` in the
          project root, or check the server address in `mobile/src/services/api.js`.
        </Notice>
      ) : (
        <Card tone={riskColor(brief?.riskLevel)}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{harbourById(harbourId).shortName}</Text>
            <RiskBadge level={brief?.riskLevel} label={brief?.riskLabel} />
          </View>

          {alert ? (
            <>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertBody}>
                {alert.distanceKm} km {alert.bearing} · valid until {alert.validUntil}
              </Text>
              <Text style={styles.alertAction}>{alert.action}</Text>
              <Badge label={alert.source} color={colors.amber} />
            </>
          ) : (
            <Text style={styles.alertBody}>
              No active advisory within range. {brief?.headline ?? ''}
            </Text>
          )}

          {brief?.weather && brief?.ocean ? (
            <View style={styles.conditions}>
              <View style={styles.condition}>
                <Text style={styles.conditionValue}>{brief.weather.windKnots} kt</Text>
                <Text style={styles.conditionLabel}>
                  wind {brief.weather.windDirection} · {brief.weather.condition}
                </Text>
              </View>
              <View style={styles.condition}>
                <Text style={styles.conditionValue}>{brief.ocean.waveHeightMeters} m</Text>
                <Text style={styles.conditionLabel}>
                  {SEA_STATE(brief.ocean.seaStateCode)} · {brief.ocean.sstCelsius}°C
                </Text>
              </View>
              <View style={styles.condition}>
                <Text style={styles.conditionValue}>
                  {brief.tide ? `${brief.tide.currentLevelMeters} m` : '—'}
                </Text>
                <Text style={styles.conditionLabel}>
                  {brief.tide ? (brief.tide.isRising ? 'tide rising' : 'tide falling') : 'tide n/a'}
                </Text>
              </View>
            </View>
          ) : null}

          {brief?.fishingZone ? (
            <Text style={styles.zoneLine}>
              Nearest PFZ · {brief.fishingZone.name} · {brief.fishingZone.distanceKm} km{' '}
              {brief.fishingZone.bearing} · index {brief.fishingZone.productivityIndex}/100
            </Text>
          ) : null}

          {brief?.recommendation ? (
            <Text style={styles.recommendation}>{brief.recommendation}</Text>
          ) : null}
        </Card>
      )}

      {/* Language */}
      <SectionTitle>Language · detected automatically</SectionTitle>
      <View style={styles.wrapRow}>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.code}
            label={`${l.native}  ·  ${l.region}`}
            active={l.code === language}
            onPress={() => onLanguage(l.code)}
          />
        ))}
      </View>

      {/* Harbour */}
      <SectionTitle>Home harbour · every calculation is anchored here</SectionTitle>
      <View style={styles.harbourGrid}>
        {HARBOURS.map((h) => {
          const active = h.id === harbourId;
          return (
            <TouchableOpacity
              key={h.id}
              onPress={() => onHarbour(h.id)}
              style={[styles.harbourCard, active ? styles.harbourCardActive : null]}
            >
              <Text style={[styles.harbourName, active ? styles.harbourNameActive : null]}>
                {h.shortName}
              </Text>
              <Text style={styles.harbourState} numberOfLines={1}>
                {h.state}
              </Text>
              <Text style={styles.harbourBasin} numberOfLines={1}>
                {h.basin}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* GPS */}
      <SectionTitle>Position</SectionTitle>
      <Card>
        <View style={styles.gpsRow}>
          <View style={styles.gpsText}>
            <Text style={styles.gpsLabel}>
              {gps.state === 'on'
                ? 'GPS fix acquired'
                : gps.state === 'denied'
                  ? 'Location permission denied'
                  : gps.state === 'error'
                    ? 'Could not get a fix'
                    : 'Using harbour coordinates'}
            </Text>
            <Text style={styles.gpsValue}>
              {gps.state === 'on'
                ? `${gps.latitude.toFixed(4)}°, ${gps.longitude.toFixed(4)}° · ±${Math.round(
                    gps.accuracy ?? 0,
                  )} m`
                : 'A live fix beats a harbour anchor for every distance and bearing.'}
            </Text>
          </View>
          <Button
            label={gps.state === 'on' ? 'Off' : 'Use GPS'}
            onPress={toggleGps}
            filled={gps.state === 'on'}
            tone={gps.state === 'on' ? colors.emerald : colors.cyan}
          />
        </View>
      </Card>

      {/* The eight capabilities */}
      <SectionTitle>What ORCA can answer</SectionTitle>
      <View style={styles.wrapRow}>
        {CAPABILITIES.map((c, index) => (
          <Chip
            key={c.id}
            label={labelFor(index, language)}
            onPress={() => onAsk(c.questions[language] ?? c.questions['en-IN'])}
            disabled={!!error}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Start a conversation" onPress={() => onAsk(null)} style={styles.flex} />
        <Button
          label="Marine map"
          onPress={onOpenMap}
          tone={colors.emerald}
          style={styles.flex}
        />
      </View>

      {/* Engine provenance */}
      <TouchableOpacity onPress={onOpenInfo}>
        <Text style={styles.statusLine}>
          {status
            ? `${status.counts.agents} agents · ${status.counts.languages} languages · ${status.counts.harbours} harbours · AI ${
                status.ai.configured ? status.ai.model : 'offline-deterministic'
              }`
            : 'Engine status unavailable'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.safety}>{SAFETY_NOTICE}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  content: { padding: space.lg, paddingBottom: space.xxl },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cyanWash,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: space.md,
  },
  badgeText: { color: colors.cyan, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.white, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.cyan, fontSize: 14, fontWeight: '700', marginTop: 2 },
  blurb: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  alertTitle: { color: colors.white, fontSize: 13, fontWeight: '700', marginTop: 6 },
  alertBody: { color: colors.textDim, fontSize: 11, marginTop: 2, lineHeight: 16 },
  alertAction: { color: colors.amber, fontSize: 11, marginTop: 4, lineHeight: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.textDim, fontSize: 12 },
  conditions: { flexDirection: 'row', marginTop: space.md, gap: space.sm },
  condition: { flex: 1 },
  conditionValue: { color: colors.white, fontSize: 17, fontWeight: '800' },
  conditionLabel: { color: colors.textFaint, fontSize: 9, marginTop: 1, lineHeight: 12 },
  zoneLine: { color: colors.emerald, fontSize: 11, marginTop: space.md, lineHeight: 16 },
  recommendation: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  harbourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  harbourCard: {
    width: '31.5%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  harbourCardActive: { backgroundColor: colors.cyanWash, borderColor: colors.cyan },
  harbourName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  harbourNameActive: { color: colors.white },
  harbourState: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  harbourBasin: { color: colors.textFaint, fontSize: 8, marginTop: 1 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gpsText: { flex: 1 },
  gpsLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  gpsValue: { color: colors.textFaint, fontSize: 10, marginTop: 2, lineHeight: 14 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
  link: { color: colors.cyan, fontSize: 11, fontWeight: '700' },
  statusLine: {
    color: colors.textFaint,
    fontSize: 10,
    textAlign: 'center',
    marginTop: space.lg,
    lineHeight: 14,
  },
  safety: {
    color: colors.textFaint,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: space.sm,
    fontStyle: 'italic',
  },
});
