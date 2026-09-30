/**
 * Clock and auto-refresh.
 *
 * The second prototype defect was "the data never updates and there is no clock".
 * Two things were wrong and both are here:
 *
 *   1. The client fetched once on mount and once per harbour/language change. A
 *      fisher who left the app open through an afternoon squall kept reading the
 *      morning's numbers, and nothing on screen said so — no age, no timestamp,
 *      no indication that "now" was twenty minutes ago. Silence looks like
 *      freshness, which for a safety product is the worst possible failure.
 *   2. There was no clock anywhere in the UI, so the one thing a user could have
 *      done by hand — compare the header against their own watch — was not
 *      available either.
 *
 * `useNow` supplies the ticking instant that renders both the clock and the
 * "updated N ago" age. `useAutoRefresh` supplies the poll, aligned to the
 * engine's own cache TTL so the client asks at the moment the answer could have
 * changed rather than on an arbitrary cadence.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * A `Date` that advances every `intervalMs`.
 *
 * Re-renders on a timer, so it belongs only on a small subtree — the freshness
 * strip — and never around a list. Every consumer here is small by design: the
 * alternative, re-rendering the dashboard once a second, would cost more than
 * the feature is worth on the phones this actually ships to.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/**
 * Calls `task` on a fixed interval, and immediately whenever the tab becomes
 * visible again.
 *
 * The visibility listener is the part that matters. A phone in a pocket stops
 * firing timers, so on return the app would sit on whatever it had when the
 * screen went dark — often hours old — and then wait out a full interval before
 * correcting itself. A user who opens the app at 06:00 to decide whether to
 * leave has to get the 06:00 answer immediately, not at 06:12.
 *
 * Also skips the initial call: the caller already fetches on mount, and running
 * both would double every cold start.
 *
 * @param task     the work to repeat; must be stable (wrap in useCallback)
 * @param intervalMs poll period
 * @param enabled  set false to stop polling entirely
 */
export function useAutoRefresh(
  task: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const latest = useRef(task);
  latest.current = task;

  useEffect(() => {
    if (!enabled) return;

    // Do not race the caller's own mount-time fetch, and do not pile a second
    // request onto one that is still in flight.
    let inFlight = false;
    const guarded = () => {
      if (inFlight) return;
      inFlight = true;
      void Promise.resolve(latest.current()).finally(() => {
        inFlight = false;
      });
    };

    const interval = window.setInterval(guarded, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') guarded();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [intervalMs, enabled]);
}

/** Whole seconds elapsed since `sinceMs`, never negative. */
export function secondsSince(sinceMs: number, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - sinceMs) / 1000));
}

/**
 * Wall-clock time in IST, as `HH:MM:SS`.
 *
 * Fixed to Asia/Kolkata rather than the viewer's zone on purpose. Every product
 * ORCA reports on is an Indian port, the engine stamps its reference cycle in
 * IST, and a fisher comparing the screen against an IMD bulletin is comparing
 * against IST. Showing a device-local clock next to an IST bulletin would make
 * them disagree by half an hour for no reason.
 *
 * Falls back to UTC if the runtime has no full ICU, which is the honest answer:
 * the label beside it always says which zone it is.
 */
export function istClock(now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 19);
  }
}
