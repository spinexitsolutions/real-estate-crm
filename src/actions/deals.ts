"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, isManager, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { guardWritable } from "@/lib/plans";
import { optNum, optStr, str } from "@/lib/utils";
import { DEAL_STAGES, labelOf } from "@/lib/constants";

const OPEN_STAGES = ["NEGOTIATION", "TOKEN", "AGREEMENT"];

function readDeal(fd: FormData) {
  const close = str(fd, "expectedCloseDate");
  return {
    title: str(fd, "title"),
    value: optNum(fd, "value"),
    commissionPct: optNum(fd, "commissionPct") ?? 2,
    stage: str(fd, "stage") || "NEGOTIATION",
    expectedCloseDate: close ? new Date(close) : null,
    notes: optStr(fd, "notes"),
    leadId: str(fd, "leadId"),
    propertyId: optStr(fd, "propertyId"),
    agentId: optStr(fd, "agentId"),
  };
}

async function canAccess(user: CurrentUser, dealId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return null;
  if (!isManager(user) && deal.agentId !== user.id) return null;
  return deal;
}

/** Side effects when a deal reaches a closing stage. */
async function applyStageEffects(dealId: string, stage: string, userId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { property: true } });
  if (!deal) return;
  if (stage === "WON") {
    await db.deal.update({ where: { id: dealId }, data: { closedAt: deal.closedAt ?? new Date() } });
    await db.lead.update({ where: { id: deal.leadId }, data: { status: "WON" } });
    if (deal.property) {
      const status = deal.property.listingType === "RENT" ? "RENTED" : "SOLD";
      await db.property.update({ where: { id: deal.property.id }, data: { status } });
      await logActivity({ type: "STATUS", content: `Marked ${status === "SOLD" ? "Sold" : "Rented"} via deal "${deal.title}"`, propertyId: deal.property.id, dealId, userId });
    }
    await logActivity({ type: "STATUS", content: "Status changed to won (deal closed)", leadId: deal.leadId, dealId, userId });
  } else if (stage === "LOST") {
    await db.deal.update({ where: { id: dealId }, data: { closedAt: deal.closedAt ?? new Date() } });
    const otherOpen = await db.deal.count({ where: { leadId: deal.leadId, id: { not: dealId }, stage: { in: [...OPEN_STAGES, "WON"] } } });
    if (otherOpen === 0) {
      await db.lead.update({ where: { id: deal.leadId }, data: { status: "LOST", lostReason: "Deal lost" } });
      await logActivity({ type: "STATUS", content: "Status changed to lost (deal lost)", leadId: deal.leadId, dealId, userId });
    }
  } else if (deal.closedAt) {
    await db.deal.update({ where: { id: dealId }, data: { closedAt: null } });
  }
}

export async function createDeal(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const locked = await guardWritable();
  if (locked) return { error: locked };
  const data = readDeal(fd);
  if (!data.leadId) return { error: "Please select a lead." };
  if (!data.title) return { error: "Deal title is required." };
  if (data.value === null || data.value <= 0) return { error: "Please enter a valid deal value." };
  const lead = await db.lead.findUnique({ where: { id: data.leadId } });
  if (!lead) return { error: "Lead not found." };
  if (user.role === "AGENT" && lead.assignedToId !== user.id) return { error: "You do not have access to this lead." };

  const deal = await db.deal.create({
    data: {
      ...data,
      value: data.value,
      agentId: user.role === "AGENT" ? user.id : (data.agentId ?? lead.assignedToId ?? user.id),
    },
  });
  if (data.propertyId) {
    await db.leadProperty.upsert({
      where: { leadId_propertyId: { leadId: data.leadId, propertyId: data.propertyId } },
      create: { leadId: data.leadId, propertyId: data.propertyId },
      update: {},
    });
  }
  if (OPEN_STAGES.includes(deal.stage) && !["NEGOTIATION", "WON"].includes(lead.status)) {
    await db.lead.update({ where: { id: lead.id }, data: { status: "NEGOTIATION" } });
  }
  await logActivity({ type: "DEAL", content: `Deal created: ${deal.title}`, leadId: deal.leadId, dealId: deal.id, propertyId: deal.propertyId, userId: user.id });
  await applyStageEffects(deal.id, deal.stage, user.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: deal.id } };
}

export async function updateDeal(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await canAccess(user, id);
  if (!existing) return { error: "Deal not found." };
  const data = readDeal(fd);
  if (!data.leadId) return { error: "Please select a lead." };
  if (!data.title) return { error: "Deal title is required." };
  if (data.value === null || data.value <= 0) return { error: "Please enter a valid deal value." };
  await db.deal.update({
    where: { id },
    data: { ...data, value: data.value, agentId: user.role === "AGENT" ? user.id : data.agentId },
  });
  if (existing.stage !== data.stage) {
    await logActivity({ type: "DEAL", content: `Deal "${data.title}" moved to ${labelOf(DEAL_STAGES, data.stage)}`, leadId: data.leadId, dealId: id, userId: user.id });
    await applyStageEffects(id, data.stage, user.id);
  } else {
    await logActivity({ type: "DEAL", content: `Deal "${data.title}" updated`, leadId: data.leadId, dealId: id, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDealStage(id: string, stage: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!DEAL_STAGES.some((s) => s.value === stage)) return { error: "Invalid stage." };
  const existing = await canAccess(user, id);
  if (!existing) return { error: "Deal not found." };
  if (existing.stage === stage) return { ok: true };
  await db.deal.update({ where: { id }, data: { stage } });
  await logActivity({ type: "DEAL", content: `Deal "${existing.title}" moved to ${labelOf(DEAL_STAGES, stage)}`, leadId: existing.leadId, dealId: id, userId: user.id });
  await applyStageEffects(id, stage, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDeal(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await canAccess(user, id);
  if (!existing) return { error: "Deal not found." };
  await db.deal.delete({ where: { id } });
  await logActivity({ type: "DEAL", content: `Deal deleted: ${existing.title}`, leadId: existing.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
