import "server-only";
import { db } from "./db";
import { intakeLead, parseBudget } from "./lead-intake";
import { PORTAL_LABEL, PORTAL_SOURCE, type NormalizedLead, type PortalKey } from "./portal-normalize";

const LOG_SOURCE: Record<PortalKey, string> = { "99acres": "99ACRES", magicbricks: "MAGICBRICKS", housing: "HOUSING", generic: "WEBSITE" };

export async function logIntegration(source: string, status: "OK" | "DUPLICATE" | "ERROR" | "IGNORED", message: string | null, payload?: unknown, leadId?: string | null) {
  try {
    let p: string | null = null;
    if (payload !== undefined) {
      p = typeof payload === "string" ? payload : JSON.stringify(payload);
      if (p.length > 4096) p = p.slice(0, 4096) + "...";
    }
    await db.integrationLog.create({ data: { source, status, message: message?.slice(0, 500) ?? null, payload: p, leadId: leadId ?? null } });
  } catch (e) {
    console.error("Failed to write integration log", e);
  }
}

/** "50-60 Lakhs" -> 6000000, "1.2 Cr" -> 12000000, "80 Lac" -> 8000000 */
export function budgetFromText(raw: string | null | undefined) {
  if (!raw) return null;
  const s = String(raw);
  const range = s.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)(.*)$/i);
  if (range) return parseBudget(`${range[2]} ${range[3]}`);
  return parseBudget(s);
}

/** Tries to find our property from a portal listing id / project name / locality. */
export async function findPropertyForPortal(n: Pick<NormalizedLead, "propertyRef" | "projectName" | "locality">) {
  if (n.propertyRef) {
    const byCode = await db.property.findFirst({ where: { code: { equals: n.propertyRef.trim(), mode: "insensitive" } }, select: { id: true } });
    if (byCode) return byCode.id;
  }
  const name = n.projectName?.trim();
  if (name && name.length >= 4) {
    const byTitle = await db.property.findFirst({
      where: { OR: [{ title: { contains: name, mode: "insensitive" } }, { address: { contains: name, mode: "insensitive" } }], status: { in: ["AVAILABLE", "RESERVED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (byTitle) return byTitle.id;
  }
  return null;
}

/** Turns a normalized portal lead into a CRM lead (deduped, assigned, follow-up created) and logs it. */
export async function ingestPortalLead(n: NormalizedLead, portal: PortalKey, payload: unknown, opts?: { logSource?: string; via?: string }) {
  const logSource = opts?.logSource ?? LOG_SOURCE[portal];
  if (!n.name && n.phone) n.name = "Portal enquiry";
  if (!n.phone || n.phone.replace(/\D/g, "").length < 7) {
    await logIntegration(logSource, "ERROR", "Missing or invalid phone number", payload);
    return { ok: false as const, error: "A valid phone number is required" };
  }
  const propertyId = await findPropertyForPortal(n);
  const messageParts = [n.message, n.projectName && !propertyId ? `Project: ${n.projectName}` : null, n.propertyRef && !propertyId ? `Portal listing: ${n.propertyRef}` : null].filter(Boolean);
  const res = await intakeLead({
    name: n.name,
    phone: n.phone,
    email: n.email,
    source: PORTAL_SOURCE[portal],
    message: messageParts.join("\n") || null,
    location: [n.locality, n.city].filter(Boolean).join(", ") || null,
    budget: budgetFromText(n.budget),
    propertyType: n.propertyType,
    bedrooms: n.bedrooms,
    purpose: n.purpose,
    propertyId,
    channelLabel: opts?.via ?? PORTAL_LABEL[portal],
  });
  if (!res.ok) {
    await logIntegration(logSource, "ERROR", res.error, payload);
    return res;
  }
  await logIntegration(logSource, res.duplicate ? "DUPLICATE" : "OK", res.duplicate ? `Repeat enquiry from ${n.name} (${n.phone})` : `New lead ${n.name} (${n.phone})`, payload, res.leadId);
  return res;
}
