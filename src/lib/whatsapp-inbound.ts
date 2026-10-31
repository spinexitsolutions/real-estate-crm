import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { logActivity } from "./activity";
import { notifyUser } from "./notify";
import { OPEN_LEAD_STATUSES } from "./constants";
import { nextStatus } from "./whatsapp-window";

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice(7);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

type WaMessage = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: unknown;
  voice?: unknown;
  sticker?: unknown;
  location?: { name?: string; address?: string; latitude?: number; longitude?: number };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  contacts?: { name?: { formatted_name?: string } }[];
  reaction?: { emoji?: string };
};

type WaStatus = { id: string; status: string; errors?: { title?: string; message?: string }[] };

export type WaWebhookPayload = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }[];
  }[];
};

/** Turns any WhatsApp message type into readable text for the CRM. */
export function describeMessage(m: WaMessage): { body: string; mediaType: string | null } {
  switch (m.type) {
    case "text":
      return { body: m.text?.body ?? "", mediaType: null };
    case "image":
      return { body: `[Image]${m.image?.caption ? " " + m.image.caption : ""}`, mediaType: "image" };
    case "video":
      return { body: `[Video]${m.video?.caption ? " " + m.video.caption : ""}`, mediaType: "video" };
    case "document":
      return { body: `[Document] ${m.document?.filename ?? ""}${m.document?.caption ? " - " + m.document.caption : ""}`.trim(), mediaType: "document" };
    case "audio":
    case "voice":
      return { body: "[Voice message]", mediaType: "audio" };
    case "sticker":
      return { body: "[Sticker]", mediaType: "sticker" };
    case "location": {
      const l = m.location ?? {};
      const where = [l.name, l.address].filter(Boolean).join(", ");
      const maps = l.latitude != null && l.longitude != null ? ` https://maps.google.com/?q=${l.latitude},${l.longitude}` : "";
      return { body: `[Location] ${where}${maps}`.trim(), mediaType: "location" };
    }
    case "button":
      return { body: m.button?.text ?? "[Button reply]", mediaType: null };
    case "interactive":
      return { body: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[Interactive reply]", mediaType: null };
    case "contacts":
      return { body: `[Contact] ${m.contacts?.[0]?.name?.formatted_name ?? ""}`.trim(), mediaType: "contact" };
    case "reaction":
      return { body: "[Reaction]", mediaType: "reaction" };
    default:
      return { body: `[${m.type || "Message"}]`, mediaType: m.type || null };
  }
}

async function findOrCreateLead(phone: string, profileName: string | undefined) {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const existing = await db.lead.findFirst({
    where: { phone: { contains: last10 } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, assignedToId: true, status: true },
  });
  if (existing) return { lead: existing, created: false };

  const agents = await db.user.findMany({
    where: { active: true, role: "AGENT" },
    select: { id: true, _count: { select: { assignedLeads: { where: { status: { in: OPEN_LEAD_STATUSES } } } } } },
  });
  agents.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
  const assignee = agents[0] ?? (await db.user.findFirst({ where: { active: true, role: "ADMIN" }, select: { id: true } }));

  const name = profileName?.trim() || `WhatsApp ${last10}`;
  const lead = await db.lead.create({
    data: { name, phone: last10.length === 10 ? last10 : phone, source: "WHATSAPP", status: "NEW", priority: "WARM", assignedToId: assignee?.id ?? null },
    select: { id: true, name: true, assignedToId: true, status: true },
  });
  await logActivity({ type: "CREATED", content: "Lead created from an incoming WhatsApp message", leadId: lead.id });
  await db.followUp.create({
    data: {
      title: "Reply to new WhatsApp enquiry",
      type: "CALL",
      priority: "HIGH",
      dueAt: new Date(Date.now() + 15 * 60 * 1000),
      leadId: lead.id,
      assignedToId: lead.assignedToId,
    },
  });
  return { lead, created: true };
}

export async function processWhatsAppWebhook(payload: WaWebhookPayload) {
  let received = 0;
  let statuses = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const m of value.messages ?? []) {
        if (!m?.id || !m.from) continue;
        if (await db.whatsAppMessage.findUnique({ where: { waMessageId: m.id }, select: { id: true } })) continue;
        const profile = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? value.contacts?.[0]?.profile?.name;
        const { lead, created } = await findOrCreateLead(m.from, profile);
        const { body, mediaType } = describeMessage(m);
        const at = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();

        try {
          await db.whatsAppMessage.create({
            data: { phone: m.from, body, direction: "IN", channel: "API", status: "RECEIVED", waMessageId: m.id, mediaType, leadId: lead.id, createdAt: at },
          });
        } catch {
          continue; // duplicate delivery raced us
        }
        await db.lead.update({
          where: { id: lead.id },
          data: {
            lastInboundAt: at,
            unreadMessages: { increment: 1 },
            ...(lead.status === "LOST" ? { status: "CONTACTED", lostReason: null } : {}),
          },
        });
        await logActivity({ type: "WHATSAPP", content: `Received: ${body.length > 160 ? body.slice(0, 160) + "..." : body}`, leadId: lead.id });
        await notifyUser(lead.assignedToId, {
          title: created ? `New WhatsApp lead: ${lead.name}` : `WhatsApp from ${lead.name}`,
          body: body.slice(0, 180),
          url: `/whatsapp?tab=inbox&lead=${lead.id}`,
          tag: `wa-${lead.id}`,
        });
        received++;
      }

      for (const st of value.statuses ?? []) {
        if (!st?.id) continue;
        const incoming = st.status === "failed" ? "FAILED" : st.status === "read" ? "READ" : st.status === "delivered" ? "DELIVERED" : st.status === "sent" ? "SENT" : null;
        if (!incoming) continue;
        const msg = await db.whatsAppMessage.findUnique({ where: { waMessageId: st.id }, select: { id: true, status: true } });
        if (!msg) continue;
        const next = nextStatus(msg.status, incoming);
        if (next !== msg.status) {
          await db.whatsAppMessage.update({
            where: { id: msg.id },
            data: { status: next, ...(next === "FAILED" ? { error: st.errors?.[0]?.message || st.errors?.[0]?.title || "Delivery failed" } : {}) },
          });
          statuses++;
        }
      }
    }
  }
  return { received, statuses };
}
