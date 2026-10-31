import { runAsTenant } from "@/lib/db";
import { orgFromParam } from "@/lib/webhook-tenant";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { logIntegration } from "@/lib/integrations";
import { processLeadgen } from "@/lib/facebook-leads";

/**
 * Facebook / Instagram Lead Ads webhook.
 * Meta app > Webhooks > Page > subscribe to "leadgen", callback = /api/webhooks/facebook
 */

async function getInTenant(req: Request) {
  const sp = new URL(req.url).searchParams;
  const settings = await db.settings.findFirst({ select: { fbVerifyToken: true } });
  if (sp.get("hub.mode") === "subscribe" && settings?.fbVerifyToken && sp.get("hub.verify_token") === settings.fbVerifyToken) {
    return new Response(sp.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function postInTenant(req: Request) {
  const raw = await req.text();
  const settings = await db.settings.findFirst({ select: { fbAppSecret: true, fbPageAccessToken: true } });
  if (settings?.fbAppSecret && !validSignature(raw, req.headers.get("x-hub-signature-256"), settings.fbAppSecret)) {
    await logIntegration("FACEBOOK", "ERROR", "Rejected webhook: invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    const body = JSON.parse(raw || "{}") as { object?: string; entry?: { changes?: { field?: string; value?: Record<string, string> }[] }[] };
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen" && change.value) await processLeadgen(change.value, settings?.fbPageAccessToken ?? null);
        else await logIntegration("FACEBOOK", "IGNORED", `Ignored event: ${change.field ?? "unknown"}`, change);
      }
    }
  } catch (e) {
    console.error("Facebook webhook failed", e);
    await logIntegration("FACEBOOK", "ERROR", "Could not process webhook payload", raw.slice(0, 2000));
  }
  // Always 200 so Meta does not disable the subscription
  return NextResponse.json({ ok: true });
}

/** Webhook URL per company: /api/webhooks/facebook?org=<organization id> (shown on the Integrations page). */
export async function GET(req: Request) {
  const orgId = await orgFromParam(req);
  if (!orgId) return new Response("Unknown organization", { status: 403 });
  return runAsTenant(orgId, () => getInTenant(req));
}

export async function POST(req: Request) {
  const orgId = await orgFromParam(req);
  if (!orgId) return Response.json({ ok: false, error: "Unknown organization" }, { status: 200 });
  return runAsTenant(orgId, () => postInTenant(req));
}
