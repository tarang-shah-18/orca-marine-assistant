import { CANONICAL_SCENARIOS } from '../../server/scenarios';
import type { LanguageCode } from '../../types';

/**
 * Localized label for a quick-ask chip that mirrors one of the eight canonical
 * capabilities. The chip sends the (English) canonical query to the engine —
 * intent detection is language-neutral — while the visible label follows the
 * currently selected language via the scenario's own translation.
 */
export function scenarioChipText(language: LanguageCode, scenarioId: string): string {
  const scenario = CANONICAL_SCENARIOS.find((s) => s.id === scenarioId);
  const row =
    scenario?.translations.find((t) => t.language === language) ??
    scenario?.translations.find((t) => t.language === 'en-IN');
  return row?.text ?? '';
}

/** A quick-ask chip: the raw query sent to the engine + the localized label shown. */
export interface QuickAsk {
  q: string;
  label: string;
}