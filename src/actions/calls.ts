"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { isManager, requireUser, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { startClickToCall, telephonyStatus } from "@/lib/telephony";
import { CALL_STATUSES, labelOf } from "@/lib/constants";

async function leadForUser(leadId: string, user: CurrentUser) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, phone: true, assignedToId: true } });
  if (!lead) return null;
  if (user.role === "AGENT" && lead.assignedToId !== user.id) return null;
  return lead;
}

async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function fmtDuration(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export async function clickToCall(leadId: string): Promise<ActionResult<{ provider: string }>> {
  const user = await requireUser();
  const lead = await leadForUser(leadId, user);
  if (!lead) return { error: "Lead not found or access denied." };
  if (!user.phone || user.phone.replace(/\D/g, "").length < 10) {
    return { error: "Add your mobile number in My Profile first. The call rings your phone, then connects the customer." };
  }
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const status = telephonyStatus(settings);
  if (!status.enabled) return { error: status.reason ?? "Click-to-call is not configured." };

  const origin = await appOrigin();
  const provider = status.provider.toLowerCase();
  const callbackUrl = `${origin}/api/webhooks/telephony/${provider}?key=${encodeURIComponent(settings!.telephonyWebhookKey ?? "")}`;
  const res = await startClickToCall({ agentPhone: user.phone, customerPhone: lead.phone, callbackUrl });
  if (!res.ok) return { error: res.error };

  await db.callLog.create({
    data: {
      direction: "OUT",
      status: "INITIATED",
      provider: res.provider,
      providerCallId: res.providerCallId,
      fromNumber: user.phone,
      toNumber: lead.phone,
      leadId: lead.id,
      userId: user.id,
    },
  });
  const label = res.provider === "EXOTEL" ? "Exotel" : "Knowlarity";
  await logActivity({ type: "CALL", content: `Call initiated via ${label}`, leadId: lead.id, userId: user.id });
  await db.lead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, data: { provider: label } };
}

export type LogCallInput = {
  direction: "OUT" | "IN";
  status: string;
  durationSec: number;
  outcome?: string | null;
  notes?: string | null;
  startedAt?: string | null; // ISO
};

export async function logCall(leadId: string, input: LogCallInput): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await leadForUser(leadId, user);
  if (!lead) return { error: "Lead not found or access denied." };
  if (!CALL_STATUSES.some((s) => s.value === input.status)) return { error: "Invalid call status." };
  const durationSec = Math.max(0, Math.min(6 * 3600, Math.round(Number(input.durationSec) || 0)));
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date(Date.now() - durationSec * 1000);
  if (Number.isNaN(startedAt.getTime())) return { error: "Invalid call time." };
  const direction = input.direction === "IN" ? "IN" : "OUT";
  const outcome = input.outcome?.trim() || null;
  const notes = input.notes?.trim() || null;

  await db.callLog.create({
    data: {
      direction,
      status: input.status,
      provider: "MANUAL",
      fromNumber: direction === "OUT" ? user.phone : lead.phone,
      toNumber: direction === "OUT" ? lead.phone : user.phone,
      durationSec,
      outcome,
      notes,
      leadId: lead.id,
      userId: user.id,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationSec * 1000),
    },
  });
  const parts = [
    `${direction === "OUT" ? "Outgoing" : "Incoming"} call - ${labelOf(CALL_STATUSES, input.status).toLowerCase()}`,
    durationSec ? `(${fmtDuration(durationSec)})` : "",
    outcome ? `- ${outcome}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  await logActivity({ type: "CALL", content: notes ? `${parts}\n${notes}` : parts, leadId: lead.id, userId: user.id });
  await db.lead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCallNotes(callId: string, input: { outcome?: string | null; notes?: string | null }): Promise<ActionResult> {
  const user = await requireUser();
  const call = await db.callLog.findUnique({ where: { id: callId } });
  if (!call) return { error: "Call not found." };
  if (!isManager(user) && call.userId !== user.id) return { error: "You can only edit your own calls." };
  await db.callLog.update({ where: { id: callId }, data: { outcome: input.outcome?.trim() || null, notes: input.notes?.trim() || null } });
  revalidatePath("/", "layout");
  return { ok: true };
}
