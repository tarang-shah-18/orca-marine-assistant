/**
 * Common dashboard props.
 *
 * Every persona dashboard receives the same engine products — the proactive
 * brief, the map bundle and the engine roster — plus the handful of plumbing
 * callbacks the shell owns. Dashboards never fetch; they compose.
 */

import type { EngineStatus, MapBundle, SituationBrief } from '../../services/orcaApi';
import type { HarborLocation, LanguageOption, PFZZone } from '../../types';
import type { Persona } from '../../personas';

export interface DashboardProps {
  persona: Persona;
  harbor: HarborLocation;
  language: LanguageOption;
  brief: SituationBrief | null;
  briefOffline: boolean;
  briefLoading: boolean;
  bundle: MapBundle | null;
  bundleOffline: boolean;
  status: EngineStatus | null;
  onAsk: (question: string, harborId?: string) => void;
  onOpenMap: (zone?: PFZZone) => void;
}