"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { labelOf, FOLLOWUP_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { optStr, str } from "@/lib/utils";

async function canAccessLead(user: CurrentUser, leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, assignedToId: true } });
  if (!lead) return null;
  if (user.role === "AGENT" && lead.assignedToId !== user.id) return null;
  return lead;
}

async function getAccessible(user: CurrentUser, id: string) {
  const f = await db.followUp.findUnique({ where: { id }, include: { lead: { select: { id: true, name: true, assignedToId: true } } } });
  if (!f) return null;
  if (user.role === "AGENT" && f.assignedToId !== user.id && f.lead.assignedToId !== user.id) return null;
  return f;
}

function parseDue(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createFollowUp(fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const leadId = str(fd, "leadId");
  const title = str(fd, "title");
  const dueAt = parseDue(str(fd, "dueAt"));
  if (!leadId) return { error: "Please select a lead." };
  if (!title) return { error: "Please enter a title." };
  if (!dueAt) return { error: "Please choose a valid due date and time." };
  const lead = await canAccessLead(user, leadId);
  if (!lead) return { error: "Lead not found or you do not have access." };

  const type = str(fd, "type") || "CALL";
  let assignedToId = optStr(fd, "assignedToId");
  if (user.role === "AGENT") assignedToId = user.id;
  if (!assignedToId) assignedToId = lead.assignedToId ?? user.id;

  await db.followUp.create({
    data: {
      title,
      type,
      dueAt,
      priority: str(fd, "priority") || "MEDIUM",
      notes: optStr(fd, "notes"),
      leadId,
      propertyId: optStr(fd, "propertyId"),
      assignedToId,
    },
  });
  await logActivity({
    type: "FOLLOWUP",
    content: `${labelOf(FOLLOWUP_TYPES, type)} scheduled for ${formatDateTime(dueAt)}: ${title}`,
    leadId,
    userId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateFollowUp(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await getAccessible(user, id);
  if (!f) return { error: "Follow-up not found or you do not have access." };
  const title = str(fd, "title");
  const dueAt = parseDue(str(fd, "dueAt"));
  if (!title) return { error: "Please enter a title." };
  if (!dueAt) return { error: "Please choose a valid due date and time." };

  const leadId = str(fd, "leadId") || f.leadId;
  if (leadId !== f.leadId && !(await canAccessLead(user, leadId))) return { error: "Lead not found or you do not have access." };

  let assignedToId = optStr(fd, "assignedToId") ?? f.assignedToId;
  if (user.role === "AGENT") assignedToId = f.assignedToId ?? user.id;

  await db.followUp.update({
    where: { id },
    data: {
      title,
      type: str(fd, "type") || f.type,
      dueAt,
      priority: str(fd, "priority") || f.priority,
      notes: optStr(fd, "notes"),
      leadId,
      propertyId: optStr(fd, "propertyId"),
      assignedToId,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeFollowUp(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const f = await getAccessible(user, id);
  if (!f) return { error: "Follow-up not found or you do not have access." };
  const outcome = optStr(fd, "outcome");
  const notes = optStr(fd, "notes");
  const now = new Date();

  let next: { title: string; type: string; dueAt: Date } | null = null;
  if (str(fd, "scheduleNext") === "on" || str(fd, "scheduleNext") === "true") {
    const nextDue = parseDue(str(fd, "nextDueAt"));
    const nextTitle = str(fd, "nextTitle");
    if (!nextDue) return { error: "Please choose a valid date for the next follow-up." };
    next = { title: nextTitle || "Follow-up", type: str(fd, "nextType") || "CALL", dueAt: nextDue };
  }

  await db.followUp.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      outcome,
      notes: notes ? (f.notes ? `${f.notes}\n${notes}` : notes) : f.notes,
    },
  });
  await db.lead.update({ where: { id: f.leadId }, data: { lastContactedAt: now } });
  await logActivity({
    type: f.type === "CALL" ? "CALL" : f.type === "MEETING" || f.type === "SITE_VISIT" ? "MEETING" : "FOLLOWUP",
    content: `Completed ${labelOf(FOLLOWUP_TYPES, f.type).toLowerCase()}: ${f.title}${outcome ? ` - Outcome: ${outcome}` : ""}${notes ? `. ${notes}` : ""}`,
    leadId: f.leadId,
    propertyId: f.propertyId,
    userId: user.id,
  });

  if (next) {
    await db.followUp.create({
      data: {
        title: next.title,
        type: next.type,
        dueAt: next.dueAt,
        priority: f.priority,
        leadId: f.leadId,
        assignedToId: f.assignedToId ?? user.id,
      },
    });
    await logActivity({
      type: "FOLLOWUP",
      content: `${labelOf(FOLLOWUP_TYPES, next.type)} scheduled for ${formatDateTime(next.dueAt)}: ${next.title}`,
      leadId: f.leadId,
      userId: user.id,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelFollowUp(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const f = await getAccessible(user, id);
  if (!f) return { error: "Follow-up not found or you do not have access." };
  await db.followUp.update({ where: { id }, data: { status: "CANCELLED" } });
  await logActivity({ type: "FOLLOWUP", content: `Cancelled follow-up: ${f.title}`, leadId: f.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteFollowUp(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const f = await getAccessible(user, id);
  if (!f) return { error: "Follow-up not found or you do not have access." };
  await db.followUp.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rescheduleFollowUp(id: string, dueAtISO: string): Promise<ActionResult> {
  const user = await requireUser();
  const f = await getAccessible(user, id);
  if (!f) return { error: "Follow-up not found or you do not have access." };
  const dueAt = parseDue(dueAtISO);
  if (!dueAt) return { error: "Invalid date." };
  await db.followUp.update({ where: { id }, data: { dueAt, status: "PENDING" } });
  await logActivity({ type: "FOLLOWUP", content: `Rescheduled "${f.title}" to ${formatDateTime(dueAt)}`, leadId: f.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
