/**
 * PFZ Agent — satellite ocean-colour and SST interpretation.
 *
 * Answers two distinct questions:
 *   1. "Where is the nearest fishing ground from here?"  (FIND_PFZ)
 *   2. "Which water is most productive right now?"        (PFZ_HOTSPOTS)
 *
 * For the second it samples the regional productivity grid rather than reusing
 * the curated zone list, so the hotspot answer is derived from the same
 * chlorophyll/SST fields the index is built from and cannot drift out of sync.
 */

import { ProductivityHotspot } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok, publish } from './base';
import {
  classifyProductivity,
  computeProductivityIndex,
  getLiveHotspotsNear,
  getPfzZonesNear,
  getProductivityGrid,
} from '../core/dataAccess';
import { haversineKm, initialBearingDeg, roundTo, compassPoint } from '../core/geo';
import { productivityWord, trendWord } from '../core/i18n';

/** Minimum chlorophyll for a cell to be considered a fishing hotspot (mg/m3). */
const CHL_THRESHOLD = 1.5;
/** Tropical pelagics concentrate in this SST band (degC). */
const SST_BAND: [number, number] = [25.5, 30.5];

export const pfzAgent: AgentDefinition = defineAgent('PFZ_AGENT', (context: AgentContext) => {
  const { book } = context;
  const position = context.position;
  const findings = [];

  if (context.parsed.intent === 'PFZ_HOTSPOTS') {
    return hotspotScan(context);
  }

  /* ---- FIND_PFZ: rank the curated advisory grounds from the user's position ---- */

  const zones = getPfzZonesNear(position.latitude, position.longitude);
  context.artifacts.pfzZones = zones;
  const nearest = zones[0];
  context.artifacts.activeZone = nearest;
  context.artifacts.distanceKm = nearest?.distanceKm;

  if (!nearest) {
    return ok(
      [
        finding('No potential fishing zone falls inside the ORCA advisory envelope for this position.', {
          confidence: 0.4,
        }),
      ],
      'The PFZ advisory returned no ground within range.',
      ['INCOIS PFZ advisory'],
    );
  }

  context.memory.activeZone = nearest;
  context.memory.mentionedLocations = [
    ...new Set([...context.memory.mentionedLocations, nearest.name]),
  ].slice(-6);

  const reachFeasible = nearest.distanceKm / context.vessel.typicalRangeNm / 1.852 <= 1.4;

  findings.push(
    finding(
      `${nearest.name} is the nearest fishing ground: ${nearest.distanceKm} km on a bearing of ${nearest.bearing}. Productivity is ${productivityWord(book, nearest.productivityClass)} (index ${nearest.productivityIndex}/100) with chlorophyll ${nearest.chlorophyllMgM3} mg/m³ and SST ${nearest.sstCelsius}° C.`,
      {
        confidence: nearest.confidence,
        evidence: [
          ev(book.evidenceKeys.chlorophyll, `${nearest.chlorophyllMgM3} mg/m³`, nearest.source),
          ev(book.evidenceKeys.sst, `${nearest.sstCelsius}° C (anomaly ${nearest.sstAnomalyC > 0 ? '+' : ''}${nearest.sstAnomalyC}° C)`, nearest.source),
          ev(book.evidenceKeys.productivity, `${nearest.productivityIndex}/100 · ${productivityWord(book, nearest.productivityClass)}`, 'ORCA productivity index'),
          ev(book.evidenceKeys.bearing, nearest.bearing, 'ORCA geodesic engine'),
          ev(book.evidenceKeys.depth, `${nearest.depthMeters} m`, 'ORCA bathymetric proxy'),
        ],
        riskLevel: reachFeasible ? undefined : 'MODERATE',
      },
    ),
  );

  findings.push(
    finding(
      `Target species for this ground: ${nearest.targetFishSpecies.join(', ')}. The ${trendWord(book, nearest.historicalTrend)} trend is recorded for this zone.`,
      {
        confidence: 0.75,
        evidence: [ev(book.evidenceKeys.species, nearest.targetFishSpecies.join(', '), 'INCOIS species advisories')],
      },
    ),
  );

  findings.push(
    finding(
      `Valid ${nearest.validFrom} to ${nearest.validTill}. Advisory status: ${nearest.status}.`,
      {
        confidence: 0.9,
        evidence: [ev('Advisory window', `${nearest.validFrom} → ${nearest.validTill}`, nearest.source)],
      },
    ),
  );

  if (!reachFeasible) {
    findings.push(
      finding(
        `At ${nearest.distanceKm} km this ground sits beyond the usual operating range of a ${context.vessel.label.toLowerCase()} (${context.vessel.typicalRangeNm} NM). A nearer or more sheltered option may be the better call.`,
        {
          confidence: 0.7,
          riskLevel: 'MODERATE',
          evidence: [ev(book.evidenceKeys.vessel, context.vessel.label, 'ORCA vessel profile')],
        },
      ),
    );
    context.artifacts.riskNotes = [
      ...(context.artifacts.riskNotes ?? []),
      {
        agent: 'PFZ_AGENT',
        level: 'MODERATE',
        reason: `Nearest fishing ground is ${nearest.distanceKm} km away, beyond the vessel's typical range.`,
      },
    ];
  }

  // Map layer for the client: the nearest three grounds.
  publish(context, {
    id: 'viz-pfz-map',
    type: 'map',
    title: book.labels.ground,
    subtitle: 'Potential Fishing Zone advisory (3-day)',
    geo: {
      points: [],
      circles: zones.slice(0, 5).map((z) => ({
        id: z.id,
        label: z.name,
        latitude: z.latitude,
        longitude: z.longitude,
        radiusKm: z.radiusKm,
        color:
          z.productivityClass === 'EXCELLENT' || z.productivityClass === 'GOOD'
            ? '#22c55e'
            : z.productivityClass === 'FAIR'
              ? '#eab308'
              : '#f97316',
        level: z.status === 'favorable' ? ('favorable' as const) : ('moderate' as const),
      })),
      polygons: [],
    },
  });

  // Chlorophyll / SST comparison chart for the top grounds.
  publish(context, {
    id: 'viz-pfz-index',
    type: 'chart',
    title: book.evidenceKeys.chlorophyll,
    subtitle: 'Productivity drivers for the nearest grounds',
    categories: zones.slice(0, 5).map((z, i) => `${i + 1}. ${shortLabel(z)}`),
    series: [
      {
        id: 'chl',
        label: 'Chlorophyll (mg/m³)',
        color: '#22c55e',
        unit: 'mg/m³',
        points: zones.slice(0, 5).map((z) => z.chlorophyllMgM3),
      },
      {
        id: 'sst',
        label: 'SST (°C)',
        color: '#f97316',
        unit: '°C',
        points: zones.slice(0, 5).map((z) => z.sstCelsius),
      },
      {
        id: 'index',
        label: 'Productivity index',
        color: '#38bdf8',
        unit: 'index',
        points: zones.slice(0, 5).map((z) => z.productivityIndex),
      },
    ],
  });

  return ok(
    findings,
    book.ui.pfzSummaryWord
      .replace('{name}', nearest.name)
      .replace('{distance}', String(nearest.distanceKm))
      .replace('{bearing}', nearest.bearing)
      .replace('{productivity}', productivityWord(book, nearest.productivityClass))
      .replace('{chlorophyll}', String(nearest.chlorophyllMgM3)),
    [...new Set(zones.slice(0, 5).map((z) => z.source)), 'ORCA productivity index'],
  );
});

/* ------------------------------------------------------------------ *
 * Hotspot scan
 * ------------------------------------------------------------------ */

function hotspotScan(context: AgentContext): ReturnType<typeof ok> {
  const { book } = context;
  const center = context.position;
  const grid = getProductivityGrid(center, 180, 5);
  const livePresent = getLiveHotspotsNear(center).length > 0;

  const scored = grid
    .map((cell) => {
      const index = computeProductivityIndex(
        cell.chlorophyllMgM3,
        cell.sstCelsius,
        cell.sstAnomalyC,
      );
      const sstSuitable = cell.sstCelsius >= SST_BAND[0] && cell.sstCelsius <= SST_BAND[1];
      const chlRich = cell.chlorophyllMgM3 >= CHL_THRESHOLD;
      return { ...cell, index, sstSuitable, chlRich, distanceKm: haversineKm(center, cell) };
    })
    .filter((cell) => cell.sstSuitable && cell.chlRich)
    .sort((a, b) => b.index - a.index);

  // Collapse neighbours so the answer is a handful of grounds, not 400 cells.
  const hotspots: ProductivityHotspot[] = [];
  for (const cell of scored) {
    if (hotspots.length >= 5) break;
    const tooClose = hotspots.some(
      (h) => haversineKm(h, cell) < Math.max(20, cell.distanceKm * 0.12),
    );
    if (tooClose) continue;

    const bearingDeg = initialBearingDeg(center, cell);
    hotspots.push({
      id: `hot-${cell.latitude.toFixed(2)}-${cell.longitude.toFixed(2)}`,
      name: `${productivityWord(book, classifyProductivity(cell.index))} ground ${cell.latitude.toFixed(2)}° N ${cell.longitude.toFixed(2)}° E`,
      latitude: cell.latitude,
      longitude: cell.longitude,
      chlorophyllMgM3: cell.chlorophyllMgM3,
      sstCelsius: cell.sstCelsius,
      sstAnomalyC: cell.sstAnomalyC,
      productivityIndex: cell.index,
      productivityClass: classifyProductivity(cell.index),
      dominantSpecies: speciesFor(cell.chlorophyllMgM3, cell.sstCelsius),
      distanceKm: roundTo(cell.distanceKm, 1),
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      note:
        cell.sstAnomalyC > 0.4
          ? 'Warm-side thermal front — upwelling-influenced slope water.'
          : cell.sstAnomalyC < -0.4
            ? 'Cold-side upwelling core — the most productive water in the window.'
            : 'Weak gradient inside a broad, stable water mass.',
      source: livePresent
        ? 'Live SST/currents (Open-Meteo marine) + MODIS-Aqua regional chlorophyll climatology'
        : 'MODIS/VIIRS ocean colour + INSAT-3DR SST climatology (reference snapshot)',
    });
  }

  context.artifacts.hotspots = hotspots;

  const findings = [
    finding(
      hotspots.length > 0
        ? `${hotspots.length} chlorophyll-rich, thermally suitable patches lie within 180 km of ${context.anchor.label}. The strongest shows ${hotspots[0].chlorophyllMgM3} mg/m³ chlorophyll at ${hotspots[0].sstCelsius}° C, a productivity index of ${hotspots[0].productivityIndex}/100.`
        : `No cell within 180 km of ${context.anchor.label} combines chlorophyll above ${CHL_THRESHOLD} mg/m³ with the ${SST_BAND[0]}–${SST_BAND[1]}° C thermal band favoured by tropical pelagics.`,
      {
        confidence: hotspots.length > 0 ? 0.8 : 0.45,
        evidence: [
          ev('Chlorophyll threshold', `≥ ${CHL_THRESHOLD} mg/m³`, 'ORCA scan parameter'),
          ev('Thermal band', `${SST_BAND[0]}–${SST_BAND[1]}° C`, 'ORCA scan parameter'),
          ev('Cells evaluated', String(grid.length), 'ORCA productivity grid'),
        ],
      },
    ),
  ];

  for (const hotspot of hotspots.slice(0, 3)) {
    findings.push(
      finding(
        `${hotspot.name}: ${hotspot.distanceKm} km ${hotspot.bearing}, index ${hotspot.productivityIndex}/100. ${hotspot.note}`,
        {
          confidence: 0.72,
          evidence: [
            ev(book.evidenceKeys.chlorophyll, `${hotspot.chlorophyllMgM3} mg/m³`, hotspot.source),
            ev(book.evidenceKeys.sst, `${hotspot.sstCelsius}° C (${hotspot.sstAnomalyC > 0 ? '+' : ''}${hotspot.sstAnomalyC}° C)`, hotspot.source),
            ev(book.evidenceKeys.species, hotspot.dominantSpecies.join(', '), 'INCOIS species advisories'),
          ],
        },
      ),
    );
  }

  publish(context, {
    id: 'viz-hotspot-map',
    type: 'heatmap',
    title: book.labels.hotspots,
    subtitle: 'Chlorophyll and SST composite over a 180 km box',
    geo: {
      points: grid
        .filter((c) => c.chlorophyllMgM3 >= 0.4)
        .map((c) => [c.latitude, c.longitude] as [number, number]),
      circles: hotspots.map((h) => ({
        id: h.id,
        label: h.name,
        latitude: h.latitude,
        longitude: h.longitude,
        radiusKm: 22,
        color: h.productivityClass === 'EXCELLENT' ? '#22c55e' : '#84cc16',
        level: 'favorable' as const,
      })),
      polygons: [],
    },
  });

  publish(context, {
    id: 'viz-hotspot-chart',
    type: 'chart',
    title: 'Productivity drivers of the top patches',
    subtitle: 'Scanned from the ORCA regional grid',
    categories: hotspots.map((_h, i) => `#${i + 1}`),
    series: [
      { id: 'chl', label: 'Chlorophyll (mg/m³)', color: '#22c55e', unit: 'mg/m³', points: hotspots.map((h) => h.chlorophyllMgM3) },
      { id: 'sst', label: 'SST (°C)', color: '#f97316', unit: '°C', points: hotspots.map((h) => h.sstCelsius) },
      { id: 'idx', label: 'Productivity index', color: '#38bdf8', unit: 'index', points: hotspots.map((h) => h.productivityIndex) },
    ],
  });

  return ok(
    findings,
    hotspots.length > 0
      ? `Ranked ${hotspots.length} productive patches around ${context.anchor.label}; the best scores ${hotspots[0].productivityIndex}/100.`
      : 'No qualifying productive patch in the scanned box.',
    livePresent
      ? ['Live SST/currents (Open-Meteo marine) + MODIS-Aqua regional chlorophyll climatology', 'ORCA productivity grid']
      : ['MODIS/VIIRS ocean colour + INSAT-3DR SST climatology (reference snapshot)', 'ORCA productivity grid'],
  );
}

/** Species most associated with a given chlorophyll / thermal signature. */
function speciesFor(chlorophyllMgM3: number, sstCelsius: number): string[] {
  if (chlorophyllMgM3 >= 2.2 && sstCelsius <= 27.5) {
    return ['Oil Sardine (Tarli)', 'Horse Mackerel', 'Bombay Duck'];
  }
  if (chlorophyllMgM3 >= 1.5) {
    return ['Indian Mackerel (Bangda)', 'Ribbon Fish', 'Squid'];
  }
  return ['Croaker', 'Catfish', 'Silver Pomfret (Paplet)'];
}

/** Two-word label for chart axes, where the full zone name will not fit. */
export function shortLabel(zone: { name: string; region: string }): string {
  const words = zone.name.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) return `${words[0]} ${words[1]}`;
  return zone.region;
}
