/**
 * Visualization Agent — decides what the user should see, not just what they
 * can see.
 *
 * The domain agents already publish their own layers; this agent's job is the
 * editorial one: choose the primary rendering for the intent, guarantee a map
 * always exists, and order the set so the client renders the most important
 * card first.
 */

import { VisualizationData } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok } from './base';
import { haversineKm } from '../core/geo';

/** Preferred primary rendering per intent. */
const PRIMARY: Record<string, VisualizationData['type']> = {
  FIND_PFZ: 'map',
  PFZ_HOTSPOTS: 'heatmap',
  SAFETY_ASSESSMENT: 'map',
  TIDE_WEATHER_SEA: 'chart',
  HAZARD_ALERTS: 'map',
  SAFE_ROUTE: 'route',
  PRODUCTIVITY_DIAGNOSIS: 'timeseries',
  AVOID_ZONES: 'map',
  GEOFENCE_PROXIMITY: 'map',
  OCEAN_STATE: 'timeseries',
  WEATHER_BRIEF: 'timeseries',
  GENERAL_MARINE: 'map',
};

export const visualizationAgent: AgentDefinition = defineAgent(
  'VISUALIZATION_AGENT',
  (context: AgentContext) => {
    const existing = context.artifacts.visualizations ?? [];
    const intent = context.parsed.intent;
    const wanted = PRIMARY[intent] ?? 'map';

    // Guarantee a map: it is the one rendering that always carries meaning,
    // and a marine answer without geography is not an answer.
    const hasMap = existing.some((v) =>
      ['map', 'heatmap', 'route'].includes(v.type) && (v.geo?.circles?.length || v.geo?.polygons?.length || v.geo?.points?.length),
    );

    if (!hasMap) {
      const anchor = context.position;
      const zone = context.artifacts.activeZone;
      existing.push({
        id: 'viz-anchor-map',
        type: 'map',
        title: context.book.labels.map,
        subtitle: `${context.anchor.label} · ORCA reference position`,
        categories: [],
        series: [],
        geo: {
          points: [],
          circles: [
            {
              id: 'anchor',
              label: context.anchor.label,
              latitude: anchor.latitude,
              longitude: anchor.longitude,
              radiusKm: 8,
              color: '#22c55e',
              level: 'favorable' as const,
            },
            ...(zone
              ? [
                  {
                    id: zone.id,
                    label: zone.name,
                    latitude: zone.latitude,
                    longitude: zone.longitude,
                    radiusKm: zone.radiusKm,
                    color: '#38bdf8',
                    level: 'favorable' as const,
                  },
                ]
              : []),
          ],
          polygons: [],
        },
      });
    }

    // Reorder so the primary rendering comes first for the intent.
    const ordered = [...existing].sort((a, b) => {
      if (a.type === wanted && b.type !== wanted) return -1;
      if (b.type === wanted && a.type !== wanted) return 1;
      return 0;
    });

    context.artifacts.visualizations = ordered;

    const zone = context.artifacts.activeZone;
    const findings = [
      finding(
        `Selected ${ordered.length} rendering${ordered.length === 1 ? '' : 's'} for this answer, led by the ${wanted} view${zone ? ` centred on ${zone.name} ${roundKm(haversineKm(context.harbor, zone))} from the harbour` : ''}.`,
        {
          confidence: 0.85,
          evidence: ordered.map((v) => ev(v.title, v.type, 'ORCA viz planner')),
        },
      ),
    ];

    return ok(
      findings,
      context.book.ui.layersPreparedWord
        .replace('{n}', String(ordered.length))
        .replace('{view}', wanted),
      ['ORCA viz planner', 'Leaflet layer templates'],
    );
  },
);

const roundKm = (km: number): string => `${Math.round(km)} km`;
