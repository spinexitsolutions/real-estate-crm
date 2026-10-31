import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

export const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

export type Granularity = "day" | "week" | "month";

export function resolveRange(range: string | undefined, earliest?: Date) {
  const now = new Date();
  const key = RANGES.some((r) => r.value === range) ? (range as string) : "90d";
  let start: Date;
  switch (key) {
    case "7d":
      start = startOfDay(subDays(now, 6));
      break;
    case "30d":
      start = startOfDay(subDays(now, 29));
      break;
    case "12m":
      start = startOfMonth(subMonths(now, 11));
      break;
    case "ytd":
      start = startOfYear(now);
      break;
    case "all":
      start = startOfMonth(earliest ?? subMonths(now, 11));
      break;
    default:
      start = startOfDay(subDays(now, 89));
  }
  const days = differenceInCalendarDays(now, start) + 1;
  const granularity: Granularity = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  return { key, start, end: now, granularity, label: RANGES.find((r) => r.value === key)!.label };
}

function bucketStart(d: Date, g: Granularity) {
  if (g === "day") return startOfDay(d);
  if (g === "week") return startOfWeek(d, { weekStartsOn: 1 });
  return startOfMonth(d);
}

export function buildBuckets(start: Date, end: Date, g: Granularity) {
  const buckets: { key: number; label: string }[] = [];
  let cur = bucketStart(start, g);
  const fmt = g === "day" ? "dd MMM" : g === "week" ? "dd MMM" : "MMM yy";
  while (cur <= end) {
    buckets.push({ key: cur.getTime(), label: format(cur, fmt) });
    cur = g === "day" ? addDays(cur, 1) : g === "week" ? addWeeks(cur, 1) : addMonths(cur, 1);
  }
  return buckets;
}

export function bucketize<T>(items: T[], getDate: (t: T) => Date | null, getValue: (t: T) => number, start: Date, end: Date, g: Granularity) {
  const buckets = buildBuckets(start, end, g);
  const map = new Map(buckets.map((b) => [b.key, 0]));
  for (const it of items) {
    const d = getDate(it);
    if (!d) continue;
    const k = bucketStart(d, g).getTime();
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + getValue(it));
  }
  return buckets.map((b) => ({ label: b.label, value: map.get(b.key) ?? 0 }));
}
