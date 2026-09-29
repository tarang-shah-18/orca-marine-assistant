/**
 * ORCA personas.
 *
 * The platform serves five distinct missions — a fisher's go/no-go decision,
 * a researcher's productivity science, a coastal authority's compliance
 * picture, a disaster manager's escalation watch and a maritime authority's
 * corridor oversight. Each persona owns a dashboard composed of the same
 * engine data, arranged for that mission, plus quick questions that seed the
 * shared decision chat.
 */

import {
  Anchor,
  Fish,
  FlaskConical,
  Landmark,
  LucideIcon,
  Siren,
} from 'lucide-react';

export type PersonaId = 'fisher' | 'researcher' | 'coastal' | 'disaster' | 'maritime';

export type Accent = 'cyan' | 'violet' | 'amber' | 'rose' | 'sky' | 'emerald';

export interface Persona {
  id: PersonaId;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  /** Questions that open straight into the decision chat. */
  quickAsk: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: 'fisher',
    label: 'Fisher',
    shortLabel: 'Fisher',
    tagline: 'Go / no-go at the dock',
    description:
      'PFZ grounds, safe-to-venture verdicts, tides, weather and the corridor home — tuned for the small craft.',
    icon: Fish,
    accent: 'cyan',
    quickAsk: [
      'Where is the nearest fishing zone from here?',
      'Is it safe to venture out tomorrow morning?',
      'What are the tide and weather like near my fishing location today?',
      'Any lightning or cyclone alerts near my harbour?',
      'Which zones should I avoid while fishing today?',
    ],
  },
  {
    id: 'researcher',
    label: 'Researcher',
    shortLabel: 'Research',
    tagline: 'Productivity & trend science',
    description:
      'Chlorophyll, SST and landing-index time series, decline diagnoses, hotspot scans and correlation analysis.',
    icon: FlaskConical,
    accent: 'violet',
    quickAsk: [
      'Why has fish productivity declined in my region?',
      'Show the chlorophyll and SST trend for the last three years.',
      'Which regions show high chlorophyll and favourable sea surface temperature?',
      'What factors correlate with the landing index here?',
    ],
  },
  {
    id: 'coastal',
    label: 'Coastal Authority',
    shortLabel: 'Coastal',
    tagline: 'Jurisdiction compliance picture',
    description:
      'Active advisories along the coast, regulated water boundaries, and the vessels placed against them.',
    icon: Landmark,
    accent: 'amber',
    quickAsk: [
      'Which zones should vessels avoid near my jurisdiction?',
      'List the active marine alerts on this coast.',
      'Are any geofence boundaries close to this harbour?',
      'What regulations apply to the restricted waters here?',
    ],
  },
  {
    id: 'disaster',
    label: 'Disaster Management',
    shortLabel: 'Disaster',
    tagline: 'Escalation & response watch',
    description:
      'Severity-ranked warnings, risk levels and the operational action each bulletin prescribes.',
    icon: Siren,
    accent: 'rose',
    quickAsk: [
      'Any lightning or cyclone alerts active right now?',
      'Is it safe to venture out tomorrow?',
      'Which parts of the coast are under a HIGH or SEVERE advisory?',
      'What action is prescribed for the current alerts?',
    ],
  },
  {
    id: 'maritime',
    label: 'Maritime Authority',
    shortLabel: 'Maritime',
    tagline: 'Voyage & corridor oversight',
    description:
      'Route corridors, leg-by-leg risk, geofence conflicts and vessel-specific transit safety.',
    icon: Anchor,
    accent: 'sky',
    quickAsk: [
      'What is the safest route from my harbour for a trawler?',
      'Which regulated zones lie along the planned corridor?',
      'Show the risk level of each leg of the route.',
      'Can I get from here to the nearest fishing zone safely?',
    ],
  },
];

export const PERSONA_BY_ID: Record<PersonaId, Persona> = PERSONAS.reduce(
  (map, persona) => {
    map[persona.id] = persona;
    return map;
  },
  {} as Record<PersonaId, Persona>,
);