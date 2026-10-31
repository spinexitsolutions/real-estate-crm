"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, isManager, leadScope } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { sendViaCloudApi } from "@/lib/whatsapp";
import type { ActionResult } from "@/lib/action";
import { fillTemplate, normalizePhone, str, waLink } from "@/lib/utils";

export async function getWhatsAppContext() {
  const user = await requireUser();
  const [settings, templates] = await Promise.all([
    getSettings(),
    db.whatsAppTemplate.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, category: true, body: true } }),
  ]);
  return {
    templates,
    company: settings.companyName,
    agentName: user.name,
    apiEnabled: Boolean(settings.waApiEnabled && settings.waPhoneNumberId && settings.waAccessToken),
    countryCode: settings.defaultCountryCode,
  };
}

export async function sendWhatsApp({
  leadId,
  phone,
  body,
  channel,
}: {
  leadId?: string;
  phone: string;
  body: string;
  channel: "LINK" | "API";
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!body.trim()) return { error: "Message cannot be empty." };
  if (!phone.trim()) return { error: "Phone number is missing." };
  const settings = await getSettings();

  if (leadId) {
    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true } });
    if (!lead) return { error: "Lead not found or you do not have access." };
  }

  const to = normalizePhone(phone, settings.defaultCountryCode);
  let status = "SENT";
  let error: string | null = null;

  if (channel === "API") {
    if (!settings.waApiEnabled || !settings.waPhoneNumberId || !settings.waAccessToken) {
      return { error: "WhatsApp API is not configured. Set it up in Settings." };
    }
    const res = await sendViaCloudApi({ phoneNumberId: settings.waPhoneNumberId, accessToken: settings.waAccessToken, to, body });
    if (!res.ok) {
      status = "FAILED";
      error = res.error ?? "Unknown error";
    }
  }

  await db.whatsAppMessage.create({
    data: { phone: to, body, direction: "OUT", channel, status, error, leadId: leadId ?? null, userId: user.id },
  });

  if (leadId && status === "SENT") {
    await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } });
    await logActivity({
      type: "WHATSAPP",
      content: `WhatsApp message ${channel === "API" ? "sent via API" : "sent"}: ${body.length > 140 ? body.slice(0, 140) + "..." : body}`,
      leadId,
      userId: user.id,
    });
  }
  revalidatePath("/", "layout");
  if (status === "FAILED") return { error: `Message failed: ${error}` };
  return { ok: true };
}

export async function createTemplate(fd: FormData): Promise<ActionResult> {
  await requireUser();
  const name = str(fd, "name");
  const body = str(fd, "body");
  if (!name || !body) return { error: "Name and message are required." };
  await db.whatsAppTemplate.create({ data: { name, body, category: str(fd, "category") || "GENERAL" } });
  revalidatePath("/whatsapp");
  return { ok: true };
}

export async function updateTemplate(id: string, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const name = str(fd, "name");
  const body = str(fd, "body");
  if (!name || !body) return { error: "Name and message are required." };
  await db.whatsAppTemplate.update({ where: { id }, data: { name, body, category: str(fd, "category") || "GENERAL" } });
  revalidatePath("/whatsapp");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only admins and managers can delete templates." };
  await db.whatsAppTemplate.delete({ where: { id } });
  revalidatePath("/whatsapp");
  return { ok: true };
}

export type BroadcastFilters = {
  status?: string;
  priority?: string;
  source?: string;
  assignedToId?: string;
};

async function broadcastWhere(filters: BroadcastFilters) {
  const user = await requireUser();
  return {
    user,
    where: {
      ...leadScope(user),
      ...(filters.status ? { status: filters.status } : { status: { notIn: ["LOST"] } }),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.assignedToId && isManager(user) ? { assignedToId: filters.assignedToId } : {}),
    },
  };
}

export async function previewBroadcast(filters: BroadcastFilters) {
  const { where } = await broadcastWhere(filters);
  const [count, sample] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, take: 50, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, phone: true, status: true } }),
  ]);
  return { count, sample };
}

const BROADCAST_LIMIT = 200;

export async function broadcast({
  templateId,
  body: customBody,
  channel,
  filters,
}: {
  templateId?: string;
  body?: string;
  channel: "LINK" | "API";
  filters: BroadcastFilters;
}): Promise<ActionResult<{ sent: number; failed: number; links: { id: string; name: string; url: string }[] }>> {
  const { user, where } = await broadcastWhere(filters);
  const settings = await getSettings();
  let body = customBody?.trim() ?? "";
  if (templateId) {
    const t = await db.whatsAppTemplate.findUnique({ where: { id: templateId } });
    if (!t) return { error: "Template not found." };
    if (!body) body = t.body;
  }
  if (!body) return { error: "Choose a template or write a message." };

  const leads = await db.lead.findMany({ where, take: BROADCAST_LIMIT, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, phone: true } });
  if (leads.length === 0) return { error: "No leads match these filters." };

  const vars = (name: string) => ({ name: name.split(" ")[0], agent: user.name, company: settings.companyName });

  if (channel === "LINK") {
    const links = leads.map((l) => ({ id: l.id, name: l.name, url: waLink(l.phone, fillTemplate(body, vars(l.name)), settings.defaultCountryCode) }));
    return { ok: true, data: { sent: 0, failed: 0, links } };
  }

  if (!settings.waApiEnabled || !settings.waPhoneNumberId || !settings.waAccessToken) {
    return { error: "WhatsApp API is not configured. Set it up in Settings, or use click-to-send links." };
  }

  let sent = 0;
  let failed = 0;
  for (const l of leads) {
    const text = fillTemplate(body, vars(l.name));
    const to = normalizePhone(l.phone, settings.defaultCountryCode);
    const res = await sendViaCloudApi({ phoneNumberId: settings.waPhoneNumberId, accessToken: settings.waAccessToken, to, body: text });
    await db.whatsAppMessage.create({
      data: { phone: to, body: text, channel: "API", status: res.ok ? "SENT" : "FAILED", error: res.error ?? null, leadId: l.id, userId: user.id },
    });
    if (res.ok) {
      sent++;
      await db.lead.update({ where: { id: l.id }, data: { lastContactedAt: new Date() } });
      await logActivity({ type: "WHATSAPP", content: `Broadcast message sent via API`, leadId: l.id, userId: user.id });
    } else failed++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { sent, failed, links: [] } };
}

/** Logs a click-to-send broadcast message once the user opens it. */
export async function logBroadcastLink(leadId: string, url: string): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true, phone: true } });
  if (!lead) return { error: "Lead not found." };
  let text = "";
  try {
    text = new URL(url).searchParams.get("text") ?? "";
  } catch {
    /* ignore */
  }
  await db.whatsAppMessage.create({ data: { phone: lead.phone, body: text, channel: "LINK", status: "SENT", leadId, userId: user.id } });
  await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } });
  await logActivity({ type: "WHATSAPP", content: `Broadcast message sent`, leadId, userId: user.id });
  return { ok: true };
}
