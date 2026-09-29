/**
 * Planner Agent — intent to task graph.
 *
 * The planner is what makes ORCA an agentic system rather than a router. It
 *
 *   1. resolves the reference position and vessel from the parsed query and the
 *      conversation memory,
 *   2. decomposes the request into an ordered task graph with real dependencies
 *      (the route cannot be scored before the geofence scan, and nothing is
 *      visualised before the domain agents have produced data),
 *   3. selects the agent roster for round 1, and
 *   4. records which follow-up rounds are expected, so the collaboration trace
 *      in the UI shows a *plan*, not just a list of calls.
 *
 * `planWithGemini` in `server/gemini.ts` can refine this plan when an API key is
 * present; the plan produced here is always valid and is used verbatim as the
 * fallback so the platform is fully functional offline.
 */

import {
  AgentType,
  ConversationMemory,
  ExecutionPlan,
  HarborLocation,
  PlanStep,
  TimeHorizon,
} from '../types';
import { INTENT_CATALOG, IntentType, ParsedQuery } from '../core/intent';
import { HARBORS, HARBOR_BY_ID, VESSEL_BY_ID } from '../core/dataset';
import { Phrasebook, getPhrasebook } from '../core/i18n';
import { LatLon } from '../core/geo';

/** Roster for round 1, keyed by intent. Always starts with GIS to fix position. */
const BASE_ROSTER: Record<IntentType, AgentType[]> = {
  FIND_PFZ: ['GIS_AGENT', 'PFZ_AGENT', 'OCEAN_AGENT'],
  PFZ_HOTSPOTS: ['PFZ_AGENT', 'OCEAN_AGENT'],
  SAFETY_ASSESSMENT: [
    'GIS_AGENT',
    'WEATHER_AGENT',
    'OCEAN_AGENT',
    'TIDE_AGENT',
    'MARINE_ALERT_AGENT',
    'RISK_VALIDATION_AGENT',
    'GEOFENCING_AGENT',
    'VISUALIZATION_AGENT',
  ],
  TIDE_WEATHER_SEA: ['GIS_AGENT', 'TIDE_AGENT', 'WEATHER_AGENT', 'OCEAN_AGENT', 'VISUALIZATION_AGENT'],
  HAZARD_ALERTS: ['GIS_AGENT', 'MARINE_ALERT_AGENT', 'WEATHER_AGENT', 'OCEAN_AGENT', 'VISUALIZATION_AGENT'],
  SAFE_ROUTE: [
    'GIS_AGENT',
    'PFZ_AGENT',
    'ROUTE_OPTIMIZATION_AGENT',
    'GEOFENCING_AGENT',
    'MARINE_ALERT_AGENT',
    'RISK_VALIDATION_AGENT',
    'VISUALIZATION_AGENT',
  ],
  PRODUCTIVITY_DIAGNOSIS: ['GIS_AGENT', 'HISTORICAL_ANALYSIS_AGENT', 'PFZ_AGENT', 'OCEAN_AGENT', 'VISUALIZATION_AGENT'],
  AVOID_ZONES: ['GIS_AGENT', 'GEOFENCING_AGENT', 'MARINE_ALERT_AGENT', 'RISK_VALIDATION_AGENT', 'VISUALIZATION_AGENT'],
  GEOFENCE_PROXIMITY: ['GIS_AGENT', 'GEOFENCING_AGENT', 'VISUALIZATION_AGENT'],
  OCEAN_STATE: ['GIS_AGENT', 'OCEAN_AGENT', 'WEATHER_AGENT', 'VISUALIZATION_AGENT'],
  WEATHER_BRIEF: ['GIS_AGENT', 'WEATHER_AGENT', 'OCEAN_AGENT', 'VISUALIZATION_AGENT'],
  GENERAL_MARINE: [
    'GIS_AGENT',
    'WEATHER_AGENT',
    'OCEAN_AGENT',
    'TIDE_AGENT',
    'MARINE_ALERT_AGENT',
    'PFZ_AGENT',
    'GEOFENCING_AGENT',
    'RISK_VALIDATION_AGENT',
    'VISUALIZATION_AGENT',
  ],
};

/** Follow-up rounds: what a specialist can ask for after round 1. */
const FOLLOW_UPS: Record<string, string[]> = {
  RISK_VALIDATION_AGENT: [
    'Cross-check the composite verdict against the vessel profile limits',
    'Re-rank contributors and state the counterfactual that would improve the verdict',
  ],
  GEOFENCING_AGENT: [
    'Scan the plotted corridor for regulated zones, not just the position',
  ],
  MARINE_ALERT_AGENT: ['Re-join advisory geometry against the resolved position'],
  ROUTE_OPTIMIZATION_AGENT: ['Generate offset corridors and score each on the safety index'],
  VISUALIZATION_AGENT: ['Guarantee a map layer and order the renderings for the client'],
};

export interface PlanOutcome {
  plan: ExecutionPlan;
  /** Reference point every agent will reason about. */
  position: LatLon;
  harbor: HarborLocation;
  vesselId: string;
  book: Phrasebook;
  /** True when a follow-up round is expected. */
  needsRound2: boolean;
}

/**
 * Build the execution plan for a turn.
 *
 * @param parsed   Output of `parseQuery`.
 * @param memory   Prior conversation state, used for anaphora.
 * @param override Optional roster from the Gemini planner, which may only
 *                 *add* agents, never drop a safety-critical one.
 */
export function buildPlan(
  parsed: ParsedQuery,
  memory: ConversationMemory,
  override?: { roster?: AgentType[]; reasoning?: string; horizon?: TimeHorizon },
  opts: { anchorHarborId?: string } = {},
): PlanOutcome {
  const harbor = resolveHarbor(parsed, memory, opts.anchorHarborId);
  const vesselId = parsed.vesselId || memory.lastVesselType || 'motorized_dinghy';
  const vessel = VESSEL_BY_ID[vesselId] ?? VESSEL_BY_ID.motorized_dinghy;
  const book = getPhrasebook(parsed.language);

  const horizon = override?.horizon ?? parsed.horizon;

  // The reference position follows the conversation: an established fishing
  // ground is the natural anchor for "is it safe there", whereas a fresh
  // question with a named harbour anchors on the harbour.
  const rememberZone = parsed.referencesContext && memory.activeZone !== undefined;
  const position: LatLon = rememberZone
    ? { latitude: memory.activeZone!.latitude, longitude: memory.activeZone!.longitude }
    : { latitude: harbor.latitude, longitude: harbor.longitude };

  let roster = [...(BASE_ROSTER[parsed.intent] ?? BASE_ROSTER.GENERAL_MARINE)];

  // Facet escalation: an explicit mention of tide/weather/sea/alerts in an
  // otherwise different question still deserves the matching specialist.
  const escalations: AgentType[] = [];
  if (parsed.facets.tide && !roster.includes('TIDE_AGENT')) escalations.push('TIDE_AGENT');
  if (parsed.facets.weather && !roster.includes('WEATHER_AGENT')) escalations.push('WEATHER_AGENT');
  if (parsed.facets.ocean && !roster.includes('OCEAN_AGENT')) escalations.push('OCEAN_AGENT');
  if (parsed.facets.alerts && !roster.includes('MARINE_ALERT_AGENT')) escalations.push('MARINE_ALERT_AGENT');
  if (escalations.length > 0) {
    roster = [...roster, ...escalations, 'VISUALIZATION_AGENT', 'RISK_VALIDATION_AGENT'];
  }

  if (override?.roster && override.roster.length > 0) {
    roster = mergeRoster(roster, override.roster);
  }

  roster = dedupe(roster);
  // Visualisation is always last so it sees every other agent's output.
  roster = roster.filter((a) => a !== 'VISUALIZATION_AGENT');
  roster.push('VISUALIZATION_AGENT');

  const steps = buildSteps(parsed, roster, horizon, rememberZone);
  const followUps = roster
    .filter((agent) => FOLLOW_UPS[agent])
    .map((agent) => `${agent.replace(/_AGENT$/, '').replace(/_/g, ' ').toLowerCase()}: ${FOLLOW_UPS[agent][0]}`);

  const reasoning =
    override?.reasoning?.trim() ||
    buildReasoning(parsed, harbor, rememberZone, escalations, roster);

  return {
    plan: {
      intent: parsed.intent,
      intentConfidence: parsed.intentConfidence,
      horizon,
      reasoning,
      steps,
      agents: roster,
      followUps,
    },
    position,
    harbor,
    vesselId: vessel.id,
    book,
    needsRound2: followUps.length > 0,
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function resolveHarbor(
  parsed: ParsedQuery,
  memory: ConversationMemory,
  anchorHarborId?: string,
): HarborLocation {
  // A harbour named in the utterance always wins; otherwise the caller-supplied
  // anchor (the harbour the user picked or the GPS-resolved one) beats the
  // planner's fallback of the default harbour, so the plan's "anchored on …"
  // reasoning can never contradict the harbour the report is actually about.
  const id =
    parsed.harborId ??
    parsed.originHarborId ??
    anchorHarborId ??
    (parsed.referencesContext ? memory.activeHarborId : undefined);

  if (id && HARBOR_BY_ID[id]) return HARBOR_BY_ID[id];
  return HARBORS[0];
}

function dedupe(agents: AgentType[]): AgentType[] {
  return [...new Set(agents)];
}

/** Safety-critical agents may never be dropped by an external planner. */
const MANDATORY: AgentType[] = ['GIS_AGENT', 'MARINE_ALERT_AGENT', 'RISK_VALIDATION_AGENT'];

function mergeRoster(base: AgentType[], proposed: AgentType[]): AgentType[] {
  const merged = dedupe([...base, ...proposed]);
  for (const agent of MANDATORY) {
    if (!merged.includes(agent)) merged.push(agent);
  }
  return merged;
}

function buildSteps(
  parsed: ParsedQuery,
  roster: AgentType[],
  horizon: TimeHorizon,
  rememberZone: boolean,
): PlanStep[] {
  return roster.map((agent) => {
    const dependsOn: string[] = [];

    if (agent === 'GIS_AGENT') {
      // GIS is the root of the graph: everything spatial depends on it.
    } else if (agent === 'PFZ_AGENT') {
      dependsOn.push(stepIdFor('GIS_AGENT'));
    } else if (agent === 'ROUTE_OPTIMIZATION_AGENT') {
      dependsOn.push(stepIdFor('GIS_AGENT'), stepIdFor('PFZ_AGENT'));
    } else if (agent === 'GEOFENCING_AGENT') {
      dependsOn.push(
        roster.includes('ROUTE_OPTIMIZATION_AGENT')
          ? stepIdFor('ROUTE_OPTIMIZATION_AGENT')
          : stepIdFor('GIS_AGENT'),
      );
    } else if (agent === 'RISK_VALIDATION_AGENT') {
      dependsOn.push(
        ...(['WEATHER_AGENT', 'OCEAN_AGENT', 'MARINE_ALERT_AGENT', 'GEOFENCING_AGENT'] as AgentType[])
          .filter((a) => roster.includes(a))
          .map(stepIdFor),
      );
    } else if (agent === 'VISUALIZATION_AGENT') {
      dependsOn.push(...roster.filter((a) => a !== 'VISUALIZATION_AGENT').map(stepIdFor));
    }

    return {
      id: stepIdFor(agent),
      goal: goalFor(agent, parsed, horizon, rememberZone),
      agents: [agent],
      dependsOn,
      status: 'PENDING' as const,
    };
  });
}

const STEP_IDS: Partial<Record<AgentType, string>> = {
  GIS_AGENT: 'locate',
  PFZ_AGENT: 'ground',
  ROUTE_OPTIMIZATION_AGENT: 'route',
  GEOFENCING_AGENT: 'geofence',
  RISK_VALIDATION_AGENT: 'validate',
  VISUALIZATION_AGENT: 'visualise',
};

const stepIdFor = (agent: AgentType): string => STEP_IDS[agent] ?? agent.toLowerCase().replace(/_agent$/, '');

function goalFor(agent: AgentType, parsed: ParsedQuery, horizon: TimeHorizon, rememberZone: boolean): string {
  switch (agent) {
    case 'GIS_AGENT':
      return rememberZone
        ? 'Carry the previously agreed fishing ground forward as the reference position'
        : 'Resolve the reference position, distances and bearings for this question';
    case 'PFZ_AGENT':
      return parsed.intent === 'PFZ_HOTSPOTS'
        ? 'Scan the regional grid for high chlorophyll in the favourable thermal band'
        : 'Rank the Potential Fishing Zones reachable from the reference position';
    case 'WEATHER_AGENT':
      return `Assess wind, gust, visibility and lightning for ${horizon.toLowerCase().replace('_', ' ')}`;
    case 'OCEAN_AGENT':
      return 'Establish wave height, sea state, current and SST at the reference position';
    case 'TIDE_AGENT':
      return 'Predict tide height, range, tidal stream and transit windows for the harbour';
    case 'MARINE_ALERT_AGENT':
      return 'Check every IMD and INCOIS advisory for influence over the reference position';
    case 'GEOFENCING_AGENT':
      return 'Screen for maritime boundaries, MPAs and restricted waters on the corridor';
    case 'ROUTE_OPTIMIZATION_AGENT':
      return 'Compare a direct corridor against offset corridors on a safety index';
    case 'RISK_VALIDATION_AGENT':
      return 'Fuse every finding into one weighted, explainable go / no-go verdict';
    case 'HISTORICAL_ANALYSIS_AGENT':
      return 'Correlate landings against chlorophyll, SST, effort and rainfall over 36 months';
    case 'VISUALIZATION_AGENT':
      return 'Choose and order the maps, charts and tables that answer this question';
    default:
      return `Run ${agent.replace(/_/g, ' ').toLowerCase()}`;
  }
}

function buildReasoning(
  parsed: ParsedQuery,
  harbor: HarborLocation,
  rememberZone: boolean,
  escalations: AgentType[],
  roster: AgentType[],
): string {
  const label = INTENT_CATALOG[parsed.intent]?.label ?? 'Marine situation report';
  const anchor = rememberZone ? 'the fishing ground already in context' : `${harbor.shortName} (${harbor.state})`;
  const evidence = parsed.matchedTerms.length > 0
    ? ` Matched on: ${parsed.matchedTerms.slice(0, 4).map((t) => `“${t}”`).join(', ')}.`
    : '';
  const escalate = escalations.length > 0
    ? ` The question also mentions ${escalations.map((a) => a.replace(/_AGENT$/, '').replace(/_/g, ' ').toLowerCase()).join(' and ')}, so those specialists were added.`
    : '';
  const runnerUp = parsed.candidates[1];

  return (
    `Read as ${label} with ${(parsed.intentConfidence * 100).toFixed(0)}% confidence, horizon ${parsed.horizon.toLowerCase().replace('_', ' ')}, ` +
    `anchored on ${anchor}.${evidence}${escalate}` +
    (runnerUp ? ` The runner-up reading was ${runnerUp.intent.replace(/_/g, ' ').toLowerCase()} at ${runnerUp.score}.` : '') +
    ` Roster of ${roster.length} agents selected.`
  );
}
