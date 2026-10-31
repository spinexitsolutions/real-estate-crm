/**
 * The whole app runs in one business timezone (default India, Asia/Kolkata), so
 * "today", "overdue" and every displayed time are correct regardless of where the
 * server is hosted (Vercel/Supabase servers run in UTC).
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

export function applyAppTimezone() {
  if (typeof process !== "undefined" && process.env && process.env.TZ !== APP_TIMEZONE) {
    // Node re-reads TZ when it is assigned, so all Date / date-fns calls use it from here on.
    process.env.TZ = APP_TIMEZONE;
  }
}
