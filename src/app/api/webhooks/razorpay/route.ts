import { NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/billing-core";
import { processRazorpayEvent, type RazorpayEvent } from "@/lib/billing-webhook";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (Dashboard > Settings > Webhooks):
 *   URL:    https://<your-domain>/api/webhooks/razorpay
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: subscription.activated, subscription.charged, subscription.pending, subscription.halted,
 *           subscription.cancelled, subscription.completed, subscription.resumed, payment.failed
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "Webhook secret not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }
  let evt: RazorpayEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await processRazorpayEvent(evt);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Razorpay webhook failed", e);
    // 500 so Razorpay retries transient failures
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
