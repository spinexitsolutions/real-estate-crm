import "server-only";

/**
 * Minimal Razorpay REST client (Subscriptions + Plans) using fetch, no SDK.
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 */

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function rzp<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!isRazorpayConfigured()) throw new RazorpayError("Razorpay is not configured", 503);
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!res.ok) throw new RazorpayError(json.error?.description || `Razorpay request failed (${res.status})`, res.status);
  return json;
}

export type RzpSubscription = {
  id: string;
  plan_id: string;
  status: string; // created | authenticated | active | pending | halted | cancelled | completed | expired
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  short_url?: string;
  notes?: Record<string, string>;
};

export function createSubscription(input: { planId: string; totalCount: number; notes: Record<string, string>; startAt?: number }) {
  return rzp<RzpSubscription>("/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      total_count: input.totalCount,
      customer_notify: 1,
      notes: input.notes,
      ...(input.startAt ? { start_at: input.startAt } : {}),
    },
  });
}

export function fetchSubscription(id: string) {
  return rzp<RzpSubscription>(`/subscriptions/${encodeURIComponent(id)}`);
}

export function cancelSubscription(id: string, atCycleEnd = true) {
  return rzp<RzpSubscription>(`/subscriptions/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 } });
}

export type RzpPlan = { id: string; period: string; interval: number; item: { name: string; amount: number; currency: string } };

export function createPlan(input: { period: "monthly" | "yearly"; name: string; amountPaise: number; description?: string; notes?: Record<string, string> }) {
  return rzp<RzpPlan>("/plans", {
    method: "POST",
    body: {
      period: input.period,
      interval: 1,
      item: { name: input.name, amount: input.amountPaise, currency: "INR", description: input.description ?? "" },
      notes: input.notes ?? {},
    },
  });
}
