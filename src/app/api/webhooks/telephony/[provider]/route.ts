import { runAsTenant } from "@/lib/db";
import { orgFromTelephonyKey } from "@/lib/webhook-tenant";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processTelephonyCallback, type TelephonyPayload } from "@/lib/telephony-webhook";

/**
 * Exotel / Knowlarity call status + incoming call callbacks.
 * POST (or GET for Exotel passthru) /api/webhooks/telephony/exotel?key=YOUR_KEY
 */
async function readPayload(req: Request): Promise<TelephonyPayload> {
  const url = new URL(req.url);
  const out: TelephonyPayload = {};
  url.searchParams.forEach((v, k) => {
    if (k !== "key") out[k] = v;
  });
  if (req.method === "GET") return out;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const data = await req.json();
      if (data && typeof data === "object") Object.assign(out, data);
    } else {
      const fd = await req.formData();
      fd.forEach((v, k) => {
        if (typeof v === "string") out[k] = v;
      });
    }
  } catch {
    /* empty or malformed body */
  }
  return out;
}

async function handle(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (provider !== "EXOTEL" && provider !== "KNOWLARITY") return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 404 });

  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "";
  const settings = await db.settings.findFirst({ select: { telephonyWebhookKey: true } });
  if (!settings?.telephonyWebhookKey || key !== settings.telephonyWebhookKey) {
    return NextResponse.json({ ok: false, error: "Invalid or missing key" }, { status: 401 });
  }

  const payload = await readPayload(req);
  try {
    const res = await processTelephonyCallback(provider, payload);
    return NextResponse.json(res);
  } catch (e) {
    console.error("Telephony webhook error", e);
    await db.integrationLog
      .create({ data: { source: provider, status: "ERROR", message: e instanceof Error ? e.message : String(e), payload: JSON.stringify(payload).slice(0, 8000) } })
      .catch(() => undefined);
    // Always 200 so the provider does not retry endlessly
    return NextResponse.json({ ok: false });
  }
}

async function tenantHandle(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const orgId = await orgFromTelephonyKey(req);
  if (!orgId) return NextResponse.json({ ok: false, error: "Invalid or missing key" }, { status: 401 });
  return runAsTenant(orgId, () => handle(req, ctx));
}

export const GET = tenantHandle;
export const POST = tenantHandle;
