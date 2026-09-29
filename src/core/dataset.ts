/**
 * ORCA marine knowledge base.
 *
 * In production these products are ingested from ISRO/INCOIS/IMD open-data
 * portals. For the hackathon prototype they are embedded as a snapshot with a
 * deterministic synthetic expander so that forecasts, tides and historical
 * series are *reproducible* (same instant -> same numbers) rather than random
 * on every render, which keeps judge demos and test assertions stable.
 */

import {
  AlertSeverity,
  AlertType,
  AdvisoryLevel,
  Basin,
  GeofenceZone,
  HarborLocation,
  MarineAlert,
  OceanData,
  OceanSlot,
  PFZZone,
  ProductivityClass,
  TideStation,
  WeatherData,
  WeatherSlot,
  HistoricalPoint,
} from '../types';
import { compassPoint, haversineKm, initialBearingDeg, roundTo, toDegrees, toRadians } from './geo';

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random expansion
 * ------------------------------------------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seeded(...parts: (string | number)[]): () => number {
  return mulberry32(hashString(parts.join('|')));
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------ *
 * Reference instant
 * ------------------------------------------------------------------ */

/**
 * The reference snapshot is aligned to the *current* instant, computed once at
 * load. Nothing user-facing is pinned to a baked-in calendar date: the cycle
 * label, PFZ validity window, forecast days and historical anchor all roll
 * with the real clock, while the geographic gazetteer and seasonal climatology
 * constants below remain the authentic published baselines they are.
 */
function istStamp(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function istShortDay(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Operations set the reference instant to now, once. `ORCA_DATA_CYCLE_PIN`
 * overrides it with a fixed instant so a reported answer is reproducible
 * against a known snapshot (`ORCA_DATA_CYCLE_PIN=2026-09-09T03:00:00Z`).
 * Guarded so the browser bundle (which has no `process`) never touches it.
 */
function pinnedReferenceNow(): number | null {
  if (typeof process === 'undefined' || !process.env?.ORCA_DATA_CYCLE_PIN) return null;
  const t = new Date(process.env.ORCA_DATA_CYCLE_PIN).getTime();
  return Number.isFinite(t) ? t : null;
}

const NOW_MS = pinnedReferenceNow() ?? Date.now();
const REFERENCE_NOW = new Date(NOW_MS);
const REFERENCE_LABEL = `${istStamp(REFERENCE_NOW)} IST`;
const PFZ_FROM = istStamp(REFERENCE_NOW);
const PFZ_TILL = istStamp(new Date(NOW_MS + 72 * 3600e3));

export const DATA_CYCLE: {
  cycle: string;
  label: string;
  timezoneLabel: string;
  pfzValidFrom: string;
  pfzValidTill: string;
  sources: string[];
} = {
  /** Model cycle the snapshot is aligned to. */
  cycle: REFERENCE_NOW.toISOString(),
  label: REFERENCE_LABEL,
  timezoneLabel: 'IST (UTC+05:30)',
  pfzValidFrom: PFZ_FROM,
  pfzValidTill: PFZ_TILL,
  sources: [
    'INCOIS Potential Fishing Zone advisory (3-day)',
    'INCOIS Ocean State Forecast (OSF) & 3D',
    'INCOIS Sea Surface Temperature (OSTPF)',
    'INCOIS Early Warning Centre (EWC)',
    'INCOIS tide gauge network (Vikram-Saraswati harmonic framework)',
    'IMD Coastal Marine Met Bulletin & Marine Warnings',
    'IMD Cyclone Warning Centre, Chennai',
    'INSAT-3D / INSAT-3DR sea surface temperature',
    'MODIS / VIIRS ocean colour chlorophyll-a',
    'ORCA maritime boundary database (derived from publicly notified limits)',
  ],
};

/* ------------------------------------------------------------------ *
 * Harbours & fishing harbours
 * ------------------------------------------------------------------ */

export const HARBORS: HarborLocation[] = [
  {
    id: 'mumbai',
    name: 'Sassoon Dock, Mumbai',
    shortName: 'Mumbai',
    state: 'Maharashtra',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 18.9168,
    longitude: 72.8258,
    tideStationId: 'tide-mumbai',
    description: 'Largest marine fish landing centre on the west coast of India.',
    aliases: ['mumbai', 'bombay', 'sassoon', 'मुंबई', 'मुम्बई', 'મુંબઈ', 'ಮುಂಬೈ', 'മുംബൈ', 'ముంబై', 'मुम्बई'],
  },
  {
    id: 'ratnagiri',
    name: 'Mirkarwada Jetty, Ratnagiri',
    shortName: 'Ratnagiri',
    state: 'Maharashtra',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 16.9944,
    longitude: 73.2842,
    tideStationId: 'tide-ratnagiri',
    description: 'Artisanal and mechanised fishing harbour on the south Konkan coast.',
    aliases: ['ratnagiri', 'ratnagari', 'mirkarwada', 'रत्नागिरी', 'रत्नागीरी', 'રાતનાગીરી', 'ರತ್ನಾಗಿರಿ', 'റാത്നാഗിരി', 'రత్నాగిరి', 'முரைக்கடல்'],
  },
  {
    id: 'goa',
    name: 'Cavelossim Fishing Jetty, Goa',
    shortName: 'Goa',
    state: 'Goa',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 15.4053,
    longitude: 73.7969,
    tideStationId: 'tide-goa',
    description: 'Traditional trawl and gillnet launch point in south Goa.',
    aliases: ['goa', 'cavelossim', 'panaji', 'goa coast', 'गोवा', 'गोंय', 'ગોવા', 'ಗೋವಾ', 'ഗോവ', 'గోవా', 'ഗോവ'],
  },
  {
    id: 'veraval',
    name: 'Veraval Fishing Port, Gir Somnath',
    shortName: 'Veraval',
    state: 'Gujarat',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 20.9077,
    longitude: 70.3678,
    tideStationId: 'tide-veraval',
    description: 'Landing hub for trawlers operating along the Saurashtra shelf.',
    aliases: ['veraval', 'veravel', 'porbandar road', 'વેરાવળ', 'વેરાવાલ', 'ವೇರಾವಳ', 'വേരാവള', 'వేరావళ'],
  },
  {
    id: 'porbandar',
    name: 'Porbandar Fishing Port, Gujarat',
    shortName: 'Porbandar',
    state: 'Gujarat',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 21.6417,
    longitude: 69.6094,
    tideStationId: 'tide-porbandar',
    description: 'Long-established trawl fleet base on the Saurashtra coast.',
    aliases: ['porbandar', 'पोरबंदर', 'પોરબંદર', 'ಪೋರಬಂದರ', 'പോർബന്ദർ', 'పోరబందర్'],
  },
  {
    id: 'malpe',
    name: 'Malpe Harbour, Udupi',
    shortName: 'Malpe',
    state: 'Karnataka',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 13.3512,
    longitude: 74.7042,
    tideStationId: 'tide-malpe',
    description: 'Deep-sea purse seine and trawl base on the Karnataka coast.',
    aliases: ['malpe', 'udupi', 'malpe harbour', 'ಮಲ್ಪೆ', 'ಉಡುಪಿ', 'मालपे', 'मल्पे', 'માલપે', 'മൽപേ'],
  },
  {
    id: 'mangaluru',
    name: 'Mangaluru Old Harbour, Karnataka',
    shortName: 'Mangaluru',
    state: 'Karnataka',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 12.9141,
    longitude: 74.856,
    tideStationId: 'tide-mangaluru',
    description: 'Major west-coast mechanised fleet harbour, historically a Palk Bay transit point.',
    aliases: ['mangaluru', 'mangalore', 'ಮಂಗಳೂರು', 'ಮಂಗಳುರು', 'मैंगलोर', 'मंगलूरु', 'મંગલોર', 'മംഗളുരു'],
  },
  {
    id: 'kochi',
    name: 'Thoppumpady Harbour, Kochi',
    shortName: 'Kochi',
    state: 'Kerala',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 9.9312,
    longitude: 76.2673,
    tideStationId: 'tide-kochi',
    description: 'Principal oceanic fishing harbour of south-western India.',
    aliases: ['kochi', 'cochin', 'koch', 'कोच्चि', 'കൊച്ചി', 'కోచి', 'કોચિ'],
  },
  {
    id: 'tuticorin',
    name: 'Tuticorin Port, Tamil Nadu',
    shortName: 'Tuticorin',
    state: 'Tamil Nadu',
    region: 'Coromandel Coast',
    basin: 'Gulf of Mannar',
    latitude: 8.7542,
    longitude: 78.1348,
    tideStationId: 'tide-tuticorin',
    description: 'Gulf of Mannar landing centre serving chareen and trawl fleets.',
    aliases: ['tuticorin', 'thoothukudi', 'thoothukudi', 'தூத்துக்குடி', 'तुतीकोरिन', 'तूतीकोरिन', 'ટુટિકોરિન', 'ತುತಿಕೋರಿನ್', 'തുത്തികോടിൻ'],
  },
  {
    id: 'chennai',
    name: 'Kasimedu Fishing Harbour, Chennai',
    shortName: 'Chennai',
    state: 'Tamil Nadu',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 13.1256,
    longitude: 80.2982,
    tideStationId: 'tide-chennai',
    description: 'Largest mechanised fishing harbour on the Coromandel coast.',
    aliases: ['chennai', 'madras', 'kasimedu', 'சென்னை', 'चेन्नई', 'ચેન્નઈ', 'ಚೆನ್ನೈ', 'ചെന്നൈ'],
  },
  {
    id: 'puducherry',
    name: 'Gandigramam Fish Landing, Puducherry',
    shortName: 'Puducherry',
    state: 'Puducherry',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 11.9417,
    longitude: 79.8303,
    tideStationId: 'tide-puducherry',
    description: 'Combined mechanised and artisanal landing centre south of Chennai.',
    aliases: ['puducherry', 'pondicherry', 'yanam', 'புதுச்சேரி', 'पुदुचेरी', 'પુદુચેરી', 'ಪುದುಚೇರಿ', 'പുതുച്ചേരി'],
  },
  {
    id: 'vizag',
    name: 'Visakhapatnam Fishing Port, Andhra Pradesh',
    shortName: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    region: 'Andhra Coast',
    basin: 'Bay of Bengal',
    latitude: 17.6985,
    longitude: 83.2981,
    tideStationId: 'tide-vizag',
    description: 'Deep-sea trawling base on the north Andhra coast.',
    aliases: ['vizag', 'visakhapatnam', 'vizag port', 'విజాగ్', 'विजाग', 'વિજાગ', 'ವಿಜಾಗ', 'വിജാഗ്'],
  },
  {
    id: 'digha',
    name: 'Digha Mohana Belta, West Bengal',
    shortName: 'Digha',
    state: 'West Bengal',
    region: 'Sundarbans Coast',
    basin: 'Bay of Bengal',
    latitude: 21.9276,
    longitude: 87.2635,
    tideStationId: 'tide-digha',
    description: 'Artisanal surf-canoe landing point at the head of the Bay of Bengal.',
    aliases: ['digha', 'mohana', 'shankarpur', 'দীঘা', 'डिघा', 'દીઘા', 'ದಿಘಾ', 'ദീഘ'],
  },
];

export const HARBOR_BY_ID: Record<string, HarborLocation> = HARBORS.reduce(
  (acc, harbor) => ({ ...acc, [harbor.id]: harbor }),
  {} as Record<string, HarborLocation>,
);

export function findNearestHarbor(latitude: number, longitude: number): HarborLocation {
  let best = HARBORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const harbor of HARBORS) {
    const d = haversineKm({ latitude, longitude }, harbor);
    if (d < bestDistance) {
      bestDistance = d;
      best = harbor;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Potential Fishing Zones (INCOIS 3-day advisory snapshot)
 * ------------------------------------------------------------------ */

interface PfzSeed {
  id: string;
  name: string;
  region: string;
  basin: Basin;
  latitude: number;
  longitude: number;
  radiusKm: number;
  depthMeters: number;
  chlorophyllMgM3: number;
  sstCelsius: number;
  sstAnomalyC: number;
  species: string[];
  trend: PFZZone['historicalTrend'];
  status: PFZZone['status'];
  confidence: number;
}

const PFZ_SEEDS: PfzSeed[] = [
  {
    id: 'pfz-mumbai-sw-front',
    name: 'South-West Mumbai Outer Front',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 18.6214,
    longitude: 72.3812,
    radiusKm: 22,
    depthMeters: 38,
    chlorophyllMgM3: 1.84,
    sstCelsius: 28.2,
    sstAnomalyC: 0.4,
    species: ['Indian Mackerel (Bangda)', 'Ribbon Fish', 'Croaker', 'Squid'],
    trend: 'stable',
    status: 'favorable',
    confidence: 0.86,
  },
  {
    id: 'pfz-mumbai-alibaug-eddy',
    name: 'Alibaug–Murud Mesoscale Eddy',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 18.4211,
    longitude: 72.6105,
    radiusKm: 18,
    depthMeters: 45,
    chlorophyllMgM3: 2.15,
    sstCelsius: 27.9,
    sstAnomalyC: 0.1,
    species: ['Oil Sardine (Tarli)', 'Kingfish (Surmai)', 'Horse Mackerel'],
    trend: 'increasing',
    status: 'favorable',
    confidence: 0.79,
  },
  {
    id: 'pfz-ratnagiri-shelf',
    name: 'Mirkarwada Deep Shelf Boundary',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 16.7821,
    longitude: 72.9512,
    radiusKm: 25,
    depthMeters: 52,
    chlorophyllMgM3: 1.95,
    sstCelsius: 28.0,
    sstAnomalyC: 0.2,
    species: ['Silver Pomfret (Paplet)', 'Mackerel', 'Seer Fish'],
    trend: 'stable',
    status: 'favorable',
    confidence: 0.82,
  },
  {
    id: 'pfz-goa-shelf',
    name: 'Cavelossim Shelf Bloom Patch',
    region: 'Konkan',
    basin: 'Arabian Sea',
    latitude: 15.1621,
    longitude: 73.6412,
    radiusKm: 20,
    depthMeters: 34,
    chlorophyllMgM3: 2.62,
    sstCelsius: 27.4,
    sstAnomalyC: -0.3,
    species: ['Sardine', 'Mackerel', 'Prawns'],
    trend: 'increasing',
    status: 'favorable',
    confidence: 0.74,
  },
  {
    id: 'pfz-veraval-deep',
    name: 'Saurashtra Deep Current Convergence',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 20.5512,
    longitude: 69.8812,
    radiusKm: 26,
    depthMeters: 44,
    chlorophyllMgM3: 1.68,
    sstCelsius: 27.6,
    sstAnomalyC: -0.2,
    species: ['Ribbon Fish', 'Croaker', 'Cuttlefish', 'Silver Pomfret'],
    trend: 'stable',
    status: 'favorable',
    confidence: 0.81,
  },
  {
    id: 'pfz-porbandar-upwelling',
    name: 'Porbandar Coastal Upwelling Filament',
    region: 'Saurashtra',
    basin: 'Arabian Sea',
    latitude: 21.3117,
    longitude: 69.2118,
    radiusKm: 21,
    depthMeters: 30,
    chlorophyllMgM3: 3.42,
    sstCelsius: 25.8,
    sstAnomalyC: -1.9,
    species: ['Bombay Duck (Surmai)', 'Ribbon Fish', 'Prawns'],
    trend: 'increasing',
    status: 'favorable',
    confidence: 0.88,
  },
  {
    id: 'pfz-malpe-bank',
    name: 'Malpe Bank Thermocline Front',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 13.1612,
    longitude: 74.5218,
    radiusKm: 24,
    depthMeters: 48,
    chlorophyllMgM3: 1.54,
    sstCelsius: 27.1,
    sstAnomalyC: -0.5,
    species: ['Horse Mackerel', 'Sardine', 'Squid'],
    trend: 'decreasing',
    status: 'moderate',
    confidence: 0.71,
  },
  {
    id: 'pfz-wadge-bank',
    name: 'Wadge Bank Northern Spur',
    region: 'Malabar Coast',
    basin: 'Arabian Sea',
    latitude: 9.5821,
    longitude: 75.7912,
    radiusKm: 28,
    depthMeters: 60,
    chlorophyllMgM3: 2.4,
    sstCelsius: 28.4,
    sstAnomalyC: 0.6,
    species: ['Yellowfin Tuna', 'Oil Sardine', 'Anchovies'],
    trend: 'increasing',
    status: 'favorable',
    confidence: 0.83,
  },
  {
    id: 'pfz-tuticorin-bank',
    name: 'Gulf of Mannar Reef Edge Aggregation',
    region: 'Coromandel Coast',
    basin: 'Gulf of Mannar',
    latitude: 8.9212,
    longitude: 78.112,
    radiusKm: 19,
    depthMeters: 22,
    chlorophyllMgM3: 2.88,
    sstCelsius: 29.2,
    sstAnomalyC: 1.1,
    species: ['Chareen Threadfin Bream', 'Lobster (Spiny)', 'Squid'],
    trend: 'stable',
    status: 'favorable',
    confidence: 0.77,
  },
  {
    id: 'pfz-chennai-front',
    name: 'Pulicat–Ennore Thermal Gradient Front',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 13.4102,
    longitude: 80.5214,
    radiusKm: 20,
    depthMeters: 32,
    chlorophyllMgM3: 1.72,
    sstCelsius: 29.1,
    sstAnomalyC: 0.8,
    species: ['Carangids', 'Threadfin Bream', 'Prawns'],
    trend: 'stable',
    status: 'favorable',
    confidence: 0.8,
  },
  {
    id: 'pfz-puducherry-shelf',
    name: 'Kalparu Shelf Mixing Zone',
    region: 'Coromandel Coast',
    basin: 'Bay of Bengal',
    latitude: 12.0412,
    longitude: 79.9518,
    radiusKm: 23,
    depthMeters: 36,
    chlorophyllMgM3: 1.41,
    sstCelsius: 28.6,
    sstAnomalyC: 0.3,
    species: ['Carangids', 'Squid', 'Croaker'],
    trend: 'decreasing',
    status: 'moderate',
    confidence: 0.69,
  },
  {
    id: 'pfz-vizag-shelf',
    name: 'Visakhapatnam Continental Shelf Edge',
    region: 'Andhra Coast',
    basin: 'Bay of Bengal',
    latitude: 17.3812,
    longitude: 83.4912,
    radiusKm: 27,
    depthMeters: 58,
    chlorophyllMgM3: 1.33,
    sstCelsius: 28.9,
    sstAnomalyC: 0.5,
    species: ['Ribbon Fish', 'Prawns', 'Croaker'],
    trend: 'stable',
    status: 'moderate',
    confidence: 0.72,
  },
  {
    id: 'pfz-digha-sundarban',
    name: 'Sundarbans Estuarine Front',
    region: 'Sundarbans Coast',
    basin: 'Bay of Bengal',
    latitude: 21.4412,
    longitude: 89.0212,
    radiusKm: 24,
    depthMeters: 18,
    chlorophyllMgM3: 3.96,
    sstCelsius: 28.4,
    sstAnomalyC: 0.9,
    species: ['Tiger Prawn', 'Mud Crab', 'Belt Fish'],
    trend: 'decreasing',
    status: 'moderate',
    confidence: 0.64,
  },
  {
    id: 'pfz-hippodromium-null',
    name: 'Open Ocean Low-Productivity Reference Cell',
    region: 'Arabian Sea',
    basin: 'Arabian Sea',
    latitude: 17.9,
    longitude: 71.1,
    radiusKm: 40,
    depthMeters: 3200,
    chlorophyllMgM3: 0.12,
    sstCelsius: 28.8,
    sstAnomalyC: 0.1,
    species: ['Skipjack Tuna', 'Flying Fish'],
    trend: 'stable',
    status: 'unfavorable',
    confidence: 0.7,
  },
];

/**
 * Composite Potential Fishing Zone productivity index.
 *
 * Blends chlorophyll biomass (primary proxy for productivity), SST suitability
 * for tropical pelagics, and thermal-front strength. Weights follow the
 * relative contribution used in published tropical fisheries habitat indices.
 */
export function computeProductivityIndex(
  chlorophyllMgM3: number,
  sstCelsius: number,
  sstAnomalyC: number,
): number {
  // Chlorophyll: 0 mg/m3 -> 0, 4 mg/m3 -> 100, saturating.
  const chl = clamp((chlorophyllMgM3 / 4) * 100, 0, 100);

  // SST: tropical pelagics peak between 26 and 29.5 degC, collapsing outside 22-32.
  const sstScore =
    sstCelsius >= 22 && sstCelsius <= 32
      ? 100 - Math.abs(sstCelsius - 27.8) * 11
      : 0;

  // Front strength: |anomaly| near 0 means a weak, featureless water column.
  const front = clamp(100 - Math.abs(sstAnomalyC) * 45, 0, 100);

  const index = chl * 0.5 + clamp(sstScore, 0, 100) * 0.3 + front * 0.2;
  return Math.round(clamp(index, 0, 100));
}

export function classifyProductivity(index: number): ProductivityClass {
  if (index >= 72) return 'EXCELLENT';
  if (index >= 55) return 'GOOD';
  if (index >= 38) return 'FAIR';
  return 'POOR';
}

function buildPfz(seed: PfzSeed): Omit<PFZZone, 'distanceKm' | 'bearing'> {
  const productivityIndex = computeProductivityIndex(
    seed.chlorophyllMgM3,
    seed.sstCelsius,
    seed.sstAnomalyC,
  );

  return {
    id: seed.id,
    name: seed.name,
    region: seed.region,
    basin: seed.basin,
    latitude: seed.latitude,
    longitude: seed.longitude,
    radiusKm: seed.radiusKm,
    depthMeters: seed.depthMeters,
    chlorophyllMgM3: seed.chlorophyllMgM3,
    sstAnomalyC: seed.sstAnomalyC,
    sstCelsius: seed.sstCelsius,
    targetFishSpecies: seed.species,
    historicalTrend: seed.trend,
    status: seed.status,
    confidence: seed.confidence,
    productivityIndex,
    productivityClass: classifyProductivity(productivityIndex),
    observedAt: DATA_CYCLE.cycle,
    validFrom: DATA_CYCLE.pfzValidFrom,
    validTill: DATA_CYCLE.pfzValidTill,
    source: 'INCOIS PFZ advisory derived from MODIS/VIIRS ocean colour + INSAT-3DR SST',
    evidenceAgent: 'PFZ_AGENT',
  };
}

export const PFZ_ZONES: Omit<PFZZone, 'distanceKm' | 'bearing'>[] = PFZ_SEEDS.map(buildPfz);

/** Nearest fishing ground to a position, with distance and bearing filled in. */
export function getPfzZonesNear(latitude: number, longitude: number): PFZZone[] {
  return PFZ_ZONES.map((zone) => {
    const distanceKm = roundTo(haversineKm({ latitude, longitude }, zone), 1);
    const bearingDeg = initialBearingDeg({ latitude, longitude }, zone);
    return {
      ...zone,
      distanceKm,
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getNearestPfz(latitude: number, longitude: number): PFZZone {
  return getPfzZonesNear(latitude, longitude)[0];
}

/* ------------------------------------------------------------------ *
 * Marine weather (IMD coastal met)
 * ------------------------------------------------------------------ */

const FORECAST_DAYS_N = 4;
const { dates: FORECAST_DAYS, labels: DAY_LABELS } = (() => {
  const dates: string[] = [];
  const labels: string[] = [];
  const base = new Date();
  for (let i = 0; i < FORECAST_DAYS_N; i++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    dates.push(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
        day.getDate(),
      ).padStart(2, '0')}`,
    );
    labels.push(istShortDay(day));
  }
  return { dates, labels };
})();
const PERIODS: WeatherSlot['period'][] = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
const PERIOD_OFFSETS: Record<WeatherSlot['period'], number> = {
  MORNING: 6,
  AFTERNOON: 12,
  EVENING: 18,
  NIGHT: 24,
};
const PERIOD_LABELS: Record<WeatherSlot['period'], string> = {
  MORNING: '06:00',
  AFTERNOON: '12:00',
  EVENING: '18:00',
  NIGHT: '00:00',
};

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const CONDITIONS_BY_WIND: { max: number; text: string }[] = [
  { max: 8, text: 'Calm to light airs, clear horizon' },
  { max: 16, text: 'Gentle breeze, partly cloudy' },
  { max: 24, text: 'Moderate breeze, scattered cloud' },
  { max: 33, text: 'Fresh breeze with squally patches offshore' },
  { max: 47, text: 'Strong breeze, rough sea near squall lines' },
  { max: Infinity, text: 'Gale force winds, very rough sea' },
];

function describeWind(windKnots: number): string {
  return CONDITIONS_BY_WIND.find((c) => windKnots < c.max)?.text ?? 'Gale force winds';
}

interface WeatherSeed {
  temperatureCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  gustKnots: number;
  visibilityKm: number;
  rainProbability: number;
  windTrend: number;
  swell: number;
}

const WEATHER_SEEDS: Record<string, WeatherSeed> = {
  mumbai: { temperatureCelsius: 29, windSpeedKnots: 14, windDirectionDeg: 292, gustKnots: 19, visibilityKm: 7.5, rainProbability: 25, windTrend: 0.18, swell: 1.6 },
  ratnagiri: { temperatureCelsius: 28, windSpeedKnots: 12, windDirectionDeg: 280, gustKnots: 16, visibilityKm: 8, rainProbability: 20, windTrend: 0.12, swell: 1.4 },
  goa: { temperatureCelsius: 28, windSpeedKnots: 15, windDirectionDeg: 268, gustKnots: 21, visibilityKm: 8.5, rainProbability: 35, windTrend: 0.22, swell: 1.7 },
  veraval: { temperatureCelsius: 30, windSpeedKnots: 21, windDirectionDeg: 250, gustKnots: 29, visibilityKm: 6, rainProbability: 30, windTrend: 0.28, swell: 2.4 },
  porbandar: { temperatureCelsius: 31, windSpeedKnots: 23, windDirectionDeg: 245, gustKnots: 32, visibilityKm: 5.5, rainProbability: 28, windTrend: 0.3, swell: 2.6 },
  malpe: { temperatureCelsius: 28, windSpeedKnots: 13, windDirectionDeg: 275, gustKnots: 18, visibilityKm: 9, rainProbability: 30, windTrend: 0.15, swell: 1.5 },
  mangaluru: { temperatureCelsius: 27, windSpeedKnots: 14, windDirectionDeg: 272, gustKnots: 19, visibilityKm: 8, rainProbability: 40, windTrend: 0.17, swell: 1.6 },
  kochi: { temperatureCelsius: 27, windSpeedKnots: 18, windDirectionDeg: 255, gustKnots: 24, visibilityKm: 6, rainProbability: 60, windTrend: 0.25, swell: 2.3 },
  tuticorin: { temperatureCelsius: 30, windSpeedKnots: 17, windDirectionDeg: 262, gustKnots: 23, visibilityKm: 7, rainProbability: 35, windTrend: 0.2, swell: 2.0 },
  chennai: { temperatureCelsius: 30, windSpeedKnots: 16, windDirectionDeg: 258, gustKnots: 22, visibilityKm: 6.5, rainProbability: 45, windTrend: 0.19, swell: 1.9 },
  puducherry: { temperatureCelsius: 30, windSpeedKnots: 17, windDirectionDeg: 256, gustKnots: 23, visibilityKm: 6.5, rainProbability: 50, windTrend: 0.21, swell: 2.0 },
  vizag: { temperatureCelsius: 29, windSpeedKnots: 16, windDirectionDeg: 148, gustKnots: 22, visibilityKm: 7, rainProbability: 55, windTrend: 0.2, swell: 1.9 },
  digha: { temperatureCelsius: 28, windSpeedKnots: 15, windDirectionDeg: 158, gustKnots: 20, visibilityKm: 5, rainProbability: 65, windTrend: 0.18, swell: 1.7 },
};

function lightningRiskFor(rainProbability: number, windKnots: number): WeatherSlot['lightningRisk'] {
  if (rainProbability >= 60 || windKnots >= 22) return 'HIGH';
  if (rainProbability >= 40 || windKnots >= 16) return 'MODERATE';
  return 'LOW';
}

function buildWeather(harbor: HarborLocation): WeatherData {
  const seed = WEATHER_SEEDS[harbor.id] ?? WEATHER_SEEDS.mumbai;

  const forecast: WeatherSlot[] = [];
  FORECAST_DAYS.forEach((date, dayIndex) => {
    PERIODS.forEach((period) => {
      const rand = seeded(harbor.id, date, period);
      const dayFactor = 1 + seed.windTrend * (dayIndex - 0.5) * 0.6;
      const periodFactor =
        period === 'AFTERNOON' ? 1.18 : period === 'EVENING' ? 1.08 : period === 'NIGHT' ? 0.9 : 1;

      const windSpeedKnots = Math.round(seed.windSpeedKnots * dayFactor * periodFactor + rand() * 2.5);
      const gustKnots = Math.round(windSpeedKnots * (1.3 + rand() * 0.25));
      const temperatureCelsius = roundTo(
        seed.temperatureCelsius - (period === 'NIGHT' ? 1.8 : 0) + (dayIndex - 0.5) * 0.2 + (rand() - 0.5) * 0.6,
        1,
      );
      const rainProbability = Math.round(
        clamp(seed.rainProbability + (dayIndex - 0.5) * 6 + (rand() - 0.5) * 14, 0, 100),
      );
      const windDirectionDeg = Math.round(
        (seed.windDirectionDeg + (rand() - 0.5) * 20 + 360) % 360,
      );

      forecast.push({
        date,
        label: `${DAY_LABELS[dayIndex]} · ${PERIOD_LABELS[period]}`,
        validHours: dayIndex * 24 + PERIOD_OFFSETS[period] - 6,
        period,
        temperatureCelsius,
        windSpeedKnots,
        windSpeedKmph: Math.round(windSpeedKnots * 1.852),
        windDirection: COMPASS_16[Math.round(windDirectionDeg / 22.5) % 16],
        windDirectionDeg,
        gustKnots,
        visibilityKm: roundTo(clamp(seed.visibilityKm - rainProbability * 0.05 + (rand() - 0.5) * 1.2, 0.5, 12), 1),
        rainProbability,
        lightningRisk: lightningRiskFor(rainProbability, windSpeedKnots),
        condition: describeWind(windSpeedKnots),
      });
    });
  });

  return {
    locationId: harbor.id,
    locationName: harbor.shortName,
    temperatureCelsius: seed.temperatureCelsius,
    windSpeedKnots: seed.windSpeedKnots,
    windSpeedKmph: Math.round(seed.windSpeedKnots * 1.852),
    windDirection: COMPASS_16[Math.round(seed.windDirectionDeg / 22.5) % 16],
    windDirectionDeg: seed.windDirectionDeg,
    gustKnots: seed.gustKnots,
    visibilityKm: seed.visibilityKm,
    rainProbability: seed.rainProbability,
    lightningRisk: lightningRiskFor(seed.rainProbability, seed.windSpeedKnots),
    condition: describeWind(seed.windSpeedKnots),
    squallWarning: seed.gustKnots >= 28,
    source: 'IMD Coastal Marine Met Bulletin + IMD Marine Warnings',
    timestamp: DATA_CYCLE.label,
    forecast,
  };
}

const WEATHER_CACHE: Record<string, WeatherData> = {};
const OCEAN_CACHE: Record<string, OceanData> = {};

export function getWeather(harborId: string): WeatherData {
  if (!WEATHER_CACHE[harborId]) {
    WEATHER_CACHE[harborId] = buildWeather(HARBOR_BY_ID[harborId] ?? HARBORS[0]);
  }
  return WEATHER_CACHE[harborId];
}

export function getWeatherNear(latitude: number, longitude: number): WeatherData {
  return getWeather(findNearestHarbor(latitude, longitude).id);
}

/* ------------------------------------------------------------------ *
 * Ocean state (INCOIS OSF)
 * ------------------------------------------------------------------ */

function seaStateFor(waveHeightMeters: number): { code: number; text: string } {
  if (waveHeightMeters < 0.1) return { code: 0, text: 'Calm (glassy)' };
  if (waveHeightMeters < 0.5) return { code: 1, text: 'Rippled' };
  if (waveHeightMeters < 1.25) return { code: 2, text: 'Smooth' };
  if (waveHeightMeters < 2.5) return { code: 3, text: 'Slight sea' };
  if (waveHeightMeters < 4) return { code: 4, text: 'Moderate sea' };
  if (waveHeightMeters < 6) return { code: 5, text: 'Rough sea' };
  if (waveHeightMeters < 9) return { code: 6, text: 'Very rough sea' };
  if (waveHeightMeters < 14) return { code: 7, text: 'High sea' };
  return { code: 8, text: 'Very high sea' };
}

export function describeSeaState(waveHeightMeters: number): { code: number; text: string } {
  return seaStateFor(waveHeightMeters);
}

function buildOcean(harbor: HarborLocation): OceanData {
  const weatherSeed = WEATHER_SEEDS[harbor.id] ?? WEATHER_SEEDS.mumbai;
  const baseWave = weatherSeed.swell;
  const sstBase = PFZ_SEEDS.find((p) => p.region === harbor.region)?.sstCelsius ?? 28.3;

  const forecast: OceanSlot[] = [];
  FORECAST_DAYS.forEach((date, dayIndex) => {
    PERIODS.forEach((period) => {
      const rand = seeded('ocean', harbor.id, date, period);
      const periodFactor =
        period === 'AFTERNOON' ? 1.12 : period === 'EVENING' ? 1.06 : period === 'NIGHT' ? 0.88 : 1;
      const waveHeightMeters =
        roundTo(clamp(baseWave * (1 + 0.14 * dayIndex) * periodFactor + (rand() - 0.5) * 0.4, 0.2, 6.5), 1);
      const swellDirectionDeg = Math.round(
        (weatherSeed.windDirectionDeg + 8 + (rand() - 0.5) * 16 + 360) % 360,
      );
      const seaState = seaStateFor(waveHeightMeters);

      forecast.push({
        date,
        label: `${DAY_LABELS[dayIndex]} · ${PERIOD_LABELS[period]}`,
        validHours: dayIndex * 24 + PERIOD_OFFSETS[period] - 6,
        period,
        waveHeightMeters,
        wavePeriodSeconds: roundTo(clamp(5.5 + waveHeightMeters * 1.6 + rand() * 2, 4, 16), 1),
        swellDirection: COMPASS_16[Math.round(swellDirectionDeg / 22.5) % 16],
        swellDirectionDeg,
        seaSurfaceTempCelsius: roundTo(sstBase + (rand() - 0.5) * 0.6 - dayIndex * 0.05, 1),
        currentKnots: roundTo(clamp(0.4 + waveHeightMeters * 0.42 + rand() * 0.4, 0.2, 3.2), 1),
        currentDirection: COMPASS_16[Math.round(swellDirectionDeg / 22.5) % 16],
        seaStateCode: seaState.code,
        seaCondition: seaState.text,
      });
    });
  });

  const currentState = seaStateFor(baseWave);

  return {
    locationId: harbor.id,
    locationName: harbor.shortName,
    waveHeightMeters: baseWave,
    wavePeriodSeconds: roundTo(clamp(5.5 + baseWave * 1.6, 4, 16), 1),
    swellDirection: COMPASS_16[Math.round((weatherSeed.windDirectionDeg + 8) / 22.5) % 16],
    swellDirectionDeg: Math.round((weatherSeed.windDirectionDeg + 8) % 360),
    seaSurfaceTempCelsius: sstBase,
    sstAnomalyC: 0.2,
    currentKnots: roundTo(clamp(0.4 + baseWave * 0.42, 0.2, 3.2), 1),
    currentDirection: COMPASS_16[Math.round((weatherSeed.windDirectionDeg + 8) / 22.5) % 16],
    seaStateCode: currentState.code,
    seaCondition: currentState.text,
    source: 'INCOIS Ocean State Forecast (OSF) & OSF-3D + wave rider buoy',
    timestamp: DATA_CYCLE.label,
    forecast,
  };
}

export function getOceanState(harborId: string): OceanData {
  if (!OCEAN_CACHE[harborId]) {
    OCEAN_CACHE[harborId] = buildOcean(HARBOR_BY_ID[harborId] ?? HARBORS[0]);
  }
  return OCEAN_CACHE[harborId];
}

export function getOceanNear(latitude: number, longitude: number): OceanData {
  return getOceanState(findNearestHarbor(latitude, longitude).id);
}

/**
 * Sea state at an arbitrary offshore point. ORCA blends the harbour observation
 * with a monsoon/cyclone swell-amplification factor based on distance offshore,
 * because wave height grows with fetch even when the harbour is calm.
 */
export function getOceanAt(
  latitude: number,
  longitude: number,
  harborId?: string,
): OceanData {
  const harbor = HARBOR_BY_ID[harborId ?? findNearestHarbor(latitude, longitude).id];
  const base = getOceanState(harbor.id);
  const offshoreKm = haversineKm(harbor, { latitude, longitude });
  const amplification = clamp(1 + (offshoreKm / 100) * 0.35, 1, 1.9);

  return {
    ...base,
    waveHeightMeters: roundTo(clamp(base.waveHeightMeters * amplification, 0.1, 8), 1),
    seaStateCode: seaStateFor(base.waveHeightMeters * amplification).code,
    seaCondition: seaStateFor(base.waveHeightMeters * amplification).text,
  };
}

/* ------------------------------------------------------------------ *
 * Tide stations (harmonic constituents, INCOIS gauge network)
 * ------------------------------------------------------------------ */

const M2 = 28.9841042;
const S2 = 30.0;
const N2 = 28.4397295;
const K1 = 15.0410686;
const O1 = 13.9430356;
const P1 = 14.9589314;
const M4 = 57.9682084;

const STANDARD_CONSTITUENTS: TideStation['harmonics'] = [
  { name: 'M2', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: M2, description: 'Principal lunar semidiurnal' },
  { name: 'S2', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: S2, description: 'Principal solar semidiurnal' },
  { name: 'N2', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: N2, description: 'Larger lunar elliptic semidiurnal' },
  { name: 'K1', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: K1, description: 'Lunisolar diurnal' },
  { name: 'O1', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: O1, description: 'Principal lunar diurnal' },
  { name: 'P1', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: P1, description: 'Principal solar diurnal' },
  { name: 'M4', amplitudeMeters: 0, phaseDegrees: 0, speedDegreesPerHour: M4, description: 'Shallow-water semidiurnal overtide' },
];

const TIDE_SEEDS: Record<string, { m2: number; s2: number; n2: number; k1: number; o1: number; p1: number; m4: number; datum: number; range: number }> = {
  'tide-mumbai': { m2: 2.61, s2: 0.92, n2: 0.46, k1: 0.71, o1: 0.38, p1: 0.33, m4: 0.18, datum: 3.05, range: 3.8 },
  'tide-ratnagiri': { m2: 1.92, s2: 0.68, n2: 0.34, k1: 0.58, o1: 0.29, p1: 0.27, m4: 0.12, datum: 2.1, range: 2.9 },
  'tide-goa': { m2: 1.34, s2: 0.51, n2: 0.24, k1: 0.62, o1: 0.34, p1: 0.3, m4: 0.09, datum: 1.7, range: 2.2 },
  'tide-veraval': { m2: 2.24, s2: 0.79, n2: 0.39, k1: 0.66, o1: 0.36, p1: 0.31, m4: 0.15, datum: 2.6, range: 3.3 },
  'tide-porbandar': { m2: 2.08, s2: 0.74, n2: 0.36, k1: 0.63, o1: 0.35, p1: 0.3, m4: 0.14, datum: 2.4, range: 3.1 },
  'tide-malpe': { m2: 1.05, s2: 0.42, n2: 0.19, k1: 0.48, o1: 0.26, p1: 0.24, m4: 0.06, datum: 1.2, range: 1.7 },
  'tide-mangaluru': { m2: 1.16, s2: 0.46, n2: 0.21, k1: 0.5, o1: 0.27, p1: 0.25, m4: 0.07, datum: 1.35, range: 1.85 },
  'tide-kochi': { m2: 0.86, s2: 0.34, n2: 0.16, k1: 0.44, o1: 0.24, p1: 0.22, m4: 0.05, datum: 1.05, range: 1.45 },
  'tide-tuticorin': { m2: 0.74, s2: 0.29, n2: 0.13, k1: 0.4, o1: 0.22, p1: 0.2, m4: 0.04, datum: 0.9, range: 1.25 },
  'tide-chennai': { m2: 0.81, s2: 0.31, n2: 0.15, k1: 0.43, o1: 0.23, p1: 0.21, m4: 0.05, datum: 1.0, range: 1.35 },
  'tide-puducherry': { m2: 0.83, s2: 0.32, n2: 0.15, k1: 0.44, o1: 0.23, p1: 0.21, m4: 0.05, datum: 1.02, range: 1.38 },
  'tide-vizag': { m2: 0.94, s2: 0.36, n2: 0.17, k1: 0.46, o1: 0.25, p1: 0.22, m4: 0.05, datum: 1.15, range: 1.55 },
  'tide-digha': { m2: 1.86, s2: 0.66, n2: 0.33, k1: 0.6, o1: 0.33, p1: 0.29, m4: 0.13, datum: 2.2, range: 2.8 },
};

function buildTideStation(harbor: HarborLocation): TideStation {
  const seed = TIDE_SEEDS[harbor.tideStationId] ?? TIDE_SEEDS['tide-mumbai'];
  return {
    id: harbor.tideStationId,
    name: `${harbor.shortName} tide gauge`,
    harborId: harbor.id,
    latitude: harbor.latitude,
    longitude: harbor.longitude,
    datumOffsetMeters: seed.datum,
    harmonics: STANDARD_CONSTITUENTS.map((c) => {
      const key = c.name.toLowerCase() as 'm2' | 's2' | 'n2' | 'k1' | 'o1' | 'p1' | 'm4';
      // Phase seeded from the station so diurnal/semidiurnal interference
      // differs between ports, as it does in the real record.
      const phaseRand = seeded('tide', harbor.tideStationId, c.name);
      return {
        ...c,
        amplitudeMeters: seed[key],
        phaseDegrees: Math.round(phaseRand() * 360),
      };
    }),
    source: 'INCOIS tide gauge network, harmonic analysis (Vikram & Saraswati framework)',
  };
}

export const TIDE_STATIONS: Record<string, TideStation> = HARBORS.reduce(
  (acc, harbor) => ({ ...acc, [harbor.tideStationId]: buildTideStation(harbor) }),
  {} as Record<string, TideStation>,
);

export function getTideStation(harborId: string): TideStation {
  const harbor = HARBOR_BY_ID[harborId] ?? HARBORS[0];
  return TIDE_STATIONS[harbor.tideStationId];
}

/* ------------------------------------------------------------------ *
 * Marine alerts (IMD + INCOIS)
 * ------------------------------------------------------------------ */

interface AlertSeed {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedCoast: string;
  advisoryLevel: AdvisoryLevel;
  center: [number, number];
  radiusKm: number;
  action: string;
  validUntilHours: number;
  source: string;
}

const ALERT_SEEDS: AlertSeed[] = [
  {
    id: 'alert-north-maharashtra-squall',
    type: 'SQUALL',
    severity: 'WATCH',
    title: 'Squally weather with gusty winds over north Maharashtra & Gulf of Khambhat',
    description:
      'Squally weather with wind speeds reaching 40-45 kmph gusting to 55 kmph likely over parts of north Maharashtra and adjoining south Gujarat coast, accompanied by heavy rain, reduced visibility and rough sea.',
    affectedCoast: 'North Maharashtra & Gulf of Khambhat',
    advisoryLevel: 'YELLOW',
    center: [20.9, 72.6],
    radiusKm: 150,
    action:
      'Small craft should keep well clear of the coast and return to harbour before the squall window. Carry rain and wind protection on powered craft.',
    validUntilHours: 28,
    source: 'IMD Marine Weather Warning + INCOIS Early Warning Centre joint advisory',
  },
  {
    id: 'alert-kerala-high-wave',
    type: 'HIGH_WAVE',
    severity: 'ALERT',
    title: 'High wave warning for the Kerala coast',
    description:
      'High waves of 2.2 to 2.8 m are forecast along the coast of Kerala from Vizhinjam to Kasaragod, with very high seas of 3.5 m likely during 09-18 Sep. Small country crafts are advised not to anchor close to the shore.',
    affectedCoast: 'Kerala & Lakshadweep Sea',
    advisoryLevel: 'ORANGE',
    center: [10.9, 75.6],
    radiusKm: 190,
    action:
      'Defer sailing until the wave period subsides. Mechanised craft above 10 m may transit with caution; country boats should remain ashore.',
    validUntilHours: 36,
    source: 'INCOIS Early Warning Centre, Hyderabad',
  },
  {
    id: 'alert-mumbai-lightning',
    type: 'LIGHTNING',
    severity: 'WATCH',
    title: 'Lightning and thunderstorm activity over the Konkan coast',
    description:
      'Scattered thunderstorms with lightning and gusty winds of 40-50 kmph are likely over the Konkan coast and adjoining Arabian Sea during the next 24 hours, particularly during the afternoon and evening hours.',
    affectedCoast: 'Konkan coast and adjoining Arabian Sea',
    advisoryLevel: 'YELLOW',
    center: [18.4, 72.9],
    radiusKm: 130,
    action:
      'Suspend fishing activity during thunder. Never shelter under the hull or a raised bow. Ground the outboard and wait out the storm in a safe location.',
    validUntilHours: 22,
    source: 'IMD Marine nowcast + lightning detection network',
  },
  {
    id: 'alert-bay-cyclone-watch',
    type: 'CYCLONE',
    severity: 'WATCH',
    title: 'Cyclone watch for the north Bay of Bengal',
    description:
      'A depression over the west-central Bay of Bengal is likely to intensify into a cyclonic storm and move towards the north Bay of Bengal coast. Wind speeds of 45-55 kmph gusting to 65 kmph are likely along the Odisha and West Bengal coast from 11 Sep.',
    affectedCoast: 'Odisha & West Bengal coast',
    advisoryLevel: 'ORANGE',
    center: [18.6, 87.4],
    radiusKm: 240,
    action:
      'Vessels should avoid the warned sea area entirely, secure gear ashore and follow port master instructions. Re-check the advisory before every sailing.',
    validUntilHours: 60,
    source: 'IMD Cyclone Warning Centre, Chennai',
  },
  {
    id: 'alert-saurashtra-storm-surge',
    type: 'STORM_SURGE',
    severity: 'WATCH',
    title: 'Storm surge watch for the Gulf of Kachchh and Saurashtra coast',
    description:
      'In association with the western disturbance, water levels of about 1.0 to 1.5 m above the astronomical tide are likely along the Gulf of Kachchh, Porbandar and Veraval coasts during 11-12 Sep.',
    affectedCoast: 'Gulf of Kachchh & Saurashtra',
    advisoryLevel: 'YELLOW',
    center: [22.1, 69.4],
    radiusKm: 170,
    action:
      'Avoid estuarine and low-lying creek routes during the surge window. Move craft to deeper sheltered water with an experienced handler.',
    validUntilHours: 54,
    source: 'INCOIS Storm Surge Watch (Indian Ocean ENSO advisories)',
  },
  {
    id: 'alert-coromandel-rough-sea',
    type: 'ROUGH_SEA',
    severity: 'WATCH',
    title: 'Rough sea with very high waves off the Coromandel coast',
    description:
      'Rough to very rough sea is likely with very high waves of 3.0 to 3.8 m during 10-11 Sep, with thunderstorms accompanied by lightning over the Gulf of Mannar and adjoining south Bay of Bengal.',
    affectedCoast: 'Tamil Nadu & Puducherry coast',
    advisoryLevel: 'YELLOW',
    center: [11.4, 79.4],
    radiusKm: 180,
    action:
      'Postpone artisanal fishing and keep mechanised vessels inside the harbour breakwater. Beware of lightning while handling nets on deck.',
    validUntilHours: 30,
    source: 'IMD Marine Weather Warning bulletin',
  },
];

/**
 * Active alerts, annotated with distance/bearing from the requested position so
 * the alert agent can answer "in my area" questions without extra joins.
 */
export function getMarineAlertsNear(latitude: number, longitude: number): MarineAlert[] {
  const origin = { latitude, longitude };
  return ALERT_SEEDS.map((seed) => {
    const center = { latitude: seed.center[0], longitude: seed.center[1] };
    const distanceKm = roundTo(haversineKm(origin, center), 1);
    const bearingDeg = initialBearingDeg(origin, center);
    return {
      id: seed.id,
      type: seed.type,
      severity: seed.severity,
      title: seed.title,
      description: seed.description,
      affectedCoast: seed.affectedCoast,
      advisoryLevel: seed.advisoryLevel,
      distanceKm,
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      withinInfluence: distanceKm <= seed.radiusKm,
      issuedAt: DATA_CYCLE.label,
      validFrom: DATA_CYCLE.label,
      validUntil: `+${seed.validUntilHours} h from ${DATA_CYCLE.label.split('·')[0].trim()}`,
      action: seed.action,
      source: seed.source,
      geometry: {
        kind: 'circle',
        center,
        radiusKm: seed.radiusKm,
      },
    } satisfies MarineAlert;
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

export const ALL_ALERT_TYPES: AlertType[] = [
  'CYCLONE',
  'HIGH_WAVE',
  'STRONG_WIND',
  'SQUALL',
  'LIGHTNING',
  'STORM_SURGE',
  'ROUGH_SEA',
  'TSUNAMI',
];

/* ------------------------------------------------------------------ *
 * Geofences
 * ------------------------------------------------------------------ */

export const GEOFENCES: GeofenceZone[] = [
  {
    id: 'gf-india-pakistan-eez',
    name: 'India–Pakistan maritime boundary (Sir Creek approach)',
    type: 'INTERNATIONAL_BOUNDARY',
    shape: 'polygon',
    coordinates: [
      [23.95, 67.55], [23.72, 68.15], [23.35, 68.62], [22.98, 69.1], [22.98, 68.5], [23.3, 67.95], [23.65, 67.5],
    ],
    bufferKm: 10,
    severity: 'CRITICAL',
    authority: 'India–Pakistan Boundary Agreement (Sir Creek)',
    regulation:
      'Crossing the maritime boundary without clearance is an offence under the territorial sea provisions; craft are liable to seizure and prosecution.',
    description:
      'The line of control in the Sir Creek / Rann of Kutch area. Fishing beyond it requires an explicit fishing licence and a permitted vessel registration.',
  },
  {
    id: 'gf-india-srilanka-eez',
    name: 'India–Sri Lanka maritime boundary (Palk Strait)',
    type: 'INTERNATIONAL_BOUNDARY',
    shape: 'polygon',
    coordinates: [
      [9.72, 79.25], [9.2, 79.62], [8.6, 80.05], [7.95, 80.4], [7.95, 79.9], [8.5, 79.45], [9.2, 78.9],
    ],
    bufferKm: 10,
    severity: 'CRITICAL',
    authority: 'India–Sri Lanka Maritime Boundary Agreement, 1976',
    regulation:
      'All craft must obtain prior Sri Lankan and Indian clearance to transit; fishing in the boundary area is prohibited.',
    description:
      'Trans-boundary waters between Mannar and the Palk Strait. Used heavily for migrant and trawler transit, under bilateral protocol only.',
  },
  {
    id: 'gf-kachchh-mnp',
    name: 'Gulf of Kachchh Marine National Park',
    type: 'MARINE_PROTECTED_AREA',
    shape: 'circle',
    center: { latitude: 22.55, longitude: 69.35 },
    radiusKm: 42,
    coordinates: [],
    bufferKm: 12,
    severity: 'HIGH',
    authority: 'Wild Life (Protection) Act, 1972 (Schedule I) & Wildlife (Protection) Rules',
    regulation:
      'All fishing is prohibited inside the park boundary. Entry is permitted only for research or with a prior permit from the Chief Wildlife Warden.',
    description:
      'The largest marine protected area in India, declared 1982. Contains the only tame Asiatic lions and important rookery islands.',
  },
  {
    id: 'gf-lakshadweep-mpa',
    name: 'Lakshadweep coral reef protected area',
    type: 'MARINE_PROTECTED_AREA',
    shape: 'circle',
    center: { latitude: 10.9, longitude: 72.6 },
    radiusKm: 55,
    coordinates: [],
    bufferKm: 15,
    severity: 'HIGH',
    authority: 'Lakshadweep Administration regulation, 2012',
    regulation:
      'No-take zone: extraction, collection and fishing of any kind is banned. Only registered research vessels may operate.',
    description:
      'Atolls fringing a shallow lagoon system. Extremely sensitive to anchoring damage and bottom contact by trawlers.',
  },
  {
    id: 'gf-sundarbans-esz',
    name: 'Sundarbans Ecologically Sensitive Zone',
    type: 'ECOLOGICALLY_SENSITIVE_ZONE',
    shape: 'circle',
    center: { latitude: 21.95, longitude: 89.05 },
    radiusKm: 55,
    coordinates: [],
    bufferKm: 12,
    severity: 'HIGH',
    authority: 'MoEFCC Notification, 2019 (ESZ for Sundarbans)',
    regulation:
      'Banned/regulated categories include fishing by mechanised boats, sand mining and mangrove cutting. Night transit through creeks is discouraged.',
    description:
      'World Heritage mangrove biosphere reserve and tiger habitat. Estuarine productivity is high but entry is tightly regulated.',
  },
  {
    id: 'gf-chilika-esz',
    name: 'Chilika Lake Ramsar site',
    type: 'ECOLOGICALLY_SENSITIVE_ZONE',
    shape: 'circle',
    center: { latitude: 19.72, longitude: 85.28 },
    radiusKm: 18,
    coordinates: [],
    bufferKm: 8,
    severity: 'MODERATE',
    authority: 'Ramsar Convention; Chilika Development Authority regulations',
    regulation:
      'Regulated fishing zones and a no-take core zone. Motorised craft require a registered Chilika fishing permit.',
    description:
      'Largest brackish-water lagoon in India and an important nursery for the Bay of Bengal fish stock.',
  },
  {
    id: 'gf-mumbai-high-oil',
    name: 'Mumbai High offshore oil and gas field',
    type: 'OIL_RIG',
    shape: 'circle',
    center: { latitude: 19.35, longitude: 71.3 },
    radiusKm: 32,
    coordinates: [],
    bufferKm: 10,
    severity: 'HIGH',
    authority: 'ONGC / Oil and Natural Gas Corporation production safety zone',
    regulation:
      'A 500 m safety exclusion zone applies around every production platform. Anchoring, trawling and vessel transit inside the field require escort permission.',
    description:
      'India\'s largest producing offshore field. Platform fires and gas flaring are a permanent navigation hazard.',
  },
  {
    id: 'gf-gujarat-oil-blocks',
    name: 'Gujarat offshore oil & gas blocks',
    type: 'OIL_RIG',
    shape: 'circle',
    center: { latitude: 21.05, longitude: 70.45 },
    radiusKm: 28,
    coordinates: [],
    bufferKm: 10,
    severity: 'HIGH',
    authority: 'ONGC / Gujarat State Maritime Board',
    regulation:
      'Exclusion zones around wellheads and flow stations; anchoring and fishing within the blocks is prohibited without a lease.',
    description:
      'Satellite fields around the Mumbai High system producing from fixed platforms in the northern Arabian Sea.',
  },
  {
    id: 'gf-naval-exercise-west',
    name: 'Western Naval Command exercise area',
    type: 'MILITARY_ZONE',
    shape: 'circle',
    center: { latitude: 18.1, longitude: 71.05 },
    radiusKm: 62,
    coordinates: [],
    bufferKm: 15,
    severity: 'MODERATE',
    authority: 'Indian Navy, Western Naval Command',
    regulation:
      'Firing and exercise areas are closed to all civil traffic for the duration announced in NOTAM. Transiting without clearance is punishable.',
    description:
      'Standing anti-submarine and surface firing box southwest of Mumbai. Check NOTAM and the Navy helpline before departing.',
  },
  {
    id: 'gf-naval-exercise-east',
    name: 'Eastern Naval Command exercise area',
    type: 'MILITARY_ZONE',
    shape: 'circle',
    center: { latitude: 16.1, longitude: 82.4 },
    radiusKm: 58,
    coordinates: [],
    bufferKm: 15,
    severity: 'MODERATE',
    authority: 'Indian Navy, Eastern Naval Command',
    regulation:
      'Exercise and firing areas closed to civil traffic as notified. Advance permission required from the naval port authority.',
    description:
      'Surface and air firing box off Visakhapatnam used for periodic fleet drills.',
  },
  {
    id: 'gf-manora-cable',
    name: 'Manora submarine cable corridor',
    type: 'SUBMARINE_CABLE',
    shape: 'line',
    coordinates: [
      [18.94, 72.83], [18.8, 72.75], [18.62, 72.68], [18.44, 72.61],
    ],
    bufferKm: 5,
    severity: 'INFO',
    authority: 'Telegraph Act, 1885, Section 7 & Cable Landing Rules',
    regulation:
      'Anchoring, dragging or trawling over a cable is punishable under the Telegraph Act. Keep a 5 km clear corridor.',
    description:
      'Repeaterless trunk fibre route from the Manora cable landing station towards the international landing point.',
  },
  {
    id: 'gf-arabian-sea-lane',
    name: 'Arabian Sea international shipping lane',
    type: 'SHIPPING_LANE',
    shape: 'line',
    coordinates: [
      [9.2, 66.2], [13.5, 67.4], [18.1, 69.4], [22.4, 71.9], [25.4, 63.8],
    ],
    bufferKm: 8,
    severity: 'INFO',
    authority: 'IMO COLREGs & India Merchant Shipping Act',
    regulation:
      'Give way to deep-draught vessels. Avoid fishing across a traffic separation scheme and never obstruct the lane.',
    description:
      'Principal east–west merchant corridor connecting the Arabian Sea approaches. Heavy merchant traffic, including tankers.',
  },
  {
    id: 'gf-gulf-mannar-mpa',
    name: 'Gulf of Mannar biosphere reserve',
    type: 'MARINE_PROTECTED_AREA',
    shape: 'circle',
    center: { latitude: 8.95, longitude: 78.35 },
    radiusKm: 48,
    coordinates: [],
    bufferKm: 10,
    severity: 'HIGH',
    authority: 'Gulf of Mannar Marine Biosphere Reserve (1989), Wildlife (Protection) Act',
    regulation:
      'No-take zone: fishing and collection of any kind are banned throughout the reserve without a research permit.',
    description:
      'Fringing coral reefs, seagrass meadows and the only dugong population in Indian waters. Reef contact by trawls is a major risk.',
  },
  {
    id: 'gf-pulicat-bird-sanctuary',
    name: 'Pulicat Lake Bird Sanctuary & backwaters',
    type: 'ECOLOGICALLY_SENSITIVE_ZONE',
    shape: 'circle',
    center: { latitude: 13.42, longitude: 80.32 },
    radiusKm: 22,
    coordinates: [],
    bufferKm: 8,
    severity: 'MODERATE',
    authority: 'Wildlife (Protection) Act, 1972 (Schedule I & II)',
    regulation:
      'Motorised craft are restricted inside the sanctuary. Fishing is regulated under the Pulicat Fishermen Welfare Society scheme.',
    description:
      'Largest brackish-water lagoon in Andhra Pradesh, a key wintering ground for migratory shorebirds.',
  },
];

/* ------------------------------------------------------------------ *
 * Hazard grid (used by the route agent for corridor selection)
 * ------------------------------------------------------------------ */

export interface HazardCell {
  id: string;
  name: string;
  center: [number, number];
  radiusKm: number;
  maxWaveHeightMeters: number;
  maxWindKnots: number;
  advisoryLevel: AdvisoryLevel;
  reason: string;
}

export const HAZARD_CELLS: HazardCell[] = [
  {
    id: 'hz-mumbai-high-swell',
    name: 'Mumbai offshore high-swell sector',
    center: [18.62, 72.22],
    radiusKm: 45,
    maxWaveHeightMeters: 3.1,
    maxWindKnots: 28,
    advisoryLevel: 'YELLOW',
    reason: 'Onshore swell window with 2.8-3.1 m seas and 25-28 kt WNW winds.',
  },
  {
    id: 'hz-alibaug-squall',
    name: 'Alibaug–Murud squall corridor',
    center: [18.9, 72.95],
    radiusKm: 30,
    maxWaveHeightMeters: 2.2,
    maxWindKnots: 38,
    advisoryLevel: 'YELLOW',
    reason: 'Convective squall line crossing the inner shelf during the afternoon window.',
  },
  {
    id: 'hz-veraval-surge',
    name: 'Veraval–Porbandar surf zone',
    center: [21.4, 69.9],
    radiusKm: 60,
    maxWaveHeightMeters: 2.9,
    maxWindKnots: 30,
    advisoryLevel: 'YELLOW',
    reason: 'Storm-surge watch sector with reinforced surf and short-period wind waves.',
  },
  {
    id: 'hz-kochi-rough',
    name: 'Kerala coast rough sea belt',
    center: [10.4, 75.9],
    radiusKm: 85,
    maxWaveHeightMeters: 2.8,
    maxWindKnots: 26,
    advisoryLevel: 'ORANGE',
    reason: 'INCOIS orange high-wave warning: 2.2-2.8 m, very high seas of 3.5 m likely.',
  },
  {
    id: 'hz-wadgeshoal',
    name: 'Wadge Bank / Pamban shallow-water hazard',
    center: [9.2, 76.0],
    radiusKm: 40,
    maxWaveHeightMeters: 2.0,
    maxWindKnots: 22,
    advisoryLevel: 'GREEN',
    reason: 'Shallow drying bank with 0.2 m depth on the western edge — grounding risk in swell.',
  },
  {
    id: 'hz-chennai-rough',
    name: 'Coromandel rough sea belt',
    center: [11.9, 79.9],
    radiusKm: 90,
    maxWaveHeightMeters: 3.4,
    maxWindKnots: 27,
    advisoryLevel: 'YELLOW',
    reason: 'Very high waves of 3.0-3.8 m with thunderstorm and lightning activity.',
  },
  {
    id: 'hz-vizag-cyclone',
    name: 'North Bay of Bengal cyclone watch sector',
    center: [18.2, 87.0],
    radiusKm: 170,
    maxWaveHeightMeters: 4.6,
    maxWindKnots: 52,
    advisoryLevel: 'ORANGE',
    reason: 'IMD orange cyclone watch: 45-55 kmph gusting to 65 kmph anticipated from 11 Sep.',
  },
  {
    id: 'hz-digha-sundarban',
    name: 'Sundarbans creek and shoal complex',
    center: [21.6, 88.6],
    radiusKm: 70,
    maxWaveHeightMeters: 2.6,
    maxWindKnots: 24,
    advisoryLevel: 'YELLOW',
    reason: 'Shallow creeks, shifting sandbars and a high likelihood of tidal trapping at the turns.',
  },
];

/* ------------------------------------------------------------------ *
 * Historical productivity series
 * ------------------------------------------------------------------ */

interface RegionProfile {
  region: string;
  harborId: string;
  /** Annual mean chlorophyll for the region, mg/m3. */
  chlBase: number;
  /** Baseline SST, degC. */
  sstBase: number;
  /** Direction and magnitude of the multi-year drift. */
  chlDriftPerMonth: number;
  sstDriftPerMonth: number;
  /** Dominant drivers for the diagnosis narrative. */
  drivers: string[];
}

const REGION_PROFILES: RegionProfile[] = [
  {
    region: 'Konkan',
    harborId: 'mumbai',
    chlBase: 1.55,
    sstBase: 28.0,
    chlDriftPerMonth: -0.012,
    sstDriftPerMonth: 0.011,
    drivers: [
      'Coastal urban discharge raising the nutrient load but also the turbidity that blocks light penetration',
      'Weak 2026 southwest monsoon: reduced upwelling-favoured nutrient supply into the shelf',
      'Seasonal compression of the 24-29 degC pelagic band, compressing the shelf fish habitat',
    ],
  },
  {
    region: 'Saurashtra',
    harborId: 'veraval',
    chlBase: 2.35,
    sstBase: 27.2,
    chlDriftPerMonth: 0.008,
    sstDriftPerMonth: 0.009,
    drivers: [
      'Strong seasonal coastal upwelling along the Veraval–Porbandar shelf break',
      'Rising sea surface temperature lifting the productive layer and thinning the thermocline',
    ],
  },
  {
    region: 'Malabar Coast',
    harborId: 'kochi',
    chlBase: 1.12,
    sstBase: 28.1,
    chlDriftPerMonth: -0.018,
    sstDriftPerMonth: 0.016,
    drivers: [
      'Weak coastal upwelling in the 2026 monsoon season',
      'Deepening warm-water intrusion reducing the depth at which chlorophyll peaks',
      'Repeat purse-seine effort concentrating on the few remaining cool pockets',
    ],
  },
  {
    region: 'Coromandel Coast',
    harborId: 'chennai',
    chlBase: 1.48,
    sstBase: 28.7,
    chlDriftPerMonth: -0.006,
    sstDriftPerMonth: 0.013,
    drivers: [
      'Freshwater plume turbidity over the northern shelf depressing surface chlorophyll',
      'Gulf of Mannar reef degradation reducing nursery habitat connectivity',
      'Escalating trawl effort on the remaining ribbon-fish and prawn grounds',
    ],
  },
  {
    region: 'Andhra Coast',
    harborId: 'vizag',
    chlBase: 1.05,
    sstBase: 28.6,
    chlDriftPerMonth: 0.004,
    sstDriftPerMonth: 0.007,
    drivers: [
      'Cyclone-driven surface mixing producing a short-lived but intense chlorophyll pulse each year',
      'Inshore sediment load from the Mahanadi delta front',
    ],
  },
  {
    region: 'Sundarbans Coast',
    harborId: 'digha',
    chlBase: 2.85,
    sstBase: 28.3,
    chlDriftPerMonth: -0.022,
    sstDriftPerMonth: 0.01,
    drivers: [
      'Mangrove edge loss reducing the estuarine nursery contribution to the coastal stock',
      'Freshwater diversion reducing the sediment and nutrient delivery that sustained the belt-fish fishery',
      'Bay of Bengal warm-pool intrusion moving the productive band seaward of the artisanal grounds',
    ],
  },
];

/**
 * Build a 36-month productivity series for a coastal region.
 * Synthetic but internally consistent: chlorophyll, SST, effort and the
 * landings index are all driven by the same seeded noise field, so the
 * correlation analysis the historical agent performs is genuine arithmetic on
 * a self-consistent series rather than a hard-coded story.
 */
export function getHistoricalSeries(region: string, months = 36): HistoricalPoint[] {
  const profile =
    REGION_PROFILES.find((p) => p.region === region) ?? REGION_PROFILES[0];
  const series: HistoricalPoint[] = [];

  // Anchor the series so the last month is the current one.
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const startIndex = endYear * 12 + (endMonth - 1) - (months - 1);

  const seasonal = [0.28, 0.34, 0.2, 0.05, -0.1, -0.16, -0.12, -0.02, 0.14, 0.3, 0.26, 0.12];

  for (let i = 0; i < months; i++) {
    const absolute = startIndex + i;
    const year = Math.floor(absolute / 12);
    const monthIndex = absolute % 12;

    const rand = seeded('hist', profile.region, year, monthIndex);
    const progress = i / (months - 1);

    const seasonalTerm = seasonal[monthIndex];
    const chl = Math.max(
      0.08,
      profile.chlBase * (1 + seasonalTerm * 0.55) * (1 + profile.chlDriftPerMonth * i) + (rand() - 0.5) * 0.34,
    );
    const sst =
      profile.sstBase +
      seasonalTerm * 0.9 +
      profile.sstDriftPerMonth * i +
      (rand() - 0.5) * 0.5;

    // Landings depend on chlorophyll, negatively on SST above the optimum, and
    // saturate with effort (diminishing returns at high CPUE).
    const sstPenalty = Math.max(0, sst - 28.4) * 5.2;
    const effortIndex = clamp(46 + progress * 26 + (rand() - 0.5) * 16, 8, 100);
    const chlTerm = clamp((chl / 2.6) * 46, 0, 58);
    const raw = chlTerm - sstPenalty + (effortIndex - 40) * 0.28;
    const catchIndex = clamp(raw + (rand() - 0.5) * 7, 5, 100);

    series.push({
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      chlorophyllMgM3: Math.round(chl * 100) / 100,
      sstCelsius: Math.round(sst * 100) / 100,
      catchIndex: Math.round(catchIndex * 10) / 10,
      effortIndex: Math.round(effortIndex * 10) / 10,
      rainfallMm: Math.round(clamp(90 + seasonalTerm * 180 + profile.chlBase * 40 + (rand() - 0.5) * 70, 0, 420)),
    });
  }

  return series;
}

export const REGION_PROFILES_FOR_HISTORY = REGION_PROFILES;
export const HISTORICAL_REGIONS = REGION_PROFILES.map((p) => p.region);
export const HARBOR_REGION: Record<string, string> = HARBORS.reduce(
  (acc, harbor) => ({ ...acc, [harbor.id]: harbor.region }),
  {} as Record<string, string>,
);

/* ------------------------------------------------------------------ *
 * Regional productivity grid (chlorophyll / SST hotspot queries)
 * ------------------------------------------------------------------ */

/**
 * Satellite-style sample grid around a region used to answer
 * "which regions show high chlorophyll and favourable SST".
 */
export function getProductivityGrid(
  center: { latitude: number; longitude: number },
  spanKm = 200,
  step = 4,
): Array<{ latitude: number; longitude: number; chlorophyllMgM3: number; sstCelsius: number; sstAnomalyC: number }> {
  const cells: Array<{
    latitude: number;
    longitude: number;
    chlorophyllMgM3: number;
    sstCelsius: number;
    sstAnomalyC: number;
  }> = [];

  const rows = Math.floor((spanKm * 2) / step);
  const cols = Math.floor((spanKm * 2) / (step * 1.1));

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const latitude = roundTo(center.latitude + (r - rows / 2) * (step / 111.32), 3);
      const longitude = roundTo(center.longitude + (c - cols / 2) * (step / 111.32 / Math.max(0.2, Math.cos(toRadians(latitude)))), 3);
      const rand = seeded('grid', latitude, longitude);

      // Offshore decay + a front structure so the map has realistic gradients.
      const offshore = Math.min(1, haversineKm(center, { latitude, longitude }) / spanKm);
      const front = Math.sin((latitude * 9.3 + longitude * 5.1) % Math.PI) * 0.6;

      const chlorophyllMgM3 = roundTo(
        clamp(2.4 * (1 - offshore * 0.72) + front * 0.9 + (rand() - 0.5) * 0.5 - 0.35, 0.05, 4.5),
        2,
      );
      const sstCelsius = roundTo(27.6 + front * 1.5 + (rand() - 0.5) * 0.7 - offshore * 0.4, 1);
      const sstAnomalyC = roundTo((sstCelsius - 27.6) * 0.8 + (rand() - 0.5) * 0.5, 2);

      cells.push({ latitude, longitude, chlorophyllMgM3, sstCelsius, sstAnomalyC });
    }
  }

  return cells;
}

/* ------------------------------------------------------------------ *
 * Vessel profiles (route agent)
 * ------------------------------------------------------------------ */

export interface VesselProfile {
  id: string;
  label: string;
  speedKnots: number;
  /** Freeboard / sea-keeping limit in metres of significant wave height. */
  maxWaveHeightMeters: number;
  /** Safe operational wind limit in knots. */
  maxWindKnots: number;
  /** Typical range from the harbour in nautical miles. */
  typicalRangeNm: number;
  note: string;
}

export const VESSEL_PROFILES: VesselProfile[] = [
  {
    id: 'country_boat',
    label: 'Country boat / surf canoe (≤ 6 m, non-mechanised)',
    speedKnots: 4.5,
    maxWaveHeightMeters: 1.5,
    maxWindKnots: 15,
    typicalRangeNm: 10,
    note: 'Extremely weather-sensitive. Ashore for any ORANGE advisory.',
  },
  {
    id: 'motorized_dinghy',
    label: 'Motorised dinghy / FRP boat (6-10 m)',
    speedKnots: 8,
    maxWaveHeightMeters: 2.2,
    maxWindKnots: 20,
    typicalRangeNm: 25,
    note: 'The default profile. Keep an escape route to the nearest safe haven.',
  },
  {
    id: 'gillnetter',
    label: 'Gillnetter (10-14 m)',
    speedKnots: 9,
    maxWaveHeightMeters: 2.8,
    maxWindKnots: 24,
    typicalRangeNm: 40,
    note: 'Can work marginally in 2.5 m seas if the swell period is short.',
  },
  {
    id: 'trawler',
    label: 'Trawler (15-20 m, mechanised)',
    speedKnots: 8.5,
    maxWaveHeightMeters: 3.5,
    maxWindKnots: 28,
    typicalRangeNm: 60,
    note: 'Stable in moderate rough sea. Avoid crossing a gale-front swell.',
  },
  {
    id: 'purse_seiner',
    label: 'Purse seiner (20 m+)',
    speedKnots: 10,
    maxWaveHeightMeters: 3.8,
    maxWindKnots: 30,
    typicalRangeNm: 80,
    note: 'Fast enough to outrun a decaying squall; mind the net-set clearance time.',
  },
  {
    id: 'deep_sea_trawler',
    label: 'Deep-sea trawler (25 m+)',
    speedKnots: 10.5,
    maxWaveHeightMeters: 4.5,
    maxWindKnots: 34,
    typicalRangeNm: 120,
    note: 'Only profile ORCA rates for the northern oceanic and Wadge Bank grounds.',
  },
];

export const VESSEL_BY_ID: Record<string, VesselProfile> = VESSEL_PROFILES.reduce(
  (acc, vessel) => ({ ...acc, [vessel.id]: vessel }),
  {} as Record<string, VesselProfile>,
);

export const DEFAULT_VESSEL_ID = 'motorized_dinghy';

/* ------------------------------------------------------------------ *
 * Misc helpers
 * ------------------------------------------------------------------ */

/** Douglas sea-state text for an arbitrary significant wave height. */
export const seaStateText = (waveHeightMeters: number): string =>
  seaStateFor(waveHeightMeters).text;

/** Convert a bearing in degrees to the 8-point label used in prose. */
export const bearing8 = (deg: number): string =>
  compassPoint(deg, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

/** Convert degrees to radians, re-exported for agent modules. */
export { toDegrees, toRadians };
