import { runAsTenant } from "@/lib/db";
import { orgFromLeadKey } from "@/lib/webhook-tenant";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LEAD_SOURCES } from "@/lib/constants";
import { intakeLead, matchOption, parseBudget } from "@/lib/lead-intake";

/**
 * Lead capture webhook for website forms, landing pages, Zapier, portals etc.
 * POST /api/webhooks/lead?key=YOUR_KEY  (JSON or form data)
 * Fields: name, phone, email?, source?, message?, budget?, location?, propertyType?
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const data = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]));
    }
    const fd = await req.formData();
    const out: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

async function POSTInTenant(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "";
  const settings = await db.settings.findFirst();
  if (!settings?.leadWebhookKey || key !== settings.leadWebhookKey) {
    return json({ ok: false, error: "Invalid or missing API key" }, 401);
  }

  const b = await readBody(req);
  const res = await intakeLead({
    name: b.name ?? b.full_name ?? b.fullName ?? "",
    phone: b.phone ?? b.mobile ?? b.phone_number ?? "",
    email: b.email ?? null,
    source: matchOption(LEAD_SOURCES, b.source) ?? "WEBSITE",
    message: b.message ?? b.notes ?? null,
    location: b.location ?? b.city ?? null,
    budget: parseBudget(b.budget),
    propertyType: b.propertyType ?? b.property_type ?? null,
  });
  if (!res.ok) return json({ ok: false, error: "Fields 'name' and a valid 'phone' are required" }, 422);
  return json({ ok: true, leadId: res.leadId, ...(res.duplicate ? { duplicate: true } : {}) }, res.duplicate ? 200 : 201);
}

export async function POST(req: Request) {
  const orgId = await orgFromLeadKey(req);
  if (!orgId) return Response.json({ ok: false, error: "Invalid or missing key" }, { status: 401 });
  return runAsTenant(orgId, () => POSTInTenant(req));
}
