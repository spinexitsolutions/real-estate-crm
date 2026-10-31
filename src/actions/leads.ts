"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isManager, requireUser, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { labelOf, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { optInt, optNum, optStr, parseCsv, str } from "@/lib/utils";

async function getLeadForUser(id: string, user: CurrentUser) {
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return null;
  if (user.role === "AGENT" && lead.assignedToId !== user.id) return null;
  return lead;
}

function leadData(fd: FormData) {
  return {
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    alternatePhone: optStr(fd, "alternatePhone"),
    email: optStr(fd, "email"),
    source: str(fd, "source") || "OTHER",
    status: str(fd, "status") || "NEW",
    priority: str(fd, "priority") || "WARM",
    purpose: str(fd, "purpose") || "BUY",
    propertyType: optStr(fd, "propertyType"),
    preferredLocation: optStr(fd, "preferredLocation"),
    bedrooms: optInt(fd, "bedrooms"),
    budgetMin: optNum(fd, "budgetMin"),
    budgetMax: optNum(fd, "budgetMax"),
    notes: optStr(fd, "notes"),
    tags: str(fd, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .join(", "),
  };
}

function validate(d: ReturnType<typeof leadData>) {
  if (!d.name) return "Lead name is required.";
  if (!d.phone || d.phone.replace(/\D/g, "").length < 7) return "Please enter a valid phone number.";
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return "Please enter a valid email address.";
  if (d.budgetMin && d.budgetMax && d.budgetMin > d.budgetMax) return "Minimum budget cannot exceed maximum budget.";
  return null;
}

export async function createLead(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const data = leadData(fd);
  const err = validate(data);
  if (err) return { error: err };

  const digits = data.phone.replace(/\D/g, "").slice(-10);
  const dup = await db.lead.findFirst({ where: { phone: { contains: digits } }, select: { id: true, name: true } });
  if (dup && str(fd, "allowDuplicate") !== "1") {
    return { error: `A lead with this phone already exists (${dup.name}). Submit again to save anyway.`, data: undefined };
  }

  let assignedToId = optStr(fd, "assignedToId");
  if (user.role === "AGENT") assignedToId = user.id;

  const lead = await db.lead.create({ data: { ...data, assignedToId, createdById: user.id } });
  await logActivity({ type: "CREATED", content: `Lead created (source: ${labelOf(LEAD_SOURCES, data.source)})`, leadId: lead.id, userId: user.id });
  if (assignedToId && assignedToId !== user.id) {
    const a = await db.user.findUnique({ where: { id: assignedToId }, select: { name: true } });
    await logActivity({ type: "ASSIGNED", content: `Assigned to ${a?.name ?? "agent"}`, leadId: lead.id, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: lead.id } };
}

export async function updateLead(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await getLeadForUser(id, user);
  if (!lead) return { error: "Lead not found or access denied." };
  const data = leadData(fd);
  const err = validate(data);
  if (err) return { error: err };
  let assignedToId = optStr(fd, "assignedToId");
  if (!isManager(user)) assignedToId = lead.assignedToId;

  await db.lead.update({ where: { id }, data: { ...data, assignedToId, lostReason: data.status === "LOST" ? lead.lostReason : null } });
  if (lead.status !== data.status) {
    await logActivity({ type: "STATUS", content: `Status changed from ${labelOf(LEAD_STATUSES, lead.status)} to ${labelOf(LEAD_STATUSES, data.status)}`, leadId: id, userId: user.id });
  }
  if (lead.assignedToId !== assignedToId) {
    const a = assignedToId ? await db.user.findUnique({ where: { id: assignedToId }, select: { name: true } }) : null;
    await logActivity({ type: "ASSIGNED", content: a ? `Reassigned to ${a.name}` : "Unassigned", leadId: id, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateLeadStatus(id: string, status: string, lostReason?: string): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await getLeadForUser(id, user);
  if (!lead) return { error: "Lead not found or access denied." };
  if (!LEAD_STATUSES.some((s) => s.value === status)) return { error: "Invalid status." };
  if (lead.status === status) return { ok: true };
  await db.lead.update({
    where: { id },
    data: { status, lostReason: status === "LOST" ? lostReason || lead.lostReason : null, lastContactedAt: status === "NEW" ? lead.lastContactedAt : new Date() },
  });
  await logActivity({
    type: "STATUS",
    content: `Status changed from ${labelOf(LEAD_STATUSES, lead.status)} to ${labelOf(LEAD_STATUSES, status)}${status === "LOST" && lostReason ? ` (${lostReason})` : ""}`,
    leadId: id,
    userId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function assignLead(id: string, userId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers can reassign leads." };
  const target = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.lead.update({ where: { id }, data: { assignedToId: userId } });
  await logActivity({ type: "ASSIGNED", content: target ? `Assigned to ${target.name}` : "Unassigned", leadId: id, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLead(id: string, redirectTo?: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers and admins can delete leads." };
  await db.lead.delete({ where: { id } });
  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
  return { ok: true };
}

export async function bulkLeadAction(
  ids: string[],
  action: { type: "status"; value: string } | { type: "assign"; value: string | null } | { type: "priority"; value: string } | { type: "delete" },
): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  if (!ids.length) return { error: "No leads selected." };
  const scope = user.role === "AGENT" ? { assignedToId: user.id } : {};
  const where = { id: { in: ids }, ...scope };

  if (action.type === "delete" || action.type === "assign") {
    if (!isManager(user)) return { error: "Only managers can perform this action." };
  }
  let count = 0;
  if (action.type === "delete") {
    count = (await db.lead.deleteMany({ where })).count;
  } else if (action.type === "status") {
    count = (await db.lead.updateMany({ where, data: { status: action.value } })).count;
    await db.activity.createMany({ data: ids.map((leadId) => ({ type: "STATUS", content: `Status changed to ${labelOf(LEAD_STATUSES, action.value)} (bulk update)`, leadId, userId: user.id })) });
  } else if (action.type === "priority") {
    count = (await db.lead.updateMany({ where, data: { priority: action.value } })).count;
  } else if (action.type === "assign") {
    count = (await db.lead.updateMany({ where, data: { assignedToId: action.value } })).count;
    const target = action.value ? await db.user.findUnique({ where: { id: action.value }, select: { name: true } }) : null;
    await db.activity.createMany({ data: ids.map((leadId) => ({ type: "ASSIGNED", content: target ? `Assigned to ${target.name} (bulk)` : "Unassigned (bulk)", leadId, userId: user.id })) });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { count } };
}

export async function addLeadNote(leadId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await getLeadForUser(leadId, user);
  if (!lead) return { error: "Lead not found or access denied." };
  const content = str(fd, "content");
  const type = str(fd, "type") || "NOTE";
  if (!content) return { error: "Please write something first." };
  await logActivity({ type, content, leadId, userId: user.id });
  if (type !== "NOTE") await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } });
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const a = await db.activity.findUnique({ where: { id } });
  if (!a) return { error: "Not found." };
  if (a.userId !== user.id && !isManager(user)) return { error: "You can only delete your own notes." };
  await db.activity.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

const HEADER_MAP: Record<string, string> = {
  name: "name",
  "full name": "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  email: "email",
  "email address": "email",
  source: "source",
  status: "status",
  priority: "priority",
  purpose: "purpose",
  "property type": "propertyType",
  location: "preferredLocation",
  "preferred location": "preferredLocation",
  bedrooms: "bedrooms",
  bhk: "bedrooms",
  "budget min": "budgetMin",
  "budget max": "budgetMax",
  budget: "budgetMax",
  notes: "notes",
  tags: "tags",
};

function matchOption(list: { value: string; label: string }[], raw: string, fallback: string) {
  const v = raw.trim().toLowerCase();
  if (!v) return fallback;
  return list.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value ?? fallback;
}

export async function importLeads(csv: string, assignToId: string | null): Promise<ActionResult<{ created: number; skipped: number }>> {
  const user = await requireUser();
  const rows = parseCsv(csv);
  if (rows.length < 2) return { error: "The file has no data rows." };
  const headers = rows[0].map((h) => HEADER_MAP[h.trim().toLowerCase()] ?? null);
  if (!headers.includes("name") || !headers.includes("phone")) return { error: "CSV must include 'Name' and 'Phone' columns." };

  const existing = new Set((await db.lead.findMany({ select: { phone: true } })).map((l) => l.phone.replace(/\D/g, "").slice(-10)));
  const { PRIORITIES, PURPOSES, PROPERTY_TYPES } = await import("@/lib/constants");
  let created = 0;
  let skipped = 0;
  const owner = user.role === "AGENT" ? user.id : assignToId;

  for (const r of rows.slice(1)) {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => h && (rec[h] = (r[i] ?? "").trim()));
    const digits = (rec.phone || "").replace(/\D/g, "").slice(-10);
    if (!rec.name || digits.length < 7 || existing.has(digits)) {
      skipped++;
      continue;
    }
    existing.add(digits);
    const num = (v?: string) => {
      const n = Number((v || "").replace(/[^\d.]/g, ""));
      return v && Number.isFinite(n) && n > 0 ? n : null;
    };
    const lead = await db.lead.create({
      data: {
        name: rec.name,
        phone: rec.phone,
        email: rec.email || null,
        source: matchOption(LEAD_SOURCES, rec.source || "", "OTHER"),
        status: matchOption(LEAD_STATUSES, rec.status || "", "NEW"),
        priority: matchOption(PRIORITIES, rec.priority || "", "WARM"),
        purpose: matchOption(PURPOSES, rec.purpose || "", "BUY"),
        propertyType: rec.propertyType ? matchOption(PROPERTY_TYPES, rec.propertyType, "") || null : null,
        preferredLocation: rec.preferredLocation || null,
        bedrooms: num(rec.bedrooms) ? Math.round(num(rec.bedrooms)!) : null,
        budgetMin: num(rec.budgetMin),
        budgetMax: num(rec.budgetMax),
        notes: rec.notes || null,
        tags: rec.tags || "",
        assignedToId: owner,
        createdById: user.id,
      },
    });
    await logActivity({ type: "CREATED", content: "Lead imported from CSV", leadId: lead.id, userId: user.id });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, skipped } };
}
