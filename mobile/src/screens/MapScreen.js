/**
 * Marine GIS.
 *
 * Every layer here is drawn from `GET /api/map-data`, which runs the real PFZ,
 * ocean, weather, route, geofencing, alert, risk and visualisation agents
 * against the selected harbour. Nothing is hard-coded, and the route drawn is
 * the route the risk agent scored.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import {
  advisoryColor,
  colors,
  riskColor,
  severityColor,
  space,
  typeLabel,
} from '../theme';
import { fetchMapData, fetchRoute } from '../services/api';
import { harbourById } from '../data/offline';
import { Badge, Button, Card, Chip, Fact, Notice, RiskBadge, SectionTitle } from '../components/ui';

const KM_TO_M = 1000;

const LAYERS = [
  { id: 'pfz', label: 'Fishing zones' },
  { id: 'route', label: 'Route' },
  { id: 'geofence', label: 'Regulated waters' },
  { id: 'alerts', label: 'Advisories' },
  { id: 'harbours', label: 'Other harbours' },
];

export default function MapScreen({ harbourId, language, gps, onBack, onAsk }) {
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(() =>
    LAYERS.reduce((acc, l) => ({ ...acc, [l.id]: true }), {}),
  );
  const [selected, setSelected] = useState(null);
  const [routeTo, setRouteTo] = useState(null);

  const harbour = harbourById(harbourId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBundle(await fetchMapData(harbourId, language));
    } catch (e) {
      setError(e.message ?? 'Could not load the marine picture.');
    } finally {
      setLoading(false);
    }
  }, [harbourId, language]);

  useEffect(() => {
    load();
  }, [load]);

  const centre = useMemo(
    () =>
      gps.state === 'on'
        ? { latitude: gps.latitude, longitude: gps.longitude }
        : { latitude: harbour.latitude, longitude: harbour.longitude },
    [gps, harbour],
  );

  /** Plan a corridor to a different harbour, scored by the route agent. */
  const planRoute = useCallback(
    async (destinationId) => {
      setRouteTo(destinationId);
      try {
        const answer = await fetchRoute(harbourId, destinationId, undefined, language);
        setBundle((prev) => (prev ? { ...prev, route: answer.route } : prev));
        setSelected({ kind: 'route' });
      } catch (e) {
        setError(e.message ?? 'Route engine failed.');
      } finally {
        setRouteTo(null);
      }
    },
    [harbourId, language],
  );

  const region = useMemo(() => ({ ...centre, latitudeDelta: 1.6, longitudeDelta: 1.6 }), [centre]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.headerAction}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marine GIS · {harbour.shortName}</Text>
        <TouchableOpacity onPress={load} hitSlop={10}>
          <Text style={styles.headerAction}>{loading ? '…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <MapView style={styles.map} initialRegion={region} region={region} showsUserLocation>
        {/* OpenStreetMap raster tiles: no API key, no vendor lock-in. */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={18}
          flipY={false}
          opacity={0.85}
        />

        {active.harbours &&
          (bundle?.harbours ?? []).map((h) => (
            <Marker
              key={h.id}
              coordinate={{ latitude: h.latitude, longitude: h.longitude }}
              title={h.name}
              description={h.state}
              pinColor={h.id === harbourId ? colors.cyan : colors.textFaint}
              onPress={() =>
                h.id === harbourId
                  ? null
                  : onAsk(`Plan the safest route from ${harbour.shortName} to ${h.shortName}`)
              }
            />
          ))}

        {/* Harbour or GPS anchor */}
        <Marker
          coordinate={centre}
          title={gps.state === 'on' ? 'Your position' : harbour.name}
          description={gps.state === 'on' ? 'GPS fix' : harbour.state}
          pinColor={colors.emerald}
        />

        {/* Potential fishing zones */}
        {active.pfz &&
          (bundle?.fishingZones ?? []).map((z) => (
            <Circle
              key={z.id}
              center={{ latitude: z.latitude, longitude: z.longitude }}
              radius={Math.max(z.radiusKm ?? 20, 8) * KM_TO_M}
              strokeWidth={z.id === bundle?.activeZone?.id ? 3 : 1}
              strokeColor={
                z.status === 'favorable'
                  ? colors.emerald
                  : z.status === 'moderate'
                    ? colors.amber
                    : colors.orange
              }
              fillColor={`${
                z.status === 'favorable' ? colors.emerald : z.status === 'moderate' ? colors.amber : colors.orange
              }22`}
              onPress={() => setSelected({ kind: 'pfz', zone: z })}
            />
          ))}

        {/* Advisory geometry */}
        {active.alerts &&
          (bundle?.alerts ?? []).map((a) =>
            a.geometry?.kind === 'circle' && a.geometry.center ? (
              <Circle
                key={a.id}
                center={a.geometry.center}
                radius={(a.geometry.radiusKm ?? 60) * KM_TO_M}
                strokeWidth={2}
                strokeColor={advisoryColor(a.advisoryLevel)}
                fillColor={`${advisoryColor(a.advisoryLevel)}1f`}
                onPress={() => setSelected({ kind: 'alert', alert: a })}
              />
            ) : a.geometry?.kind === 'polygon' && a.geometry.polygon ? (
              <Polygon
                key={a.id}
                coordinates={a.geometry.polygon.map(([la, lo]) => ({
                  latitude: la,
                  longitude: lo,
                }))}
                strokeWidth={2}
                strokeColor={advisoryColor(a.advisoryLevel)}
                fillColor={`${advisoryColor(a.advisoryLevel)}1f`}
                onPress={() => setSelected({ kind: 'alert', alert: a })}
              />
            ) : null,
          )}

        {/* Regulated waters */}
        {active.geofence &&
          (bundle?.geofences ?? []).map((g) => {
            const colour = severityColor(g.severity);
            if (g.shape === 'circle' && g.center && g.radiusKm) {
              return (
                <Circle
                  key={g.id}
                  center={g.center}
                  radius={g.radiusKm * KM_TO_M}
                  strokeWidth={2}
                  strokeColor={colour}
                  fillColor={`${colour}1a`}
                  onPress={() => setSelected({ kind: 'geofence', zone: g })}
                />
              );
            }
            if (g.coordinates?.length >= 3) {
              return (
                <Polygon
                  key={g.id}
                  coordinates={g.coordinates.map(([la, lo]) => ({ latitude: la, longitude: lo }))}
                  strokeWidth={2}
                  strokeColor={colour}
                  fillColor={`${colour}1a`}
                  onPress={() => setSelected({ kind: 'geofence', zone: g })}
                />
              );
            }
            if (g.coordinates?.length >= 2) {
              return (
                <Polyline
                  key={g.id}
                  coordinates={g.coordinates.map(([la, lo]) => ({ latitude: la, longitude: lo }))}
                  strokeWidth={2}
                  strokeColor={colour}
                  onPress={() => setSelected({ kind: 'geofence', zone: g })}
                />
              );
            }
            return null;
          })}

        {/* The scored corridor */}
        {active.route && bundle?.route?.track?.length ? (
          <Polyline
            coordinates={bundle.route.track.map(([la, lo]) => ({ latitude: la, longitude: lo }))}
            strokeWidth={4}
            strokeColor={riskColor(bundle.route.riskLevel)}
          />
        ) : null}

        {active.route &&
          (bundle?.route?.waypoints ?? []).map((w) => (
            <Marker
              key={`${w.latitude}-${w.longitude}`}
              coordinate={{ latitude: w.latitude, longitude: w.longitude }}
              title={w.name}
              description={`${w.riskLevel} · ETA ${w.etaHours} h`}
              pinColor={riskColor(w.riskLevel)}
            />
          ))}
      </MapView>

      {/* Layer toggles */}
      <View style={styles.layerBar}>
        {LAYERS.map((l) => (
          <Chip
            key={l.id}
            label={l.label}
            active={active[l.id]}
            onPress={() => setActive((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
          />
        ))}
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        {error ? (
          <Notice tone={colors.red} title="Map data unavailable">
            {error}
          </Notice>
        ) : null}

        {loading && !bundle ? (
          <Card>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.cyan} size="small" />
              <Text style={styles.loadingText}>Plotting PFZ, hazards and boundaries…</Text>
            </View>
          </Card>
        ) : null}

        {bundle ? (
          <>
            <Card tone={riskColor(bundle.riskLevel)}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{harbour.name}</Text>
                <RiskBadge level={bundle.riskLevel} />
              </View>
              <Fact label="Basin" value={`${harbour.region} · ${harbour.basin}`} mono={false} />
              {bundle.weather ? (
                <Fact
                  label="Wind"
                  value={`${bundle.weather.windSpeedKnots} kt ${bundle.weather.windDirection} · gusts ${bundle.weather.gustKnots} kt`}
                />
              ) : null}
              {bundle.ocean ? (
                <Fact
                  label="Sea"
                  value={`${bundle.ocean.waveHeightMeters} m · Douglas ${bundle.ocean.seaStateCode} (${bundle.ocean.seaCondition})`}
                />
              ) : null}
              {bundle.safetyScore !== undefined ? (
                <Fact label="Safety score" value={`${bundle.safetyScore} / 100`} tone={riskColor(bundle.riskLevel)} />
              ) : null}
            </Card>

            {selected?.kind === 'pfz' ? (
              <Card tone={colors.emerald}>
                <SectionTitle>Fishing zone</SectionTitle>
                <Text style={styles.cardTitle}>{selected.zone.name}</Text>
                <Fact
                  label="Index"
                  value={`${selected.zone.productivityIndex}/100 · ${selected.zone.productivityClass}`}
                  tone={colors.emerald}
                />
                <Fact
                  label="Conditions"
                  value={`chl ${selected.zone.chlorophyllMgM3} mg/m³ · ${selected.zone.sstCelsius}°C`}
                />
                <Button
                  label="Ask ORCA to plan a route here"
                  onPress={() =>
                    onAsk(
                      `What is the safest route from ${harbour.shortName} to ${selected.zone.name}?`,
                    )
                  }
                />
              </Card>
            ) : null}

            {selected?.kind === 'alert' ? (
              <Card tone={advisoryColor(selected.alert.advisoryLevel)}>
                <SectionTitle
                  right={
                    <Badge
                      label={selected.alert.advisoryLevel}
                      color={advisoryColor(selected.alert.advisoryLevel)}
                    />
                  }
                >
                  Advisory
                </SectionTitle>
                <Text style={styles.cardTitle}>{selected.alert.title}</Text>
                <Fact label="Coast" value={selected.alert.affectedCoast} mono={false} />
                <Fact
                  label="Distance"
                  value={`${selected.alert.distanceKm} km ${selected.alert.bearing}`}
                />
                <Fact label="Valid until" value={selected.alert.validUntil} />
                <Text style={styles.action}>{selected.alert.action}</Text>
                <Button
                  label="Ask ORCA about this warning"
                  onPress={() => onAsk(`Tell me about the ${selected.alert.type} warning near my coast`)}
                />
              </Card>
            ) : null}

            {selected?.kind === 'geofence' ? (
              <Card tone={severityColor(selected.zone.severity)}>
                <SectionTitle
                  right={
                    <Badge label={selected.zone.severity} color={severityColor(selected.zone.severity)} />
                  }
                >
                  {typeLabel[selected.zone.type] ?? selected.zone.type}
                </SectionTitle>
                <Text style={styles.cardTitle}>{selected.zone.name}</Text>
                <Fact label="Authority" value={selected.zone.authority} mono={false} />
                <Fact label="Keep clear by" value={`${selected.zone.bufferKm} km`} />
                <Text style={styles.action}>{selected.zone.regulation}</Text>
                <Text style={styles.source}>{selected.zone.description}</Text>
                <Button
                  label="Ask which zones to avoid"
                  onPress={() => onAsk('Which zones should I avoid before going out to sea?')}
                />
              </Card>
            ) : null}

            {selected?.kind === 'route' && bundle.route ? (
              <Card tone={riskColor(bundle.route.riskLevel)}>
                <SectionTitle>Corridor · {bundle.route.safetyScore}/100</SectionTitle>
                <Fact
                  label="Distance"
                  value={`${bundle.route.totalDistanceKm} km · ${bundle.route.estimatedTimeHours}`}
                />
                <Fact label="Vessel" value={bundle.route.vesselLabel} mono={false} />
                <Text style={styles.action}>{bundle.route.recommendation}</Text>
                {bundle.route.geofenceConflicts.length > 0 ? (
                  <Text style={[styles.action, { color: colors.red }]}>
                    Conflicts: {bundle.route.geofenceConflicts.map((c) => c.boundaryName).join(', ')}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            {/* Route planner */}
            <SectionTitle>Plan a corridor to another harbour</SectionTitle>
            <View style={styles.wrapRow}>
              {(bundle?.harbours ?? [])
                .filter((h) => h.id !== harbourId)
                .map((h) => (
                  <Chip
                    key={h.id}
                    label={routeTo === h.id ? `${h.shortName}…` : h.shortName}
                    onPress={() => planRoute(h.id)}
                    disabled={routeTo !== null}
                  />
                ))}
            </View>

            {/* Legend */}
            <Card>
              <SectionTitle>Legend</SectionTitle>
              <Legend colour={colors.emerald} text="Potential fishing zone" />
              <Legend colour={colors.amber} text="Yellow advisory" />
              <Legend colour={colors.orange} text="Orange advisory" />
              <Legend colour={colors.red} text="Red advisory / critical boundary" />
              <Legend colour={colors.orange} text="Oil rig / restricted installation" />
              <Legend colour={colors.textFaint} text="Shipping lane / cable advisory" />
            </Card>

            <Text style={styles.provenance}>
              {bundle.agentTrace?.length ?? 0} agents ran for this view:{' '}
              {bundle.agentTrace?.map((a) => a.agent.replace('_AGENT', '').toLowerCase()).join(' · ')}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const Legend = ({ colour, text }) => (
  <View style={styles.legendRow}>
    <View style={[styles.legendSwatch, { backgroundColor: colour }]} />
    <Text style={styles.legendText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAction: { color: colors.cyan, fontSize: 12, fontWeight: '800' },
  headerTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  map: { flex: 1 },
  layerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  panel: { maxHeight: '46%', backgroundColor: colors.void },
  panelContent: { padding: space.md, paddingBottom: space.xxl },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.white, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  action: { color: colors.amber, fontSize: 11, lineHeight: 16, marginVertical: 4 },
  source: { color: colors.textFaint, fontSize: 9, lineHeight: 13 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.textDim, fontSize: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: colors.textDim, fontSize: 11 },
  provenance: { color: colors.textFaint, fontSize: 9, textAlign: 'center', marginTop: space.md, lineHeight: 13 },
});
