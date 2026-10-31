"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, requireOrgId } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/action";
import { isPortalKey, normalizePortalLead, PORTAL_LABEL, type PortalKey } from "@/lib/portal-normalize";
import { ingestPortalLead } from "@/lib/integrations";
import { str } from "@/lib/utils";

export async function saveFacebookSettings(fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change integration settings." };
  const verify = str(fd, "fbVerifyToken");
  const secret = str(fd, "fbAppSecret");
  const token = str(fd, "fbPageAccessToken");
  await db.settings.upsert({
    where: { organizationId: await requireOrgId() },
    create: { fbVerifyToken: verify || null, fbAppSecret: secret || null, fbPageAccessToken: token || null },
    update: {
      fbVerifyToken: verify || null,
      ...(secret ? { fbAppSecret: secret } : {}),
      ...(token ? { fbPageAccessToken: token } : {}),
    },
  });
  revalidatePath("/integrations");
  return { ok: true };
}

export async function clearFacebookSecret(field: "fbAppSecret" | "fbPageAccessToken"): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change integration settings." };
  await db.settings.update({ where: { organizationId: await requireOrgId() }, data: { [field]: null } });
  revalidatePath("/integrations");
  return { ok: true };
}

export async function generateVerifyToken(): Promise<ActionResult<{ token: string }>> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change integration settings." };
  return { ok: true, data: { token: randomBytes(16).toString("hex") } };
}

export async function ensureLeadWebhookKey(): Promise<ActionResult<{ key: string }>> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change integration settings." };
  const s = await db.settings.findFirst();
  if (s?.leadWebhookKey) return { ok: true, data: { key: s.leadWebhookKey } };
  const key = randomBytes(16).toString("hex");
  await db.settings.upsert({ where: { organizationId: await requireOrgId() }, create: { leadWebhookKey: key }, update: { leadWebhookKey: key } });
  revalidatePath("/integrations");
  return { ok: true, data: { key } };
}

const SAMPLES: Record<PortalKey, Record<string, string>> = {
  "99acres": { SENDER_NAME: "Test Lead (99acres)", MOBILE: "", EMAIL: "test.99acres@example.com", QUERY_INFO: "Test enquiry sent from EstateDesk integrations page", CITY: "Pune", BUDGET: "80 Lac" },
  magicbricks: { name: "Test Lead (MagicBricks)", mobile: "", email: "test.magicbricks@example.com", comment: "Test enquiry sent from EstateDesk integrations page", city: "Mumbai", budget: "1.2 Cr" },
  housing: { name: "Test Lead (Housing.com)", phone: "", email: "test.housing@example.com", message: "Test enquiry sent from EstateDesk integrations page", locality: "Baner", city: "Pune" },
  generic: { name: "Test Lead (Website)", phone: "", email: "test.website@example.com", message: "Test enquiry sent from EstateDesk integrations page" },
};

/** Sends a sample lead through the real portal endpoint so admins can verify the pipeline end to end. */
export async function sendTestPortalLead(portal: string): Promise<ActionResult<{ leadId: string; viaHttp: boolean }>> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MANAGER") return { error: "Only admins and managers can send test leads." };
  if (!isPortalKey(portal)) return { error: "Unknown portal." };
  const s = await db.settings.findFirst();
  if (!s?.leadWebhookKey) return { error: "Generate the webhook key first." };

  const phone = `9${String(Date.now()).slice(-9)}`;
  const sample = { ...SAMPLES[portal] };
  for (const k of ["MOBILE", "mobile", "phone"]) if (k in sample) sample[k] = phone;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    try {
      const res = await fetch(`${proto}://${host}/api/webhooks/portal/${portal}?key=${s.leadWebhookKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; leadId?: string; error?: string };
      if (j.ok && j.leadId) {
        revalidatePath("/", "layout");
        return { ok: true, data: { leadId: j.leadId, viaHttp: true } };
      }
      if (res.status !== 0 && j.error) return { error: `${PORTAL_LABEL[portal]} endpoint returned: ${j.error}` };
    } catch {
      /* fall back to direct processing below (e.g. server cannot reach itself) */
    }
  }
  const r = await ingestPortalLead(normalizePortalLead(sample), portal, sample);
  if (!r.ok) return { error: r.error };
  revalidatePath("/", "layout");
  return { ok: true, data: { leadId: r.leadId, viaHttp: false } };
}
