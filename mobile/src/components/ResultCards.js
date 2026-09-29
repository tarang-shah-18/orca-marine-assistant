/**
 * Structured results.
 *
 * An answer paragraph is what a fisher reads; these cards are what they check.
 * Every number here comes straight off the `OrchestrationResult`, so nothing
 * is re-derived on the phone and the card can never disagree with the prose.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  advisoryColor,
  colors,
  riskColor,
  severityColor,
  space,
  typeLabel,
} from '../theme';
import { Card, Divider, Fact, Meter, SectionTitle } from './ui';

/* ------------------------------------------------------------------ *
 * Fishing ground
 * ------------------------------------------------------------------ */

export const PfzCard = ({ zone }) => (
  <Card tone={colors.emerald}>
    <SectionTitle>Potential fishing zone</SectionTitle>
    <Text style={styles.title}>{zone.name}</Text>
    <Fact label="Distance" value={`${zone.distanceKm} km ${zone.bearing}`} tone={colors.emerald} />
    <Fact label="Productivity" value={`${zone.productivityIndex} / 100`} tone={colors.emerald} />
    <Fact
      label="Chlorophyll-a"
      value={`${zone.chlorophyllMgM3} mg/m³ · ${zone.productivityClass.toLowerCase()} ground`}
    />
    <Fact
      label="Sea surface temp"
      value={`${zone.sstCelsius}°C · anomaly ${zone.sstAnomalyC >= 0 ? '+' : ''}${zone.sstAnomalyC}°C`}
    />
    <Fact label="Depth" value={`${zone.depthMeters} m`} />
    <Fact label="Recent trend" value={zone.historicalTrend} />
    <Fact label="Target species" value={(zone.targetFishSpecies ?? []).join(', ')} mono={false} />
    <Fact label="Valid till" value={zone.validTill} />
    <Text style={styles.sourceText}>{zone.source}</Text>
  </Card>
);

export const HotspotsCard = ({ hotspots }) => (
  <Card tone={colors.emerald}>
    <SectionTitle>Chlorophyll &amp; SST scan</SectionTitle>
    {hotspots.slice(0, 5).map((h) => (
      <View key={h.id} style={styles.hotspotRow}>
        <View style={styles.hotspotHead}>
          <Text style={styles.hotspotName}>{h.name}</Text>
          <Text style={styles.hotspotIndex}>{h.productivityIndex}</Text>
        </View>
        <View style={styles.hotspotMeta}>
          <Text style={styles.metaText}>
            {h.distanceKm} km {h.bearing} · chl {h.chlorophyllMgM3} mg/m³ · {h.sstCelsius}°C ·{' '}
            {(h.dominantSpecies ?? []).slice(0, 3).join(', ')}
          </Text>
          <Text style={styles.sourceText}>{h.note}</Text>
        </View>
        <Meter value={h.productivityIndex} max={100} color={colors.emerald} height={4} />
      </View>
    ))}
  </Card>
);

/* ------------------------------------------------------------------ *
 * Warnings
 * ------------------------------------------------------------------ */

export const AlertsCard = ({ alerts }) => (
  <Card tone={colors.amber}>
    <SectionTitle>Active marine advisories</SectionTitle>
    {alerts.map((a) => (
      <View key={a.id} style={styles.alertBlock}>
        <View style={styles.alertHead}>
          <Text style={[styles.advisoryTag, { color: advisoryColor(a.advisoryLevel) }]}>
            {a.advisoryLevel}
          </Text>
          <Text style={styles.alertName}>{a.title}</Text>
        </View>
        <Text style={styles.metaText}>
          {a.affectedCoast} · {a.distanceKm} km {a.bearing} · until {a.validUntil}
        </Text>
        <Text style={styles.actionText}>{a.action}</Text>
        <Text style={styles.sourceText}>{a.source}</Text>
      </View>
    ))}
  </Card>
);

/* ------------------------------------------------------------------ *
 * Tides
 * ------------------------------------------------------------------ */

export const TideCard = ({ report }) => (
  <Card tone={colors.sky}>
    <SectionTitle>Tide · {report.station.name}</SectionTitle>
    <Fact
      label="Now"
      value={`${report.currentLevel.toFixed(2)} m · ${report.isRising ? 'rising' : 'falling'}`}
      tone={colors.sky}
    />
    <Fact label="Range" value={`${report.maxRangeMeters.toFixed(2)} m`} />
    {report.recommendedWindow ? (
      <Fact
        label="Best window"
        value={`${report.recommendedWindow.startLabel} – ${report.recommendedWindow.endLabel} (${report.recommendedWindow.quality})`}
        tone={colors.emerald}
      />
    ) : null}
    <Divider />
    {report.events.slice(0, 6).map((e) => (
      <View key={e.time} style={styles.tideRow}>
        <View style={styles.tideGlyph}>
          <Text style={[styles.tideGlyphText, { color: e.type === 'HIGH' ? colors.orange : colors.sky }]}>
            {e.type === 'HIGH' ? '▲' : '▼'}
          </Text>
        </View>
        <View style={styles.tideBody}>
          <Text style={styles.tideLabel}>
            {e.label} · {e.type === 'HIGH' ? 'High water' : 'Low water'}
          </Text>
          <Text style={styles.metaText}>
            {e.heightMeters.toFixed(2)} m · range {e.rangeMeters.toFixed(2)} m · stream{' '}
            {e.currentKnots} kt
          </Text>
        </View>
      </View>
    ))}
    <Divider />
    {report.windows.slice(0, 3).map((w) => (
      <Fact
        key={`${w.startLabel}-${w.endLabel}`}
        label={w.quality}
        value={`${w.startLabel}–${w.endLabel} · ${w.durationHours} h`}
        tone={w.quality === 'GOOD' ? colors.emerald : w.quality === 'FAIR' ? colors.amber : colors.orange}
      />
    ))}
    <Text style={styles.sourceText}>
      {report.source} · {report.station.harmonics.length} harmonic constituents
    </Text>
  </Card>
);

/* ------------------------------------------------------------------ *
 * Geofencing
 * ------------------------------------------------------------------ */

export const GeofenceCard = ({ data }) => {
  const critical = data.violations.filter((v) => v.severity === 'CRITICAL' || v.inside);
  const nearby = data.nearbyBoundaries.filter((v) => v.distanceKm <= 25);

  return (
    <Card tone={critical.length ? colors.red : colors.amber}>
      <SectionTitle>Geofencing · regulated waters</SectionTitle>

      {critical.length === 0 && nearby.length === 0 ? (
        <Text style={styles.metaText}>
          No restricted water inside the corridor of the track you planned. Keep clear of the
          statutory buffers listed below anyway.
        </Text>
      ) : null}

      {critical.map((v) => (
        <View key={v.boundaryId} style={styles.geoBlock}>
          <View style={styles.alertHead}>
            <Text style={[styles.advisoryTag, { color: severityColor(v.severity) }]}>
              {v.inside ? 'INSIDE' : v.severity}
            </Text>
            <Text style={styles.alertName}>{v.boundaryName}</Text>
          </View>
          <Text style={styles.metaText}>
            {typeLabel[v.boundaryType] ?? v.boundaryType} · {v.distanceKm} km {v.bearing}
          </Text>
          <Text style={styles.actionText}>{v.regulation}</Text>
        </View>
      ))}

      {nearby
        .filter((v) => !critical.includes(v))
        .slice(0, 5)
        .map((v) => (
          <Fact
            key={v.boundaryId}
            label={typeLabel[v.boundaryType] ?? v.boundaryType}
            value={`${v.boundaryName} — ${v.distanceKm} km ${v.bearing}`}
            mono={false}
            tone={severityColor(v.severity)}
          />
        ))}

      {data.warnings.map((w, i) => (
        <Text key={i} style={styles.actionText}>
          • {w}
        </Text>
      ))}

      <Text style={styles.sourceText}>{data.source}</Text>
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Route
 * ------------------------------------------------------------------ */

export const RouteCard = ({ route }) => (
  <Card tone={riskColor(route.riskLevel)}>
    <SectionTitle
      right={
        <Text style={[styles.routeScore, { color: riskColor(route.riskLevel) }]}>
          {route.safetyScore}/100
        </Text>
      }
    >
      Route · {route.vesselLabel}
    </SectionTitle>

    <Fact label="From" value={route.origin.name} mono={false} />
    <Fact label="To" value={route.destination.name} mono={false} />
    <Fact
      label="Distance"
      value={`${route.totalDistanceKm} km · ${route.estimatedTimeHours} · ${route.speedKnots} kt`}
    />
    <Meter value={route.safetyScore} max={100} color={riskColor(route.riskLevel)} />

    <Divider />
    {route.segments.map((s) => (
      <View key={`${s.from}-${s.to}`} style={styles.segment}>
        <View style={styles.segmentHead}>
          <Text style={styles.segmentName}>
            {s.from} → {s.to}
          </Text>
          <Text style={[styles.segmentRisk, { color: riskColor(s.riskLevel) }]}>{s.riskLevel}</Text>
        </View>
        <Text style={styles.metaText}>
          {s.distanceKm} km · {s.bearing} · {s.estimatedHours} h · max {s.maxWaveHeightMeters} m /{' '}
          {s.maxWindKnots} kt · {s.weatherWindow}
        </Text>
        {s.reasons.slice(0, 2).map((r, i) => (
          <Text key={i} style={styles.reasonText}>
            – {r}
          </Text>
        ))}
      </View>
    ))}

    {route.geofenceConflicts.length > 0 ? (
      <>
        <Divider />
        <Text style={[styles.actionText, { color: colors.red }]}>
          Corridor conflicts:{' '}
          {route.geofenceConflicts.map((c) => c.boundaryName).join(', ')}
        </Text>
      </>
    ) : null}

    {route.alternatives.length > 0 ? (
      <>
        <Divider />
        {route.alternatives.slice(0, 2).map((alt) => (
          <Fact
            key={alt.id}
            label={`Alternative · ${alt.safetyScore}/100`}
            value={`${alt.totalDistanceKm} km · ${alt.estimatedTimeHours} · ${alt.riskLevel}`}
            tone={riskColor(alt.riskLevel)}
          />
        ))}
      </>
    ) : null}

    <Text style={styles.actionText}>{route.recommendation}</Text>
  </Card>
);

/* ------------------------------------------------------------------ *
 * Historical diagnosis
 * ------------------------------------------------------------------ */

export const HistoricalCard = ({ data }) => (
  <Card tone={colors.violet}>
    <SectionTitle>Productivity diagnosis · {data.region}</SectionTitle>
    <View style={styles.headlineRow}>
      <View>
        <Text style={styles.headlineValue}>
          {data.productivityChangePercent >= 0 ? '+' : ''}
          {data.productivityChangePercent}%
        </Text>
        <Text style={styles.headlineLabel}>{data.fishProductivityTrend}</Text>
      </View>
      <View>
        <Text style={styles.headlineValue}>{data.cpue}</Text>
        <Text style={styles.headlineLabel}>t / 1000 boat-days</Text>
      </View>
      <View>
        <Text style={styles.headlineValue}>
          {data.cpueChangePercent >= 0 ? '+' : ''}
          {data.cpueChangePercent}%
        </Text>
        <Text style={styles.headlineLabel}>CPUE change</Text>
      </View>
    </View>

    <Text style={styles.seriesLabel}>
      {data.timeRange.start} → {data.timeRange.end} · landings index
    </Text>
    <Sparkline values={data.series.map((p) => p.catchIndex)} color={colors.violet} />

    <Divider />
    <Text style={styles.subHeading}>What the correlation says</Text>
    {data.correlationAnalysis.map((line, i) => (
      <Text key={i} style={styles.bullet}>
        • {line}
      </Text>
    ))}

    <Text style={styles.subHeading}>Contributing factors</Text>
    {data.keyFactors.map((f, i) => (
      <Text key={i} style={styles.bullet}>
        • {f}
      </Text>
    ))}

    <Text style={styles.subHeading}>What to do about it</Text>
    {data.recommendations.map((r, i) => (
      <Text key={i} style={styles.bullet}>
        • {r}
      </Text>
    ))}

    <Text style={styles.sourceText}>{data.dataSources.join(' · ')}</Text>
  </Card>
);

/**
 * A 36-month landings index as bars.
 *
 * Hand-rolled rather than pulled from a charting library: the whole native
 * bundle stays small, and this is the only chart the phone needs.
 */
export const Sparkline = ({ values, color = colors.cyan }) => {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return (
    <View style={styles.sparkline}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${10 + ((v - min) / span) * 90}%`,
            backgroundColor: color,
            opacity: 0.35 + 0.65 * ((v - min) / span),
            marginRight: 1,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
};

/* ------------------------------------------------------------------ *
 * Charts & evidence
 * ------------------------------------------------------------------ */

export const ChartsCard = ({ visualizations }) => {
  const chartable = (visualizations ?? []).filter(
    (v) => (v.type === 'chart' || v.type === 'timeseries') && v.series?.length,
  );
  if (chartable.length === 0) return null;

  return (
    <Card>
      {chartable.slice(0, 2).map((viz) => (
        <View key={viz.id} style={styles.chartBlock}>
          <Text style={styles.chartTitle}>{viz.title}</Text>
          {viz.subtitle ? <Text style={styles.metaText}>{viz.subtitle}</Text> : null}

          {viz.categories.length > 0 ? (
            <View style={styles.chart}>
              {viz.categories.map((cat, i) => {
                const max = Math.max(...viz.series.flatMap((s) => s.points), 1);
                return (
                  <View key={cat} style={styles.chartColumn}>
                    <View style={styles.chartBars}>
                      {viz.series.map((s) => (
                        <View
                          key={s.id}
                          style={{
                            width: 7,
                            height: `${(s.points[i] / max) * 100}%`,
                            backgroundColor: s.color ?? colors.cyan,
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={styles.chartLabel}>{cat}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            viz.series.map((s) => <Sparkline key={s.id} values={s.points} color={s.color} />)
          )}

          <View style={styles.legend}>
            {viz.series.map((s) => (
              <View key={s.id} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: s.color ?? colors.cyan }]} />
                <Text style={styles.legendText}>
                  {s.label}
                  {s.unit ? ` (${s.unit})` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
};

export const EvidenceCard = ({ result }) => (
  <Card>
    <SectionTitle>Evidence · {result.evidence.length} items</SectionTitle>
    {result.evidence.map((item, i) => (
      <View key={`${item.label}-${i}`} style={styles.evidenceRow}>
        <Text style={styles.evidenceLabel}>{item.label}</Text>
        <Text style={styles.evidenceValue}>{item.value}</Text>
        <Text style={styles.sourceText}>{item.source}</Text>
      </View>
    ))}
    {result.sources.length > 0 ? (
      <>
        <Divider />
        <Text style={styles.subHeading}>Sources</Text>
        {result.sources.map((s) => (
          <Text key={s} style={styles.bullet}>
            • {s}
          </Text>
        ))}
      </>
    ) : null}
  </Card>
);

const styles = StyleSheet.create({
  title: { color: colors.white, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  metaText: { color: colors.textDim, fontSize: 10, lineHeight: 15 },
  sourceText: { color: colors.textFaint, fontSize: 9, marginTop: 4, lineHeight: 13 },
  actionText: { color: colors.amber, fontSize: 11, lineHeight: 16, marginTop: 3 },
  reasonText: { color: colors.textFaint, fontSize: 10, lineHeight: 14 },
  subHeading: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 2,
  },
  bullet: { color: colors.textDim, fontSize: 10, lineHeight: 16 },
  alertBlock: { marginBottom: space.sm },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  advisoryTag: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  alertName: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  geoBlock: {
    marginBottom: space.sm,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.red,
  },
  tideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  tideGlyph: { width: 12 },
  tideGlyphText: { fontSize: 12, fontWeight: '900' },
  tideBody: { flex: 1 },
  tideLabel: { color: colors.text, fontSize: 11, fontWeight: '600' },
  hotspotRow: { marginBottom: space.sm },
  hotspotHead: { flexDirection: 'row', justifyContent: 'space-between' },
  hotspotName: { color: colors.text, fontSize: 11, fontWeight: '700', flex: 1 },
  hotspotIndex: { color: colors.emerald, fontSize: 12, fontWeight: '800' },
  hotspotMeta: { marginBottom: 3 },
  routeScore: { fontSize: 13, fontWeight: '900' },
  segment: { marginBottom: 6 },
  segmentHead: { flexDirection: 'row', justifyContent: 'space-between' },
  segmentName: { color: colors.text, fontSize: 11, fontWeight: '700' },
  segmentRisk: { fontSize: 10, fontWeight: '800' },
  headlineRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  headlineValue: { color: colors.white, fontSize: 17, fontWeight: '800' },
  headlineLabel: { color: colors.textFaint, fontSize: 9 },
  seriesLabel: { color: colors.textFaint, fontSize: 9, marginBottom: 3 },
  sparkline: { flexDirection: 'row', height: 46, alignItems: 'flex-end' },
  chartBlock: { marginBottom: space.md },
  chartTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chart: { flexDirection: 'row', height: 70, alignItems: 'flex-end', marginTop: 6 },
  chartColumn: { flex: 1, alignItems: 'center' },
  chartBars: { flexDirection: 'row', height: 56, alignItems: 'flex-end', gap: 2 },
  chartLabel: { color: colors.textFaint, fontSize: 7, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 7, height: 7, borderRadius: 2 },
  legendText: { color: colors.textFaint, fontSize: 9 },
  evidenceRow: { marginBottom: 5 },
  evidenceLabel: { color: colors.textFaint, fontSize: 9 },
  evidenceValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
