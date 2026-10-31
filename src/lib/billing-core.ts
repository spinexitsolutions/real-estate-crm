/**
 * Pure billing helpers (no database / server-only imports) so they can be unit tested.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const FEATURES = {
  leads: "Lead management",
  pipeline: "Sales pipeline",
  followups: "Follow-up reminders",
  properties: "Property inventory",
  whatsapp_link: "WhatsApp click-to-chat",
  reports: "Reports & analytics",
  brochure: "Property brochure PDF",
  mobile: "Mobile app (PWA)",
  whatsapp_api: "WhatsApp Business API, inbox & broadcast",
  portal_integrations: "Facebook, 99acres, MagicBricks & Housing leads",
  website: "Public property website",
  bookings: "Bookings, payment plans & receipts",
  customer_portal: "Customer portal",
  documents: "Documents & KYC",
  attendance: "Attendance & site check-in",
  click_to_call: "Click-to-call & call recording",
  api_access: "API access",
  priority_support: "Priority support",
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const ALL_FEATURES = Object.keys(FEATURES) as FeatureKey[];

export type PlanLike = {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxLeads: number;
  maxProperties: number;
  features: string;
  sortOrder?: number;
  active?: boolean;
};

export function planFeatures(plan: Pick<PlanLike, "features"> | null | undefined): FeatureKey[] {
  if (!plan) return [...ALL_FEATURES];
  return plan.features
    .split(",")
    .map((f) => f.trim())
    .filter((f): f is FeatureKey => f in FEATURES);
}

/**
 * Whether an organization may use a feature. Organizations without a plan (e.g. created before
 * plans existed) get everything; otherwise the plan's feature list applies (trial uses the trial plan).
 */
export function hasFeature(plan: Pick<PlanLike, "features"> | null | undefined, key: FeatureKey) {
  return planFeatures(plan).includes(key);
}

/** Cheapest active plan that includes `key` (for "Upgrade to X" prompts). */
export function cheapestPlanWith<T extends PlanLike>(plans: T[], key: FeatureKey): T | null {
  return (
    [...plans]
      .filter((p) => p.active !== false && hasFeature(p, key))
      .sort((a, b) => a.priceMonthly - b.priceMonthly)[0] ?? null
  );
}

export type LimitKind = "users" | "leads" | "properties";
export const LIMIT_LABEL: Record<LimitKind, { one: string; many: string }> = {
  users: { one: "user", many: "users" },
  leads: { one: "lead", many: "leads" },
  properties: { one: "property", many: "properties" },
};

export function limitOf(plan: Pick<PlanLike, "maxUsers" | "maxLeads" | "maxProperties"> | null | undefined, kind: LimitKind) {
  if (!plan) return 0;
  return kind === "users" ? plan.maxUsers : kind === "leads" ? plan.maxLeads : plan.maxProperties;
}

/** How many more items can be added (Infinity when unlimited, i.e. limit 0). */
export function remainingCapacity(limit: number, used: number) {
  if (!limit || limit <= 0) return Infinity;
  return Math.max(0, limit - used);
}

export function limitMessage(planName: string, kind: LimitKind, limit: number) {
  const l = LIMIT_LABEL[kind];
  return `Your ${planName} plan allows ${limit.toLocaleString("en-IN")} ${limit === 1 ? l.one : l.many}. Upgrade your plan to add more.`;
}

/** Usage percentage for meters (0 when unlimited). */
export function usagePercent(used: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

// ---------------------------------------------------------------- GST

export const GST_RATE = 0.18;

export type GstSplit = { taxable: number; cgst: number; sgst: number; igst: number; total: number; intraState: boolean };

/**
 * Splits an amount that INCLUDES 18% GST. Same state as the seller -> CGST 9% + SGST 9%;
 * different or unknown state -> IGST 18%.
 */
export function splitGstInclusive(totalInclGst: number, sellerState?: string | null, buyerState?: string | null): GstSplit {
  const total = Math.round(totalInclGst * 100) / 100;
  const taxable = Math.round((total / (1 + GST_RATE)) * 100) / 100;
  const tax = Math.round((total - taxable) * 100) / 100;
  const intraState = !!sellerState && !!buyerState && sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase();
  if (intraState) {
    const half = Math.round((tax / 2) * 100) / 100;
    return { taxable, cgst: half, sgst: Math.round((tax - half) * 100) / 100, igst: 0, total, intraState };
  }
  return { taxable, cgst: 0, sgst: 0, igst: tax, total, intraState };
}

/** Price charged for a plan including 18% GST (rupees, rounded). */
export function priceWithGst(price: number) {
  return Math.round(price * (1 + GST_RATE));
}

/** Yearly saving vs paying monthly for 12 months, as a whole percentage. */
export function yearlySavingPercent(monthly: number, yearly: number) {
  if (!monthly || !yearly) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

// ---------------------------------------------------------------- invoices

export function formatInvoiceNumber(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(5, "0")}`;
}

/** Next sequence number given the last invoice number for the year (e.g. INV-2026-00012 -> 13). */
export function nextInvoiceSeq(lastNumber: string | null | undefined, year: number) {
  if (!lastNumber) return 1;
  const m = lastNumber.match(/^INV-(\d{4})-(\d+)$/);
  if (!m || Number(m[1]) !== year) return 1;
  return Number(m[2]) + 1;
}

// ---------------------------------------------------------------- Razorpay signatures

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Webhook: X-Razorpay-Signature = HMAC_SHA256(rawBody, webhookSecret) hex. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null | undefined, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Checkout success: signature = HMAC_SHA256(`${payment_id}|${subscription_id}`, keySecret) hex. */
export function verifySubscriptionPayment(paymentId: string, subscriptionId: string, signature: string, keySecret: string) {
  if (!paymentId || !subscriptionId || !signature || !keySecret) return false;
  const expected = createHmac("sha256", keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Maps a Razorpay subscription event to our organization status. */
export function statusForSubscriptionEvent(event: string): "ACTIVE" | "PAST_DUE" | "CANCELLED" | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "ACTIVE";
    case "subscription.pending":
    case "subscription.halted":
      return "PAST_DUE";
    case "subscription.cancelled":
    case "subscription.completed":
      return "CANCELLED";
    default:
      return null;
  }
}
