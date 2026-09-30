/**
 * Freshness strip — the live clock and the age of the data on screen.
 *
 * This component is the direct answer to "the data never updates and there is no
 * clock". It states three things, in this order, because this is the order a
 * fisher needs them:
 *
 *   1. **how old the numbers are** — the safety-critical one. A silent product
 *      serving a twenty-minute-old situation report is indistinguishable from a
 *      fresh one, so the age is always on screen and never rounded up to "just
 *      now" to look better than it is;
 *   2. **that it refreshes on its own** — so the age is a countdown to
 *      something, not a defect;
 *   3. **the wall clock in IST** — so the age can be checked against reality.
 *
 * All three are localized, because a readout the user cannot read is the same
 * as no readout. The `IST` token and the numbers stay Latin, as they appear on
 * every bulletin the reader will compare this against.
 */

import React from 'react';
import { fillTemplate, Phrasebook } from '../core/i18n';
import { istClock, secondsSince, useNow } from '../hooks/useNow';

/** How the poll interval is described to the user, in minutes. */
const AUTO_REFRESH_MINUTES = 12;

interface FreshnessStripProps {
  book: Phrasebook;
  /**
   * When this data reached the client, or null if nothing has loaded yet. The
   * strip then says nothing about age rather than claiming "just now" before the
   * first response has landed.
   */
  receivedAt: number | null;
  loading: boolean;
}

/** Pick the coarsest honest unit: seconds under a minute, then minutes, then hours. */
function ageWord(ui: Phrasebook['ui'], seconds: number): string {
  if (seconds < 10) return ui.updatedJustNowWord;
  if (seconds < 60) return fillTemplate(ui.updatedSecondsAgoWord, { n: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return fillTemplate(ui.updatedMinutesAgoWord, { n: minutes });
  return fillTemplate(ui.updatedHoursAgoWord, { n: Math.floor(minutes / 60) });
}

export const FreshnessStrip: React.FC<FreshnessStripProps> = ({ book, receivedAt, loading }) => {
  const ui = book.ui;
  // One tick per second is only needed for the "N s ago" band; once the readout
  // is in minutes the extra renders buy nothing. The clock wants every second
  // though, so the tick stays at one second and is simply not re-read below.
  const now = useNow(1000);

  const seconds = receivedAt === null ? null : secondsSince(receivedAt, now);
  const text = loading ? ui.refreshingNowWord : seconds === null ? ui.refreshingNowWord : ageWord(ui, seconds);

  return (
    <div
      className="flex items-center gap-2.5 text-[10px] tabular-nums"
      title={fillTemplate(ui.autoRefreshWord, { n: AUTO_REFRESH_MINUTES })}
    >
      <span
        className={`font-mono font-semibold ${loading ? 'text-cyan-300' : 'text-slate-300'}`}
        aria-live="polite"
      >
        {text}
      </span>
      <span className="text-slate-600">·</span>
      <span className="font-mono text-slate-400">{istClock(now)}</span>
      <span className="text-slate-600 text-[9px] font-bold">IST</span>
    </div>
  );
};

export default FreshnessStrip;
