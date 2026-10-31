import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PORTAL_LABEL, parseLeadEmail } from "@/lib/portal-normalize";
import { ingestPortalLead } from "@/lib/integrations";

/**
 * Inbound email lead parser (forward portal lead-notification emails here).
 * POST /api/webhooks/email-lead?key=YOUR_KEY
 * JSON {from, subject, text, html} (Cloudflare Email Workers, Zapier, Make) or
 * multipart form (SendGrid Inbound Parse: from, subject, text, html).
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "";
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { leadWebhookKey: true } });
  if (!settings?.leadWebhookKey || key !== settings.leadWebhookKey) return NextResponse.json({ ok: false, error: "Invalid or missing API key" }, { status: 401 });

  let mail: { from?: string; subject?: string; text?: string; html?: string } = {};
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("json")) mail = (await req.json()) as typeof mail;
    else {
      const fd = await req.formData();
      const g = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : undefined);
      mail = { from: g("from"), subject: g("subject"), text: g("text") ?? g("body-plain") ?? g("plain"), html: g("html") ?? g("body-html") };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the email payload" }, { status: 400 });
  }

  const parsed = parseLeadEmail(mail);
  const { portal, ...lead } = parsed;
  const res = await ingestPortalLead(lead, portal, { from: mail.from, subject: mail.subject, text: (mail.text || mail.html || "").slice(0, 3000) }, { logSource: portal === "generic" ? "WEBSITE" : undefined, via: `${portal === "generic" ? "Email" : PORTAL_LABEL[portal]} lead email` });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
  return NextResponse.json({ ok: true, leadId: res.leadId, duplicate: res.duplicate });
}
