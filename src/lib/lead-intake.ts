import "server-only";
import { addMinutes } from "date-fns";
import { db } from "./db";
import { logActivity } from "./activity";
import { notifyUser } from "./notify";
import { LEAD_SOURCES, OPEN_LEAD_STATUSES, PROPERTY_TYPES, labelOf } from "./constants";
import { normalizePhone } from "./utils";

export type IntakeInput = {
  name: string;
  phone: string;
  email?: string | null;
  source: string; // one of LEAD_SOURCES values
  message?: string | null;
  location?: string | null;
  budget?: number | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  purpose?: string | null;
  propertyId?: string | null; // property the enquiry is about (shortlisted automatically)
  channelLabel?: string; // human label for activity, e.g. "Facebook Lead Ads (Campaign X)"
  tags?: string[];
};

export type IntakeResult = { ok: true; leadId: string; duplicate: boolean } | { ok: false; error: string };

export function matchOption(list: { value: string; label: string }[], raw: string | null | undefined) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return list.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value ?? null;
}

export function parseBudget(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).toLowerCase().replace(/,/g, "").trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/\bcr|crore/.test(s)) return Math.round(n * 1e7);
  if (/\bl\b|lac|lakh|\bl$/.test(s)) return Math.round(n * 1e5);
  if (/\bk\b|thousand/.test(s)) return Math.round(n * 1e3);
  return n;
}

/** Active agent with the fewest open leads (falls back to managers/admins if no agents). */
export async function pickAssignee() {
  const where = { active: true, role: "AGENT" };
  let users = await db.user.findMany({
    where,
    select: { id: true, name: true, _count: { select: { assignedLeads: { where: { status: { in: OPEN_LEAD_STATUSES } } } } } },
  });
  if (!users.length) {
    users = await db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, _count: { select: { assignedLeads: { where: { status: { in: OPEN_LEAD_STATUSES } } } } } },
    });
  }
  users.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
  return users[0] ?? null;
}

/**
 * Single entry point for leads arriving from outside the CRM (website, portals, Facebook,
 * WhatsApp, public site). Dedupes by phone, auto-assigns, creates a call follow-up and notifies.
 */
export async function intakeLead(input: IntakeInput): Promise<IntakeResult> {
  const name = (input.name || "").trim().slice(0, 120);
  const rawPhone = (input.phone || "").trim();
  const digits = rawPhone.replace(/\D/g, "");
  if (!name || digits.length < 7) return { ok: false, error: "A name and a valid phone number are required" };

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const source = LEAD_SOURCES.some((s) => s.value === input.source) ? input.source : "OTHER";
  const via = input.channelLabel || labelOf(LEAD_SOURCES, source);
  const message = (input.message || "").trim().slice(0, 2000) || null;

  const last10 = digits.slice(-10);
  const existing = await db.lead.findFirst({ where: { phone: { contains: last10 } }, orderBy: { createdAt: "desc" } });
  if (existing) {
    await logActivity({ type: "NOTE", content: `Repeat enquiry via ${via}${message ? `: ${message}` : ""}`, leadId: existing.id });
    await db.lead.update({
      where: { id: existing.id },
      data: { updatedAt: new Date(), ...(existing.status === "LOST" ? { status: "NEW", lostReason: null } : {}) },
    });
    if (input.propertyId) {
      await db.leadProperty.upsert({
        where: { leadId_propertyId: { leadId: existing.id, propertyId: input.propertyId } },
        create: { leadId: existing.id, propertyId: input.propertyId },
        update: {},
      });
    }
    await notifyUser(existing.assignedToId, {
      title: `Repeat enquiry: ${existing.name}`,
      body: message ? message.slice(0, 120) : `New enquiry via ${via}`,
      url: `/leads/${existing.id}`,
      tag: `lead-${existing.id}`,
    });
    return { ok: true, leadId: existing.id, duplicate: true };
  }

  const assignee = await pickAssignee();
  const lead = await db.lead.create({
    data: {
      name,
      phone: digits.length > 10 ? `+${normalizePhone(rawPhone, settings?.defaultCountryCode ?? "91")}` : digits,
      email: input.email?.trim() || null,
      source,
      status: "NEW",
      priority: "WARM",
      purpose: input.purpose && ["BUY", "RENT", "INVEST"].includes(input.purpose) ? input.purpose : "BUY",
      propertyType: input.propertyType ? matchOption(PROPERTY_TYPES, input.propertyType) ?? (PROPERTY_TYPES.some((p) => p.value === input.propertyType) ? input.propertyType : null) : null,
      bedrooms: input.bedrooms ?? null,
      preferredLocation: input.location?.trim() || null,
      budgetMax: input.budget && input.budget > 0 ? input.budget : null,
      notes: message,
      tags: (input.tags ?? []).join(", "),
      assignedToId: assignee?.id ?? null,
    },
  });

  await logActivity({ type: "CREATED", content: `Lead captured automatically from ${via}`, leadId: lead.id });
  if (assignee) await logActivity({ type: "ASSIGNED", content: `Auto-assigned to ${assignee.name}`, leadId: lead.id });
  if (input.propertyId) {
    await db.leadProperty.create({ data: { leadId: lead.id, propertyId: input.propertyId } }).catch(() => undefined);
  }

  await db.followUp.create({
    data: {
      title: "Call new lead",
      type: "CALL",
      dueAt: addMinutes(new Date(), 15),
      priority: "HIGH",
      notes: "New enquiry. Respond quickly - leads contacted within an hour convert far better.",
      leadId: lead.id,
      propertyId: input.propertyId ?? null,
      assignedToId: assignee?.id ?? null,
    },
  });

  if (assignee) {
    await notifyUser(assignee.id, {
      title: `New lead assigned: ${lead.name}`,
      body: `${lead.phone} - from ${via}. Call within 15 minutes.`,
      url: `/leads/${lead.id}`,
      tag: `lead-${lead.id}`,
    });
  }
  return { ok: true, leadId: lead.id, duplicate: false };
}
