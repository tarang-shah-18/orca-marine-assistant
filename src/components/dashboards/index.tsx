import React from 'react';
import { PERSONA_BY_ID, PersonaId } from '../../personas';
import type { DashboardProps } from './common';
import { getPhrasebook } from '../../core/i18n';
import { CoastalDashboard } from './CoastalDashboard';
import { DisasterDashboard } from './DisasterDashboard';
import { FisherDashboard } from './FisherDashboard';
import { MaritimeDashboard } from './MaritimeDashboard';
import { ResearcherDashboard } from './ResearcherDashboard';

/** Persona chrome keyed by id so the mission strip localizes per language. */
const PERSONA_UI_KEYS = {
  fisher: { label: 'personaFisher', tag: 'tagFisher', desc: 'descFisher' },
  researcher: { label: 'personaResearcher', tag: 'tagResearcher', desc: 'descResearcher' },
  coastal: { label: 'personaCoastal', tag: 'tagCoastal', desc: 'descCoastal' },
  disaster: { label: 'personaDisaster', tag: 'tagDisaster', desc: 'descDisaster' },
  maritime: { label: 'personaMaritime', tag: 'tagMaritime', desc: 'descMaritime' },
} as const;

/**
 * Persona dashboard router.
 *
 * All five missions read the same engine products; only the arrangement and
 * emphasis differ. The header strip above presents the persona identity and
 * its mission one-liner.
 */
export const PersonaDashboard: React.FC<DashboardProps & { personaId: PersonaId }> = ({
  personaId,
  ...rest
}) => {
  const persona = PERSONA_BY_ID[personaId];
  const Icon = persona.icon;
  const ui = getPhrasebook(rest.language.code).ui;
  const keys = PERSONA_UI_KEYS[personaId];
  const accentText: Record<string, string> = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    sky: 'text-sky-400',
  };

  return (
    <div className="space-y-4">
      {/* Mission strip */}
      <header className="flex items-center gap-3">
        <span
          className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-700 bg-slate-900/70 ${accentText[persona.accent]}`}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-50 leading-tight">{ui[keys.label]}</h1>
          <p className="text-[11px] text-slate-400 truncate">{ui[keys.tag]}</p>
        </div>
        <p className="hidden lg:block ml-auto max-w-md text-right text-[11px] text-slate-500 leading-snug">
          {ui[keys.desc]}
        </p>
      </header>

      {personaId === 'fisher' && <FisherDashboard {...rest} />}
      {personaId === 'researcher' && <ResearcherDashboard {...rest} />}
      {personaId === 'coastal' && <CoastalDashboard {...rest} />}
      {personaId === 'disaster' && <DisasterDashboard {...rest} />}
      {personaId === 'maritime' && <MaritimeDashboard {...rest} />}
    </div>
  );
};