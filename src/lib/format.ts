import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";

export function formatCurrency(value: number | null | undefined, currency = "INR") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact currency: 1.25 Cr, 45 L, 12.5 K for INR; 1.2M style for others. */
export function formatCompact(value: number | null | undefined, currency = "INR") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (currency === "INR") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    const trim = (n: number) => (Math.round(n * 100) / 100).toString();
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)} K`;
    return `${sign}₹${Math.round(abs)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatBudget(min?: number | null, max?: number | null, currency = "INR") {
  if (!min && !max) return "Not specified";
  if (min && max) return `${formatCompact(min, currency)} - ${formatCompact(max, currency)}`;
  if (max) return `Up to ${formatCompact(max, currency)}`;
  return `From ${formatCompact(min, currency)}`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy");
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy, h:mm a");
}

export function formatTime(d: Date | string) {
  return format(new Date(d), "h:mm a");
}

export function formatRelative(d: Date | string | null | undefined) {
  if (!d) return "-";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function formatDueLabel(d: Date | string) {
  const date = new Date(d);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "h:mm a")}`;
  return format(date, "dd MMM, h:mm a");
}

/** Value for <input type="datetime-local"> */
export function toDateTimeLocal(d: Date | string | null | undefined) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

export function percent(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}
