import { runAsTenant } from "@/lib/db";
import { orgFromParam, orgFromWaPhoneNumberId } from "@/lib/webhook-tenant";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSettings } from "@/lib/settings";
import { processWhatsAppWebhook, verifySignature, type WaWebhookPayload } from "@/lib/whatsapp-inbound";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
async function getInTenant(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const settings = await getSettings();
  if (mode === "subscribe" && settings.waVerifyToken && token === settings.waVerifyToken) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Incoming messages and delivery status updates from WhatsApp Cloud API. */
async function postInTenant(req: Request) {
  const raw = await req.text();
  const settings = await getSettings();
  if (settings.waAppSecret && !verifySignature(raw, req.headers.get("x-hub-signature-256"), settings.waAppSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }
  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await processWhatsAppWebhook(payload);
    if (result.received || result.statuses) revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("WhatsApp webhook error", e);
    // Still 200 so Meta does not retry forever; error is logged.
    return NextResponse.json({ ok: false });
  }
}

/** Webhook URL per company: /api/webhooks/whatsapp?org=<organization id> (shown in Settings). */
export async function GET(req: Request) {
  const orgId = await orgFromParam(req);
  if (!orgId) return new Response("Unknown organization", { status: 403 });
  return runAsTenant(orgId, () => getInTenant(req));
}

export async function POST(req: Request) {
  let orgId = await orgFromParam(req);
  if (!orgId) {
    // Fallback: route by the business phone number that received the message
    try {
      const body = JSON.parse(await req.clone().text()) as { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[] };
      const phoneId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      orgId = await orgFromWaPhoneNumberId(phoneId);
    } catch {
      /* invalid JSON - rejected below */
    }
  }
  if (!orgId) return Response.json({ ok: false, error: "Unknown organization" }, { status: 200 });
  return runAsTenant(orgId, () => postInTenant(req));
}
