/** WhatsApp allows free-form messages only within 24 hours of the customer's last message. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWindowOpen(lastInboundAt: Date | string | null | undefined, now: Date = new Date()) {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  if (Number.isNaN(t)) return false;
  const diff = now.getTime() - t;
  return diff >= 0 && diff < WINDOW_MS;
}

/** Milliseconds left in the window (0 when closed). */
export function windowRemainingMs(lastInboundAt: Date | string | null | undefined, now: Date = new Date()) {
  if (!isWindowOpen(lastInboundAt, now)) return 0;
  return WINDOW_MS - (now.getTime() - new Date(lastInboundAt!).getTime());
}

export function windowRemainingLabel(lastInboundAt: Date | string | null | undefined, now: Date = new Date()) {
  const ms = windowRemainingMs(lastInboundAt, now);
  if (!ms) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** Variable keys usable as Meta template parameters, in {{1}}, {{2}} order. */
export const META_PARAM_KEYS = ["name", "agent", "company", "property", "price", "location", "date"] as const;

export function parseMetaParams(v: string | null | undefined) {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Status precedence so a late "delivered" webhook never overrides "read". */
const STATUS_RANK: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3 };

export function nextStatus(current: string, incoming: string) {
  if (incoming === "FAILED") return current === "READ" || current === "DELIVERED" ? current : "FAILED";
  const a = STATUS_RANK[current] ?? 0;
  const b = STATUS_RANK[incoming] ?? 0;
  return b > a ? incoming : current;
}
