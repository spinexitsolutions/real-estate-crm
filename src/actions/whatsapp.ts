"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, isManager, leadScope } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { sendTemplateViaCloudApi, sendViaCloudApi } from "@/lib/whatsapp";
import { isWindowOpen, parseMetaParams } from "@/lib/whatsapp-window";
import type { ActionResult } from "@/lib/action";
import { fillTemplate, normalizePhone, str, waLink } from "@/lib/utils";

export async function getWhatsAppContext(leadId?: string) {
  const user = await requireUser();
  const [settings, templates, lead] = await Promise.all([
    getSettings(),
    db.whatsAppTemplate.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, category: true, body: true, metaName: true } }),
    leadId ? db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { lastInboundAt: true } }) : Promise.resolve(null),
  ]);
  return {
    templates,
    lastInboundAt: lead?.lastInboundAt?.toISOString() ?? null,
    company: settings.companyName,
    agentName: user.name,
    apiEnabled: Boolean(settings.waApiEnabled && settings.waPhoneNumberId && settings.waAccessToken),
    countryCode: settings.defaultCountryCode,
  };
}

export type TemplateVars = { property?: string; price?: string; location?: string; date?: string };

function resolveParams(keys: string[], vars: Record<string, string | undefined>) {
  return keys.map((k) => vars[k] ?? "");
}

export async function sendWhatsApp({
  leadId,
  phone,
  body,
  channel,
  templateId,
  vars,
}: {
  leadId?: string;
  phone: string;
  body: string;
  channel: "LINK" | "API";
  /** Template used to compose the message. When it has an approved Meta name, the API sends it as a template. */
  templateId?: string | null;
  vars?: TemplateVars;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!body.trim()) return { error: "Message cannot be empty." };
  if (!phone.trim()) return { error: "Phone number is missing." };
  const settings = await getSettings();

  let lead: { id: string; name: string; lastInboundAt: Date | null } | null = null;
  if (leadId) {
    lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true, name: true, lastInboundAt: true } });
    if (!lead) return { error: "Lead not found or you do not have access." };
  }

  const to = normalizePhone(phone, settings.defaultCountryCode);
  let status = "SENT";
  let error: string | null = null;
  let waMessageId: string | null = null;

  if (channel === "API") {
    if (!settings.waApiEnabled || !settings.waPhoneNumberId || !settings.waAccessToken) {
      return { error: "WhatsApp API is not configured. Set it up in Settings." };
    }
    const template = templateId ? await db.whatsAppTemplate.findUnique({ where: { id: templateId } }) : null;
    const windowOpen = isWindowOpen(lead?.lastInboundAt);
    // Inside the 24h window the exact (possibly edited) text is sent; outside it, the approved template.
    const useTemplate = !windowOpen && !!template?.metaName;

    if (!windowOpen && !template?.metaName) {
      return {
        error:
          "This customer has not messaged you in the last 24 hours, so WhatsApp only allows approved templates via the API. Pick a template marked 'Approved', or use 'Open in WhatsApp' instead.",
      };
    }

    const res =
      useTemplate && template?.metaName
        ? await sendTemplateViaCloudApi({
            phoneNumberId: settings.waPhoneNumberId,
            accessToken: settings.waAccessToken,
            to,
            templateName: template.metaName,
            language: template.metaLanguage,
            params: resolveParams(parseMetaParams(template.metaParams), {
              name: (lead?.name ?? "").split(" ")[0] || "there",
              agent: user.name,
              company: settings.companyName,
              ...vars,
            }),
          })
        : await sendViaCloudApi({ phoneNumberId: settings.waPhoneNumberId, accessToken: settings.waAccessToken, to, body });
    if (!res.ok) {
      status = "FAILED";
      error = res.error ?? "Unknown error";
    }
    waMessageId = res.id ?? null;
  }

  await db.whatsAppMessage.create({
    data: { phone: to, body, direction: "OUT", channel, status, error, waMessageId, leadId: leadId ?? null, userId: user.id },
  });

  if (leadId && status === "SENT") {
    await db.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date(), unreadMessages: 0 } });
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

/** Marks a conversation as read (clears the unread badge). */
export async function markConversationRead(leadId: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db.lead.updateMany({ where: { id: leadId, ...leadScope(user), unreadMessages: { gt: 0 } }, data: { unreadMessages: 0 } });
  if (res.count) revalidatePath("/", "layout");
  return { ok: true };
}

function templateData(fd: FormData) {
  const metaName = str(fd, "metaName").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return {
    name: str(fd, "name"),
    body: str(fd, "body"),
    category: str(fd, "category") || "GENERAL",
    metaName: metaName || null,
    metaLanguage: str(fd, "metaLanguage") || "en",
    metaParams: parseMetaParams(str(fd, "metaParams")).join(","),
  };
}

export async function createTemplate(fd: FormData): Promise<ActionResult> {
  await requireUser();
  const data = templateData(fd);
  if (!data.name || !data.body) return { error: "Name and message are required." };
  await db.whatsAppTemplate.create({ data });
  revalidatePath("/whatsapp");
  return { ok: true };
}

export async function updateTemplate(id: string, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const data = templateData(fd);
  if (!data.name || !data.body) return { error: "Name and message are required." };
  await db.whatsAppTemplate.update({ where: { id }, data });
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
  let template: Awaited<ReturnType<typeof db.whatsAppTemplate.findUnique>> = null;
  if (templateId) {
    template = await db.whatsAppTemplate.findUnique({ where: { id: templateId } });
    if (!template) return { error: "Template not found." };
    if (!body) body = template.body;
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
  if (!template?.metaName) {
    return {
      error:
        "Bulk messages via the API must use a Meta-approved template (WhatsApp blocks free text to customers who have not messaged in the last 24 hours). Choose a template marked 'Approved', or use click-to-send links.",
    };
  }
  const metaKeys = parseMetaParams(template.metaParams);

  let sent = 0;
  let failed = 0;
  for (const l of leads) {
    const text = fillTemplate(body, vars(l.name));
    const to = normalizePhone(l.phone, settings.defaultCountryCode);
    const res = await sendTemplateViaCloudApi({
      phoneNumberId: settings.waPhoneNumberId,
      accessToken: settings.waAccessToken,
      to,
      templateName: template.metaName,
      language: template.metaLanguage,
      params: resolveParams(metaKeys, vars(l.name)),
    });
    await db.whatsAppMessage.create({
      data: { phone: to, body: text, channel: "API", status: res.ok ? "SENT" : "FAILED", error: res.error ?? null, waMessageId: res.id ?? null, leadId: l.id, userId: user.id },
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
