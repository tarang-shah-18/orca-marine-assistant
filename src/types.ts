/**
 * ORCA domain model.
 *
 * Single source of truth for every type crossing the boundary between the
 * collaborative agent engine, the Express API and the React client.
 */

/* ------------------------------------------------------------------ *
 * Language
 * ------------------------------------------------------------------ */

export type LanguageCode =
  | 'en-IN'
  | 'hi-IN'
  | 'mr-IN'
  | 'gu-IN'
  | 'kn-IN'
  | 'ml-IN'
  | 'te-IN'
  | 'ta-IN'
  | 'bn-IN'
  | 'or-IN'
  | 'pa-IN';

export type ScriptCode =
  | 'latin'
  | 'devanagari'
  | 'gujarati'
  | 'kannada'
  | 'malayalam'
  | 'telugu'
  | 'tamil'
  | 'bengali'
  | 'oriya'
  | 'gurmukhi';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  region: string;
  script: ScriptCode;
  /** BCP-47 tags pushed to SpeechRecognition / SpeechSynthesis. */
  speechTag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en-IN',
    label: 'English',
    nativeLabel: 'English',
    region: 'National / Coastal',
    script: 'latin',
    speechTag: 'en-IN',
  },
  {
    code: 'hi-IN',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    region: 'National',
    script: 'devanagari',
    speechTag: 'hi-IN',
  },
  {
    code: 'mr-IN',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    region: 'Maharashtra Coast',
    script: 'devanagari',
    speechTag: 'mr-IN',
  },
  {
    code: 'gu-IN',
    label: 'Gujarati',
    nativeLabel: 'ગુજરાતી',
    region: 'Gujarat Coast',
    script: 'gujarati',
    speechTag: 'gu-IN',
  },
  {
    code: 'kn-IN',
    label: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
    region: 'Karnataka Coast',
    script: 'kannada',
    speechTag: 'kn-IN',
  },
  {
    code: 'ml-IN',
    label: 'Malayalam',
    nativeLabel: 'മലയാളം',
    region: 'Kerala Coast',
    script: 'malayalam',
    speechTag: 'ml-IN',
  },
  {
    code: 'te-IN',
    label: 'Telugu',
    nativeLabel: 'తెలుగు',
    region: 'Andhra Pradesh Coast',
    script: 'telugu',
    speechTag: 'te-IN',
  },
  {
    code: 'ta-IN',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    region: 'Tamil Nadu Coast',
    script: 'tamil',
    speechTag: 'ta-IN',
  },
  {
    code: 'bn-IN',
    label: 'Bengali',
    nativeLabel: 'বাংলা',
    region: 'Sundarbans & Bay of Bengal',
    script: 'bengali',
    speechTag: 'bn-IN',
  },
  {
    code: 'or-IN',
    label: 'Odia',
    nativeLabel: 'ଓଡ଼ିଆ',
    region: 'Odisha Coast',
    script: 'oriya',
    speechTag: 'or-IN',
  },
  {
    code: 'pa-IN',
    label: 'Punjabi',
    nativeLabel: 'ਪੰਜਾਬੀ',
    region: 'National (Coastal Diaspora)',
    script: 'gurmukhi',
    speechTag: 'pa-IN',
  },
];

export const LANGUAGE_BY_CODE: Record<LanguageCode, LanguageOption> = SUPPORTED_LANGUAGES.reduce(
  (acc, lang) => ({ ...acc, [lang.code]: lang }),
  {} as Record<LanguageCode, LanguageOption>,
);

/* ------------------------------------------------------------------ *
 * Agents
 * ------------------------------------------------------------------ */

export type AgentType =
  | 'PLANNER_AGENT'
  | 'PFZ_AGENT'
  | 'WEATHER_AGENT'
  | 'OCEAN_AGENT'
  | 'TIDE_AGENT'
  | 'MARINE_ALERT_AGENT'
  | 'GIS_AGENT'
  | 'ROUTE_OPTIMIZATION_AGENT'
  | 'GEOFENCING_AGENT'
  | 'RISK_VALIDATION_AGENT'
  | 'HISTORICAL_ANALYSIS_AGENT'
  | 'VISUALIZATION_AGENT'
  | 'CRITIC_AGENT';

export interface AgentInfo {
  id: AgentType;
  name: string;
  description: string;
  /** Tailwind colour family used for badges in the agent trace. */
  color: string;
  /** Upstream data products the agent reasons over. */
  sources: string[];
}

export const AGENT_REGISTRY: Record<AgentType, AgentInfo> = {
  PLANNER_AGENT: {
    id: 'PLANNER_AGENT',
    name: 'Planner Agent',
    description:
      'Interprets intent, resolves slots, decomposes the request into a task graph and selects the agent roster',
    color: 'cyan',
    sources: ['ORCA intent grammar', 'Conversation memory'],
  },
  PFZ_AGENT: {
    id: 'PFZ_AGENT',
    name: 'PFZ Agent',
    description:
      'Analyses satellite ocean colour chlorophyll-a and SST fronts to locate Potential Fishing Zones',
    color: 'emerald',
    sources: ['MODIS/VIIRS ocean colour', 'INSAT-3D SST', 'INCOIS PFZ advisories'],
  },
  WEATHER_AGENT: {
    id: 'WEATHER_AGENT',
    name: 'Weather Agent',
    description: 'Tracks wind, gusts, squalls, rainfall, visibility and lightning risk',
    color: 'sky',
    sources: ['IMD Coastal Marine Met Bulletin', 'IMD nowcast'],
  },
  OCEAN_AGENT: {
    id: 'OCEAN_AGENT',
    name: 'Ocean Agent',
    description: 'Monitors wave height, swell, sea state, currents and sea surface temperature',
    color: 'blue',
    sources: ['INCOIS Ocean State Forecast', 'Wave rider buoys', 'OSF-3D'],
  },
  TIDE_AGENT: {
    id: 'TIDE_AGENT',
    name: 'Tide & Current Agent',
    description: 'Predicts tidal height, range, flood/current phase and safe transit windows',
    color: 'indigo',
    sources: ['INCOIS tide gauge network', 'Harmonic constituents'],
  },
  MARINE_ALERT_AGENT: {
    id: 'MARINE_ALERT_AGENT',
    name: 'Marine Alert Agent',
    description: 'Detects cyclone, high wave, squall, storm surge and lightning advisories',
    color: 'red',
    sources: ['IMD Cyclone Warning Centre', 'INCOIS Early Warning Centre', 'INCOIS EWS'],
  },
  GIS_AGENT: {
    id: 'GIS_AGENT',
    name: 'GIS Agent',
    description: 'Computes distances, bearings, ETAs and spatial joins over the marine grid',
    color: 'amber',
    sources: ['ORCA geodesic engine', 'Coastal gazetteer'],
  },
  ROUTE_OPTIMIZATION_AGENT: {
    id: 'ROUTE_OPTIMIZATION_AGENT',
    name: 'Route Optimization Agent',
    description: 'Plans the safest navigation corridor around hazard cells and geofences',
    color: 'cyan',
    sources: ['ORCA routing engine', 'INCOIS hazard grid'],
  },
  GEOFENCING_AGENT: {
    id: 'GEOFENCING_AGENT',
    name: 'Geofencing Agent',
    description: 'Monitors maritime boundaries, restricted waters, MPAs and ecologically sensitive zones',
    color: 'orange',
    sources: ['ORCA maritime boundary database', 'MBZ registry'],
  },
  RISK_VALIDATION_AGENT: {
    id: 'RISK_VALIDATION_AGENT',
    name: 'Risk Validation Agent',
    description: 'Fuses multi-agent evidence into a weighted, explainable safety verdict',
    color: 'violet',
    sources: ['All upstream agent findings'],
  },
  HISTORICAL_ANALYSIS_AGENT: {
    id: 'HISTORICAL_ANALYSIS_AGENT',
    name: 'Historical Analysis Agent',
    description: 'Diagnoses fish productivity trends and attributes change to environmental drivers',
    color: 'purple',
    sources: ['INCOIS annual fisheries statistics', 'Satellite archive', 'IMD rainfall'],
  },
  VISUALIZATION_AGENT: {
    id: 'VISUALIZATION_AGENT',
    name: 'Visualization Agent',
    description: 'Selects and prepares maps, charts and geospatial layers for the answer',
    color: 'pink',
    sources: ['ORCA viz planner', 'Leaflet layer templates'],
  },
  CRITIC_AGENT: {
    id: 'CRITIC_AGENT',
    name: 'Critic & Safety Agent',
    description: 'Audits the synthesised answer against evidence and enforces safety framing',
    color: 'rose',
    sources: ['Synthesised draft', 'Evidence ledger'],
  },
};

/* ------------------------------------------------------------------ *
 * Risk primitives
 * ------------------------------------------------------------------ */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

export type AdvisoryLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export const ADVISORY_WEIGHT: Record<AdvisoryLevel, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
};

export const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;

/**
 * Schema version of the engine's domain model and API envelopes. Bump on any
 * breaking change to the shapes the client parses; the server echoes it on
 * every success envelope (`apiVersion`) and on `/api/health`, so a mismatched
 * client/server pair fails loud instead of parsing stale shapes silently.
 */
export const DOMAIN_MODEL_VERSION = '2.0.0';

/* ------------------------------------------------------------------ *
 * Earth observation & fishing grounds
 * ------------------------------------------------------------------ */

export type Basin = 'Arabian Sea' | 'Bay of Bengal' | 'Palk Strait' | 'Gulf of Mannar';

export type ProductivityClass = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface PFZZone {
  id: string;
  name: string;
  region: string;
  basin: Basin;
  latitude: number;
  longitude: number;
  /** Radius of the mapped fishing ground in kilometres. */
  radiusKm: number;
  distanceKm: number;
  bearing: string;
  depthMeters: number;
  chlorophyllMgM3: number;
  /** Departure of the zone SST from the seasonal climatology. */
  sstAnomalyC: number;
  sstCelsius: number;
  targetFishSpecies: string[];
  /** Composite productivity score, 0-100. */
  productivityIndex: number;
  productivityClass: ProductivityClass;
  historicalTrend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
  observedAt: string;
  validFrom: string;
  validTill: string;
  status: 'favorable' | 'moderate' | 'unfavorable';
  source: string;
  /** Which upstream agent produced the primary evidence for this ground. */
  evidenceAgent: AgentType;
}

export interface ProductivityHotspot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  chlorophyllMgM3: number;
  sstCelsius: number;
  sstAnomalyC: number;
  productivityIndex: number;
  productivityClass: ProductivityClass;
  dominantSpecies: string[];
  distanceKm: number;
  bearing: string;
  note: string;
  source: string;
}

/* ------------------------------------------------------------------ *
 * Meteorology & oceanography
 * ------------------------------------------------------------------ */

export interface ForecastSlot {
  /** ISO date, e.g. `2026-09-10`. */
  date: string;
  /** Human readable IST label, e.g. `Thu 10 Sep · 06:00 IST`. */
  label: string;
  /** Hours from now. */
  validHours: number;
  period: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
}

export interface WeatherSlot extends ForecastSlot {
  temperatureCelsius: number;
  windSpeedKnots: number;
  windSpeedKmph: number;
  windDirection: string;
  windDirectionDeg: number;
  gustKnots: number;
  visibilityKm: number;
  rainProbability: number;
  lightningRisk: 'LOW' | 'MODERATE' | 'HIGH';
  condition: string;
}

export interface OceanSlot extends ForecastSlot {
  waveHeightMeters: number;
  wavePeriodSeconds: number;
  swellDirection: string;
  swellDirectionDeg: number;
  seaSurfaceTempCelsius: number;
  currentKnots: number;
  currentDirection: string;
  /** Douglas sea-state code 0-9. */
  seaStateCode: number;
  seaCondition: string;
}

export interface WeatherData {
  locationId: string;
  locationName: string;
  temperatureCelsius: number;
  windSpeedKnots: number;
  windSpeedKmph: number;
  windDirection: string;
  windDirectionDeg: number;
  gustKnots: number;
  visibilityKm: number;
  rainProbability: number;
  lightningRisk: 'LOW' | 'MODERATE' | 'HIGH';
  condition: string;
  /** Fishermen-safe wind threshold breach, if any. */
  squallWarning: boolean;
  source: string;
  timestamp: string;
  forecast: WeatherSlot[];
}

export interface OceanData {
  locationId: string;
  locationName: string;
  waveHeightMeters: number;
  wavePeriodSeconds: number;
  swellDirection: string;
  swellDirectionDeg: number;
  seaSurfaceTempCelsius: number;
  sstAnomalyC: number;
  currentKnots: number;
  currentDirection: string;
  seaStateCode: number;
  seaCondition: string;
  source: string;
  timestamp: string;
  forecast: OceanSlot[];
}

/* ------------------------------------------------------------------ *
 * Tides
 * ------------------------------------------------------------------ */

export interface TidalHarmonic {
  /** Harmonic constant name, e.g. `M2`. */
  name: string;
  /** Amplitude in metres. */
  amplitudeMeters: number;
  /** Greenwich phase in degrees. */
  phaseDegrees: number;
  /** Angular frequency in degrees per hour. */
  speedDegreesPerHour: number;
  description: string;
}

export interface TideStation {
  id: string;
  name: string;
  harborId: string;
  latitude: number;
  longitude: number;
  /** Mean sea level datum offset in metres. */
  datumOffsetMeters: number;
  harmonics: TidalHarmonic[];
  source: string;
}

export interface TidalData {
  /** ISO timestamp of the tide event. */
  time: string;
  /** Human readable IST label. */
  label: string;
  heightMeters: number;
  type: 'HIGH' | 'LOW';
  /** Tidal range since the previous event, metres. */
  rangeMeters: number;
  /** Tidal stream strength at the event, knots. */
  currentKnots: number;
  currentDirection: string;
  /** True while the flood tide (water rising) is in progress. */
  isRising: boolean;
}

export interface TideWindow {
  startLabel: string;
  endLabel: string;
  durationHours: number;
  quality: 'GOOD' | 'FAIR' | 'POOR';
  reason: string;
}

export interface TideReport {
  station: TideStation;
  events: TidalData[];
  highTide?: TidalData;
  lowTide?: TidalData;
  currentLevel: number;
  isRising: boolean;
  maxRangeMeters: number;
  windows: TideWindow[];
  /** Best departure window for small craft over the next 24h. */
  recommendedWindow?: TideWindow;
  source: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ *
 * Alerts
 * ------------------------------------------------------------------ */

export type AlertType =
  | 'CYCLONE'
  | 'HIGH_WAVE'
  | 'STRONG_WIND'
  | 'SQUALL'
  | 'LIGHTNING'
  | 'TSUNAMI'
  | 'STORM_SURGE'
  | 'ROUGH_SEA';

export type AlertSeverity = 'WARNING' | 'ALERT' | 'WATCH' | 'NONE';

export interface AlertGeometry {
  kind: 'circle' | 'polygon';
  center?: { latitude: number; longitude: number };
  radiusKm?: number;
  polygon?: Array<[number, number]>;
}

export interface MarineAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedCoast: string;
  advisoryLevel: AdvisoryLevel;
  /** Nearest distance in km from the queried position. */
  distanceKm: number;
  bearing: string;
  withinInfluence: boolean;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
  /** Operational instruction for the fisher. */
  action: string;
  source: string;
  /**
   * Structured parameters consumed by `localizeAlertText` so the alert copy
   * can be rendered in the requested language (e.g. `n`, `m`, `name`, `level`,
   * `validHours`). Absent on imported/quoted alerts, whose text stays verbatim.
   */
  params?: Record<string, string | number>;
  geometry?: AlertGeometry;
}

/* ------------------------------------------------------------------ *
 * Geofencing
 * ------------------------------------------------------------------ */

export type GeofenceType =
  | 'INTERNATIONAL_BOUNDARY'
  | 'RESTRICTED_WATERS'
  | 'MARINE_PROTECTED_AREA'
  | 'ECOLOGICALLY_SENSITIVE_ZONE'
  | 'OIL_RIG'
  | 'MILITARY_ZONE'
  | 'SUBMARINE_CABLE'
  | 'SHIPPING_LANE';

export type GeofenceSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'INFO';

export interface GeofenceZone {
  id: string;
  name: string;
  type: GeofenceType;
  shape: 'polygon' | 'circle' | 'line';
  coordinates: Array<[number, number]>;
  center?: { latitude: number; longitude: number };
  radiusKm?: number;
  /** Statutory buffer ORCA warns the vessel to keep, in km. */
  bufferKm: number;
  severity: GeofenceSeverity;
  authority: string;
  regulation: string;
  description: string;
}

export interface GeofenceViolation {
  boundaryId: string;
  boundaryName: string;
  boundaryType: GeofenceType;
  /** Distance from the reference position to the zone boundary, in km. */
  distanceKm: number;
  bearing: string;
  severity: GeofenceSeverity;
  /** True when the vessel is already inside the regulated area. */
  inside: boolean;
  /** True when inside the statutory buffer but not inside the zone itself. */
  withinBuffer: boolean;
  /** Statutory buffer ORCA warns the vessel to keep, in km. */
  bufferKm: number;
  regulation: string;
  description: string;
}

export interface GeofencingData {
  violations: GeofenceViolation[];
  nearbyBoundaries: GeofenceViolation[];
  warnings: string[];
  source: string;
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
  name: string;
  etaHours: number;
  riskLevel: RiskLevel;
  notes: string;
}

export interface RouteSegment {
  index: number;
  from: string;
  to: string;
  distanceKm: number;
  bearing: string;
  estimatedHours: number;
  maxWaveHeightMeters: number;
  maxWindKnots: number;
  riskLevel: RiskLevel;
  weatherWindow: 'FAVORABLE' | 'MARGINAL' | 'UNFAVORABLE';
  reasons: string[];
}

export interface RouteData {
  id: string;
  vesselType: string;
  vesselLabel: string;
  speedKnots: number;
  origin: { latitude: number; longitude: number; name: string };
  destination: { latitude: number; longitude: number; name: string };
  /** Full plotted track, densified for the map. */
  track: Array<[number, number]>;
  waypoints: RouteWaypoint[];
  segments: RouteSegment[];
  totalDistanceKm: number;
  estimatedTimeHours: string;
  /** 0-100, higher is safer. */
  safetyScore: number;
  riskLevel: RiskLevel;
  riskSegments: { segment: string; riskLevel: RiskLevel; reason: string }[];
  alternatives: RouteData[];
  geofenceConflicts: GeofenceViolation[];
  recommendation: string;
}

/* ------------------------------------------------------------------ *
 * Historical productivity diagnostics
 * ------------------------------------------------------------------ */

export interface HistoricalPoint {
  /** `YYYY-MM` */
  month: string;
  chlorophyllMgM3: number;
  sstCelsius: number;
  /** Normalised 0-100 landing index. */
  catchIndex: number;
  /** Standardised effort, 0-100. */
  effortIndex: number;
  rainfallMm: number;
}

export interface HistoricalData {
  region: string;
  harborName: string;
  timeRange: { start: string; end: string };
  series: HistoricalPoint[];
  fishProductivityTrend: 'increasing' | 'stable' | 'decreasing';
  productivityChangePercent: number;
  /** Landings per unit effort, t/1000 boat-days. */
  cpue: number;
  cpueChangePercent: number;
  keyFactors: string[];
  chlorophyllTrend: 'increasing' | 'stable' | 'decreasing';
  sstTrend: 'increasing' | 'stable' | 'decreasing';
  correlationAnalysis: string[];
  recommendations: string[];
  dataSources: string[];
}

/* ------------------------------------------------------------------ *
 * Visualisation
 * ------------------------------------------------------------------ */

export type VisualizationType =
  | 'map'
  | 'chart'
  | 'heatmap'
  | 'timeseries'
  | 'route'
  | 'table';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  unit: string;
  points: number[];
}

export interface VisualizationData {
  id: string;
  type: VisualizationType;
  title: string;
  subtitle: string;
  /** Axis labels for chart/timeseries renderings. */
  categories: string[];
  series: ChartSeries[];
  /** GeoJSON-ish payload for map/route renderings. */
  geo?: {
    points: Array<[number, number]>;
    circles: {
      id: string;
      label: string;
      latitude: number;
      longitude: number;
      radiusKm: number;
      color: string;
      level: 'favorable' | 'moderate' | 'hazard' | 'restricted';
    }[];
    polygons: {
      id: string;
      label: string;
      ring: Array<[number, number]>;
      color: string;
    }[];
  };
}

/* ------------------------------------------------------------------ *
 * Risk trajectory — departure-window intelligence
 * ------------------------------------------------------------------ */

export interface RiskTrajectoryPoint {
  /** Horizon label, e.g. `Now`, `+6 h`. */
  label: string;
  /** Hours from the reference instant this point describes. */
  validHours: number;
  riskLevel: RiskLevel;
  /** Weighted 0-100 safety score for this window. */
  safetyScore: number;
  /** Highest-weighted contributor at this horizon, e.g. `wind`. */
  dominant: string;
}

export interface RiskTrajectory {
  points: RiskTrajectoryPoint[];
  /** Least-risky future window far enough ahead to act on (>= 6 h). */
  bestWindow: RiskTrajectoryPoint | null;
  trend: 'improving' | 'stable' | 'deteriorating';
  /** True when the trajectory was computed from live forecast feeds. */
  fromLive: boolean;
  /** Plain-language caution, always attached. */
  note: string;
}

/* ------------------------------------------------------------------ *
 * Fleet intelligence — coast-wide overview
 * ------------------------------------------------------------------ */

export interface FleetHarbourSnapshot {
  harborId: string;
  shortName: string;
  state: string;
  basin: string;
  latitude: number;
  longitude: number;
  riskLevel: RiskLevel;
  safetyScore: number;
  dominant: string;
  windSpeedKnots: number;
  gustKnots: number;
  waveHeightMeters: number;
  seaStateCode: number;
  /** Highest-influence advisory title, if any. */
  topAdvisory: string | null;
  advisoryLevel: AdvisoryLevel | null;
  nearestPfzKm: number | null;
  nearestPfzName: string | null;
  /** True when either product degraded to the reference snapshot. */
  reference: boolean;
}

export interface FleetOverview {
  vesselId: string;
  vesselLabel: string;
  generatedAt: string;
  counts: Record<RiskLevel, number>;
  /** One snapshot per harbour, worst risk first. */
  harbours: FleetHarbourSnapshot[];
  note: string;
}

/* ------------------------------------------------------------------ *
 * Agentic runtime
 * ------------------------------------------------------------------ */

export interface EvidenceItem {
  label: string;
  value: string;
  source: string;
}

export interface AgentFinding {
  /** Short headline, e.g. `Significant wave height 2.4 m`. */
  statement: string;
  /** 0-1 confidence in the finding. */
  confidence: number;
  evidence: EvidenceItem[];
  /** Downstream risk contribution, if any. */
  riskLevel?: RiskLevel;
}

export interface AgentResult {
  agent: AgentType;
  status: 'OK' | 'PARTIAL' | 'ERROR';
  /** Round 1 is the initial plan; >=2 means a follow-up was requested. */
  round: number;
  findings: AgentFinding[];
  /** Compact text surfaced in the "Agent says" panel. */
  summary: string;
  /** Downstream agents this agent requested, forming the collaboration trace. */
  requestedAgents: AgentType[];
  dataSources: string[];
  durationMs: number;
}

export type TimeHorizon = 'NOW' | 'TODAY' | 'TOMORROW' | 'NEXT_3_DAYS' | 'WEEK';

export interface PlanStep {
  id: string;
  goal: string;
  agents: AgentType[];
  dependsOn: string[];
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'SKIPPED';
}

export interface ExecutionPlan {
  intent: string;
  intentConfidence: number;
  horizon: TimeHorizon;
  reasoning: string;
  steps: PlanStep[];
  agents: AgentType[];
  /** Follow-up round triggered by cross-agent collaboration. */
  followUps: string[];
}

export interface ConversationMemory {
  activeZone?: PFZZone;
  activeHarborId?: string;
  lastHorizon: TimeHorizon;
  lastVesselType: string;
  lastIntent?: string;
  /** Locations mentioned by the user, in order of mention. */
  mentionedLocations: string[];
  turnCount: number;
}

/* ------------------------------------------------------------------ *
 * Conversation
 * ------------------------------------------------------------------ */

export interface HarborLocation {
  id: string;
  name: string;
  shortName: string;
  state: string;
  region: string;
  basin: Basin;
  latitude: number;
  longitude: number;
  tideStationId: string;
  description: string;
  aliases: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'orca';
  text: string;
  timestamp: string;
  /** Detected/selected language of this turn. */
  language?: LanguageCode;
  result?: OrchestrationResult;
  /** Set when the turn was answered by the offline engine. */
  offline?: boolean;
  error?: string;
}

export interface OrchestrationResult {
  answer: string;
  recommendation: string;
  detectedLanguage: LanguageCode;
  /** True when Gemini planned/synthesised, false for the deterministic engine. */
  aiGenerated: boolean;
  plan: ExecutionPlan;
  selectedAgents: AgentType[];
  agentResults: AgentResult[];
  riskLevel: RiskLevel;
  /** Weighted 0-100 safety score used by the route agent too. */
  safetyScore: number;
  /** Departure-window risk series over the next 48 h, when forecast slots exist. */
  riskTrajectory?: RiskTrajectory;
  weatherData?: WeatherData;
  oceanData?: OceanData;
  tideReport?: TideReport;
  marineAlerts: MarineAlert[];
  pfzZone?: PFZZone;
  hotspots?: ProductivityHotspot[];
  distanceKm?: number;
  routeData?: RouteData;
  geofencingData?: GeofencingData;
  historicalData?: HistoricalData;
  visualizations: VisualizationData[];
  memory: ConversationMemory;
  sources: string[];
  evidence: EvidenceItem[];
  timestamp: string;
  disclaimer: string;
}
