/**
 * Conditions.
 *
 * Tide, weather, sea state and the regulated-water picture for the selected
 * harbour, each fetched from the endpoint that runs the corresponding real
 * agent. A fisher often wants the numbers without asking a question, and the
 * tide window in particular is the one thing that decides whether a small boat
 * can get in and out.
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
import {
  advisoryColor,
  colors,
  riskColor,
  severityColor,
  space,
  typeLabel,
} from '../theme';
import { fetchAlerts, fetchGeofences, fetchOcean, fetchTides, fetchWeather } from '../services/api';
import { harbourById } from '../data/offline';
import { Badge, Button, Card, Fact, Meter, Notice, SectionTitle } from '../components/ui';
import { TideCard } from '../components/ResultCards';

const HORIZONS = [
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'NEXT_3_DAYS', label: '3 days' },
];

export default function ConditionsScreen({ harbourId, language, gps, onBack, onAsk }) {
  const [horizon, setHorizon] = useState('TODAY');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const harbour = harbourById(harbourId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const anchor = gps.state === 'on' ? { latitude: gps.latitude, longitude: gps.longitude } : {};
    const results = await Promise.allSettled([
      fetchTides(harbourId, horizon),
      fetchWeather(harbourId, language),
      fetchOcean(harbourId, language),
      fetchAlerts(harbourId, { withinKm: 200, ...anchor }),
      fetchGeofences(harbourId, language),
    ]);

    const keys = ['tides', 'weather', 'ocean', 'alerts', 'geofences'];
    const next = {};
    let firstError = null;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[keys[i]] = r.value;
      else if (!firstError) firstError = r.reason?.message;
    });
    setData(next);
    setError(firstError);
    setLoading(false);
  }, [harbourId, horizon, language, gps]);

  useEffect(() => {
    load();
  }, [load]);

  const tides = data.tides;
  const weather = data.weather;
  const ocean = data.ocean;
  const alerts = data.alerts?.actionable ?? [];
  // `/geofences` returns the check result under `zones` and the full statutory
  // catalogue beside it; only the check result is relevant on this screen.
  const geofences = data.geofences?.zones;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.cyan} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.headerAction}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions · {harbour.shortName}</Text>
        <Text style={styles.headerAction}>{loading ? '…' : '↻'}</Text>
      </View>

      {error ? (
        <Notice tone={colors.red} title="Partial data">
          {error}. ORCA will not substitute a guess for a reading it could not fetch.
        </Notice>
      ) : null}

      {loading && !tides ? (
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.cyan} size="small" />
            <Text style={styles.loadingText}>Reading gauges and buoys…</Text>
          </View>
        </Card>
      ) : null}

      {/* Tides */}
      <SectionTitle>Tide</SectionTitle>
      <View style={styles.horizonRow}>
        {HORIZONS.map((h) => (
          <TouchableOpacity
            key={h.id}
            onPress={() => setHorizon(h.id)}
            style={[styles.horizon, horizon === h.id ? styles.horizonActive : null]}
          >
            <Text style={[styles.horizonText, horizon === h.id ? { color: colors.cyan } : null]}>
              {h.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tides ? (
        <TideCard report={tides} />
      ) : (
        <Card>
          <Text style={styles.muted}>Tide gauge data unavailable.</Text>
        </Card>
      )}

      {/* Weather */}
      <SectionTitle>IMD coastal marine forecast</SectionTitle>
      {weather ? (
        <Card tone={riskColor(weather.squallWarning ? 'SEVERE' : 'LOW')}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{weather.condition}</Text>
            {weather.squallWarning ? <Badge label="DO NOT VENTURE" color={colors.red} /> : null}
          </View>
          <Fact label="Wind" value={`${weather.windSpeedKnots} kt / ${weather.windSpeedKmph} km/h ${weather.windDirection}`} />
          <Fact label="Gusts" value={`${weather.gustKnots} kt`} />
          <Fact label="Visibility" value={`${weather.visibilityKm} km`} />
          <Fact label="Rain" value={`${weather.rainProbability}%`} />
          <Fact
            label="Lightning"
            value={weather.lightningRisk}
            tone={weather.lightningRisk === 'HIGH' ? colors.red : weather.lightningRisk === 'MODERATE' ? colors.amber : colors.emerald}
          />
          <Meter
            value={weather.windSpeedKnots}
            max={40}
            color={weather.windSpeedKnots > 25 ? colors.red : weather.windSpeedKnots > 16 ? colors.amber : colors.emerald}
          />
          <Text style={styles.source}>
            {weather.source} · {weather.forecastSlots} slots over {weather.forecastDays} days
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.muted}>Forecast unavailable.</Text>
        </Card>
      )}

      {/* Ocean */}
      <SectionTitle>INCOIS ocean state</SectionTitle>
      {ocean ? (
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Douglas {ocean.seaStateCode} · {ocean.seaCondition}</Text>
            <Text style={styles.big}>{ocean.waveHeightMeters} m</Text>
          </View>
          <Fact label="Swell" value={`${ocean.swellDirection} ${ocean.swellDirectionDeg}° · ${ocean.wavePeriodSeconds} s`} />
          <Fact
            label="SST"
            value={`${ocean.seaSurfaceTempCelsius}°C (anomaly ${ocean.sstAnomalyC >= 0 ? '+' : ''}${ocean.sstAnomalyC}°C)`}
          />
          <Fact label="Current" value={`${ocean.currentKnots} kt ${ocean.currentDirection}`} />
          <Meter
            value={ocean.waveHeightMeters}
            max={6}
            color={ocean.waveHeightMeters > 3.5 ? colors.red : ocean.waveHeightMeters > 2.5 ? colors.amber : colors.emerald}
          />
          <Text style={styles.source}>{ocean.source}</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.muted}>Ocean state unavailable.</Text>
        </Card>
      )}

      {/* Advisories */}
      <SectionTitle>Warnings within range</SectionTitle>
      {alerts.length === 0 ? (
        <Card tone={colors.emerald}>
          <Text style={styles.clear}>No advisory in force within {data.alerts?.withinKm ?? 200} km.</Text>
        </Card>
      ) : (
        alerts.map((a) => (
          <Card key={a.id} tone={advisoryColor(a.advisoryLevel)}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Badge label={a.advisoryLevel} color={advisoryColor(a.advisoryLevel)} />
            </View>
            <Fact label="Type" value={a.type.replace('_', ' ')} mono={false} />
            <Fact label="Distance" value={`${a.distanceKm} km ${a.bearing}`} />
            <Fact label="Valid" value={`${a.validFrom} → ${a.validUntil}`} />
            <Text style={styles.action}>{a.action}</Text>
            <Text style={styles.source}>{a.source}</Text>
          </Card>
        ))
      )}

      {/* Geofencing */}
      <SectionTitle>Regulated waters</SectionTitle>
      {geofences ? (
        <>
          <Card tone={geofences.violations.length ? colors.red : colors.emerald}>
            <Fact
              label="Conflicts"
              value={`${geofences.violations.length} on the planned corridor`}
              tone={geofences.violations.length ? colors.red : colors.emerald}
            />
            <Fact label="Nearby" value={`${geofences.nearbyBoundaries.length} within range`} />
            {geofences.warnings.map((w, i) => (
              <Text key={i} style={styles.action}>
                • {w}
              </Text>
            ))}
            <Text style={styles.source}>{geofences.source}</Text>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.geoStrip}>
            {(geofences.nearbyBoundaries ?? []).map((v) => (
              <View key={v.boundaryId} style={[styles.geoCard, { borderColor: severityColor(v.severity) }]}>
                <Badge label={v.severity} color={severityColor(v.severity)} />
                <Text style={styles.geoName}>{v.boundaryName}</Text>
                <Text style={styles.geoMeta}>
                  {typeLabel[v.boundaryType] ?? v.boundaryType} · {v.distanceKm} km {v.bearing}
                </Text>
                <Text style={styles.geoRegulation}>{v.regulation}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : (
        <Card>
          <Text style={styles.muted}>Geofence catalogue unavailable.</Text>
        </Card>
      )}

      <Button
        label="Ask ORCA whether it is safe to go tomorrow"
        onPress={() => onAsk('Is it safe to go fishing tomorrow morning?')}
        style={styles.cta}
      />
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
    marginBottom: space.sm,
  },
  headerAction: { color: colors.cyan, fontSize: 12, fontWeight: '800' },
  headerTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  big: { color: colors.cyan, fontSize: 17, fontWeight: '900' },
  horizonRow: { flexDirection: 'row', gap: 6, marginBottom: space.sm },
  horizon: {
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.surfaceAlt,
  },
  horizonActive: { backgroundColor: colors.cyanWash, borderColor: colors.cyan },
  horizonText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  action: { color: colors.amber, fontSize: 11, lineHeight: 16, marginTop: 4 },
  source: { color: colors.textFaint, fontSize: 9, marginTop: 5, lineHeight: 13 },
  muted: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic' },
  clear: { color: colors.emerald, fontSize: 12, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.textDim, fontSize: 12 },
  geoStrip: { marginTop: space.sm },
  geoCard: {
    width: 220,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: space.sm,
    marginRight: space.sm,
  },
  geoName: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 4 },
  geoMeta: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  geoRegulation: { color: colors.textDim, fontSize: 10, lineHeight: 14, marginTop: 4 },
  cta: { marginTop: space.lg },
});
