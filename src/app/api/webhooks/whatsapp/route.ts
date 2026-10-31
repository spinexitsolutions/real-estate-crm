import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSettings } from "@/lib/settings";
import { processWhatsAppWebhook, verifySignature, type WaWebhookPayload } from "@/lib/whatsapp-inbound";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
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
export async function POST(req: Request) {
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
