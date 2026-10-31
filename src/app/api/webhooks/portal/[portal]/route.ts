import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractLeadList, isPortalKey, normalizePortalLead } from "@/lib/portal-normalize";
import { ingestPortalLead, logIntegration } from "@/lib/integrations";

/**
 * Lead push endpoint for property portals.
 * POST /api/webhooks/portal/{99acres|magicbricks|housing|generic}?key=YOUR_KEY
 * Accepts JSON (single lead, array, or {leads:[...]}) and form-urlencoded / multipart.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function authorized(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "";
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { leadWebhookKey: true } });
  return !!settings?.leadWebhookKey && key === settings.leadWebhookKey;
}

/** Some portals test the URL with a GET before enabling pushes. */
export async function GET(req: Request, { params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params;
  if (!isPortalKey(portal)) return NextResponse.json({ ok: false, error: "Unknown portal" }, { status: 404, headers: CORS });
  if (!(await authorized(req))) return NextResponse.json({ ok: false, error: "Invalid or missing API key" }, { status: 401, headers: CORS });
  return NextResponse.json({ ok: true, portal, message: "Endpoint ready. Send leads with POST." }, { headers: CORS });
}

async function readBody(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  const raw = await req.text();
  if (!raw.trim()) return {};
  if (type.includes("json") || /^[\s]*[[{]/.test(raw)) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  if (type.includes("multipart/form-data")) {
    try {
      const fd = await new Response(raw, { headers: { "content-type": type } }).formData();
      const out: Record<string, string> = {};
      fd.forEach((v, k) => typeof v === "string" && (out[k] = v));
      return out;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function POST(req: Request, { params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params;
  if (!isPortalKey(portal)) return NextResponse.json({ ok: false, error: "Unknown portal" }, { status: 404, headers: CORS });
  if (!(await authorized(req))) return NextResponse.json({ ok: false, error: "Invalid or missing API key" }, { status: 401, headers: CORS });

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }
  const list = extractLeadList(body).slice(0, 100);
  const results: { ok: boolean; leadId?: string; duplicate?: boolean; error?: string }[] = [];
  for (const item of list) {
    try {
      const n = normalizePortalLead(item);
      const r = await ingestPortalLead(n, portal, item);
      results.push(r.ok ? { ok: true, leadId: r.leadId, duplicate: r.duplicate } : { ok: false, error: r.error });
    } catch (e) {
      console.error("Portal lead failed", e);
      await logIntegration(portal === "generic" ? "WEBSITE" : portal.toUpperCase(), "ERROR", "Unexpected error while saving the lead", item);
      results.push({ ok: false, error: "Unexpected error" });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  const status = okCount === 0 ? 422 : 200;
  if (results.length === 1) return NextResponse.json(results[0], { status, headers: CORS });
  return NextResponse.json({ ok: okCount > 0, received: results.length, saved: okCount, results }, { status, headers: CORS });
}
