/**
 * Calendar nudge — one-time toast prompting users to subscribe to the
 * CarSharing Google Calendar.
 *
 * Defaults:
 *   - localStorage key: "cs.calendarNudgeSeen"
 *   - Toast duration:   8 000 ms (longer than the sonner default of 4 000 ms,
 *                       giving users time to read + click the action button)
 *   - Action destination: the Google Calendar subscribe URL built from the
 *     calendarId returned by /api/calendar-id
 *     (https://calendar.google.com/calendar/r?cid=<calendarId>).
 *     If no calendarId is configured the nudge is skipped entirely.
 */

export const CALENDAR_NUDGE_KEY = "cs.calendarNudgeSeen";
export const CALENDAR_NUDGE_DURATION = 8_000;

/**
 * Pure predicate — returns true when the nudge has not been seen yet.
 * Accepts a storage stub so it can be tested without a real browser.
 */
export function shouldShowCalendarNudge(
  storage: Pick<Storage, "getItem">
): boolean {
  return storage.getItem(CALENDAR_NUDGE_KEY) === null;
}

/**
 * Marks the nudge as seen so it will not be shown again.
 */
export function markCalendarNudgeSeen(
  storage: Pick<Storage, "getItem" | "setItem">
): void {
  storage.setItem(CALENDAR_NUDGE_KEY, "1");
}
