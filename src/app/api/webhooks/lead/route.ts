import { NextResponse } from "next/server";
import { addMinutes } from "date-fns";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { LEAD_SOURCES, OPEN_LEAD_STATUSES, PROPERTY_TYPES } from "@/lib/constants";
import { normalizePhone } from "@/lib/utils";

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

function matchOption(list: { value: string; label: string }[], raw: string | undefined) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return list.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value ?? null;
}

export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "";
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings?.leadWebhookKey || key !== settings.leadWebhookKey) {
    return json({ ok: false, error: "Invalid or missing API key" }, 401);
  }

  const b = await readBody(req);
  const name = (b.name ?? b.full_name ?? b.fullName ?? "").trim().slice(0, 120);
  const rawPhone = (b.phone ?? b.mobile ?? b.phone_number ?? "").trim();
  const digits = rawPhone.replace(/\D/g, "");
  if (!name || digits.length < 7) {
    return json({ ok: false, error: "Fields 'name' and a valid 'phone' are required" }, 422);
  }

  const email = (b.email ?? "").trim() || null;
  const message = (b.message ?? b.notes ?? "").trim().slice(0, 2000) || null;
  const location = (b.location ?? b.city ?? "").trim() || null;
  const budget = Number(String(b.budget ?? "").replace(/[^\d.]/g, ""));
  const source = matchOption(LEAD_SOURCES, b.source) ?? "WEBSITE";
  const propertyType = matchOption(PROPERTY_TYPES, b.propertyType ?? b.property_type);

  // Dedupe by phone (match on last 10 digits)
  const last10 = digits.slice(-10);
  const existing = await db.lead.findFirst({ where: { phone: { contains: last10 } }, orderBy: { createdAt: "desc" } });
  if (existing) {
    await logActivity({
      type: "NOTE",
      content: `Repeat enquiry received via ${source.replace(/_/g, " ").toLowerCase()}${message ? `: ${message}` : ""}`,
      leadId: existing.id,
    });
    await db.lead.update({ where: { id: existing.id }, data: { updatedAt: new Date(), ...(existing.status === "LOST" ? { status: "NEW" } : {}) } });
    return json({ ok: true, leadId: existing.id, duplicate: true });
  }

  // Round-robin: active agent with the fewest open leads
  const agents = await db.user.findMany({
    where: { active: true, role: "AGENT" },
    select: { id: true, name: true, _count: { select: { assignedLeads: { where: { status: { in: OPEN_LEAD_STATUSES } } } } } },
  });
  agents.sort((a, b2) => a._count.assignedLeads - b2._count.assignedLeads);
  const assignee = agents[0] ?? null;

  const lead = await db.lead.create({
    data: {
      name,
      phone: digits.length > 10 ? `+${normalizePhone(rawPhone, settings.defaultCountryCode)}` : digits,
      email,
      source,
      status: "NEW",
      priority: "WARM",
      propertyType,
      preferredLocation: location,
      budgetMax: Number.isFinite(budget) && budget > 0 ? budget : null,
      notes: message,
      assignedToId: assignee?.id ?? null,
    },
  });

  await logActivity({ type: "CREATED", content: `Lead captured automatically from ${source.replace(/_/g, " ").toLowerCase()}`, leadId: lead.id });
  if (assignee) await logActivity({ type: "ASSIGNED", content: `Auto-assigned to ${assignee.name}`, leadId: lead.id });

  await db.followUp.create({
    data: {
      title: "Call new lead",
      type: "CALL",
      dueAt: addMinutes(new Date(), 15),
      priority: "HIGH",
      notes: "New enquiry. Respond quickly - leads contacted within an hour convert far better.",
      leadId: lead.id,
      assignedToId: assignee?.id ?? null,
    },
  });

  return json({ ok: true, leadId: lead.id }, 201);
}
