import { TZDate } from "@date-fns/tz";

/**
 * The whole app runs in one business timezone (default India, Asia/Kolkata), so
 * "today", "overdue" and every displayed time are the same for every user and
 * correct regardless of where the server (Vercel/Supabase = UTC) or browser is.
 * Safe to import from both server and client code.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

/** Server only: make Node's Date / date-fns use the app timezone. */
export function applyAppTimezone() {
  if (typeof window === "undefined" && process.env.TZ !== APP_TIMEZONE) {
    // Node re-reads TZ when it is assigned.
    process.env.TZ = APP_TIMEZONE;
  }
}

/** A date viewed in the app timezone (date-fns functions then operate in that zone). */
export function inAppTz(d: Date | string | number) {
  return new TZDate(new Date(d).getTime(), APP_TIMEZONE);
}

/** "Now" in the app timezone. */
export function appNow() {
  return TZDate.tz(APP_TIMEZONE);
}

/** Parses an <input type="datetime-local"> value as app-timezone wall time and returns an ISO string. */
export function fromDateTimeLocal(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(value).toISOString();
  const [, y, mo, d, h, mi] = m.map(Number);
  return new TZDate(y, mo - 1, d, h, mi, APP_TIMEZONE).toISOString();
}
