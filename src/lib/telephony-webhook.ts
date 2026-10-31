import "server-only";
import { addMinutes } from "date-fns";
import { db } from "./db";
import { logActivity } from "./activity";
import { notifyUser } from "./notify";
import { pickAssignee } from "./lead-intake";

export type TelephonyPayload = Record<string, unknown>;

const last10 = (p: string | null | undefined) => (p || "").replace(/\D/g, "").slice(-10);

function pick(p: TelephonyPayload, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = p[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function num(v: string | null) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseDate(v: string | null) {
  if (!v) return null;
  const d = new Date(/^\d+$/.test(v) ? Number(v) * (v.length <= 10 ? 1000 : 1) : v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Maps provider status strings to our CALL_STATUSES values. */
export function mapCallStatus(raw: string | null, durationSec: number, direction: "IN" | "OUT"): string {
  const s = (raw || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (["completed", "answered", "connected", "success", "agentanswered", "customeranswered"].includes(s)) return durationSec > 0 || s !== "completed" ? "ANSWERED" : direction === "IN" ? "MISSED" : "NO_ANSWER";
  if (["busy", "userbusy"].includes(s)) return "BUSY";
  if (["noanswer", "notanswered", "unanswered", "customernotanswered", "agentnotanswered"].includes(s)) return direction === "IN" ? "MISSED" : "NO_ANSWER";
  if (["missed", "missedcall"].includes(s)) return "MISSED";
  if (["failed", "canceled", "cancelled", "error"].includes(s)) return "FAILED";
  if (["ringing", "inprogress"].includes(s)) return "RINGING";
  if (["queued", "initiated", "dialing"].includes(s)) return "INITIATED";
  return durationSec > 0 ? "ANSWERED" : direction === "IN" ? "MISSED" : "NO_ANSWER";
}

type Normalized = {
  providerCallId: string | null;
  rawStatus: string | null;
  durationSec: number;
  recordingUrl: string | null;
  from: string | null;
  to: string | null;
  agentNumber: string | null;
  customerNumber: string | null;
  direction: "IN" | "OUT" | null;
  startedAt: Date | null;
  endedAt: Date | null;
};

export function normalizePayload(provider: "EXOTEL" | "KNOWLARITY", p: TelephonyPayload): Normalized {
  if (provider === "EXOTEL") {
    // Exotel status callback (JSON) or passthru (form) fields
    const legs = Array.isArray(p.Legs) ? (p.Legs as Record<string, unknown>[]) : [];
    const dur = num(pick(p, "ConversationDuration", "DialCallDuration", "Duration")) || num(legs[1] ? String(legs[1].OnCallDuration ?? "") : null);
    const dirRaw = (pick(p, "Direction", "CallType") || "").toLowerCase();
    const direction: "IN" | "OUT" | null = dirRaw.includes("inbound") || dirRaw === "incoming" || dirRaw === "call-attempt" ? "IN" : dirRaw.includes("outbound") ? "OUT" : null;
    const from = pick(p, "From", "CallFrom");
    const to = pick(p, "To", "CallTo", "DialWhomNumber");
    return {
      providerCallId: pick(p, "CallSid", "Sid"),
      rawStatus: pick(p, "Status", "DialCallStatus", "CallStatus"),
      durationSec: dur,
      recordingUrl: pick(p, "RecordingUrl", "RecordingURL"),
      from,
      to,
      agentNumber: direction === "IN" ? pick(p, "DialWhomNumber") : from,
      customerNumber: direction === "IN" ? from : to,
      direction,
      startedAt: parseDate(pick(p, "StartTime", "DateCreated")),
      endedAt: parseDate(pick(p, "EndTime", "DateUpdated")),
    };
  }
  // KNOWLARITY
  const dirRaw = (pick(p, "call_type", "direction", "Call_Type") || "").toLowerCase();
  const direction: "IN" | "OUT" | null = dirRaw.includes("in") ? "IN" : dirRaw.includes("out") || dirRaw.includes("click") ? "OUT" : null;
  const agent = pick(p, "agent_number", "destination", "agentNumber");
  const customer = pick(p, "customer_number", "caller_id", "callerid", "customerNumber");
  return {
    providerCallId: pick(p, "uuid", "call_id", "callid", "call_uuid"),
    rawStatus: pick(p, "call_status", "status", "business_call_type"),
    durationSec: num(pick(p, "call_duration", "duration", "billsec", "conversation_duration")),
    recordingUrl: pick(p, "call_recording", "recording_url", "resource_url"),
    from: direction === "IN" ? customer : agent,
    to: direction === "IN" ? agent : customer,
    agentNumber: agent,
    customerNumber: customer,
    direction,
    startedAt: parseDate(pick(p, "start_time", "starttime", "date_time")),
    endedAt: parseDate(pick(p, "end_time", "endtime")),
  };
}

/**
 * Processes a status / incoming-call callback from Exotel or Knowlarity.
 * Updates the click-to-call log we created, or records an inbound call (and handles missed calls).
 */
export async function processTelephonyCallback(provider: "EXOTEL" | "KNOWLARITY", payload: TelephonyPayload) {
  const n = normalizePayload(provider, payload);
  const existing = n.providerCallId ? await db.callLog.findUnique({ where: { providerCallId: n.providerCallId } }) : null;

  if (existing) {
    const status = mapCallStatus(n.rawStatus, n.durationSec, existing.direction === "IN" ? "IN" : "OUT");
    const updated = await db.callLog.update({
      where: { id: existing.id },
      data: {
        status,
        durationSec: n.durationSec || existing.durationSec,
        recordingUrl: n.recordingUrl ?? existing.recordingUrl,
        endedAt: n.endedAt ?? new Date(),
        ...(n.startedAt ? { startedAt: n.startedAt } : {}),
      },
    });
    if (existing.leadId && status === "ANSWERED") {
      await db.lead.update({ where: { id: existing.leadId }, data: { lastContactedAt: new Date() } }).catch(() => undefined);
    }
    if (existing.leadId && existing.status !== status) {
      const mins = Math.floor(updated.durationSec / 60);
      const secs = updated.durationSec % 60;
      await logActivity({
        type: "CALL",
        content: `${provider === "EXOTEL" ? "Exotel" : "Knowlarity"} call ${status.toLowerCase().replace("_", " ")}${updated.durationSec ? ` (${mins}m ${secs}s)` : ""}${updated.recordingUrl ? " - recording available" : ""}`,
        leadId: existing.leadId,
        userId: existing.userId,
      });
    }
    await db.integrationLog.create({ data: { source: provider, status: "OK", message: `Call ${n.providerCallId} updated: ${status}`, payload: JSON.stringify(payload).slice(0, 8000), leadId: existing.leadId } });
    return { ok: true as const, callId: existing.id, created: false, status };
  }

  // Unknown call id: treat as an inbound call (or an outbound call placed outside the CRM)
  const direction = n.direction ?? "IN";
  const customerDigits = last10(n.customerNumber ?? (direction === "IN" ? n.from : n.to));
  const agentDigits = last10(n.agentNumber);
  const lead = customerDigits.length >= 7 ? await db.lead.findFirst({ where: { phone: { contains: customerDigits } }, orderBy: { createdAt: "desc" } }) : null;
  let agent = agentDigits.length >= 7 ? await db.user.findFirst({ where: { phone: { contains: agentDigits }, active: true } }) : null;
  if (!agent && lead?.assignedToId) agent = await db.user.findUnique({ where: { id: lead.assignedToId } });
  const status = mapCallStatus(n.rawStatus, n.durationSec, direction);

  const call = await db.callLog.create({
    data: {
      direction,
      status,
      provider,
      providerCallId: n.providerCallId,
      fromNumber: n.from,
      toNumber: n.to,
      durationSec: n.durationSec,
      recordingUrl: n.recordingUrl,
      leadId: lead?.id ?? null,
      userId: agent?.id ?? null,
      startedAt: n.startedAt ?? new Date(),
      endedAt: n.endedAt,
    },
  });

  if (lead) {
    await logActivity({
      type: "CALL",
      content: `${direction === "IN" ? "Incoming" : "Outgoing"} call ${status === "MISSED" ? "missed" : status.toLowerCase().replace("_", " ")}${n.durationSec ? ` (${Math.floor(n.durationSec / 60)}m ${n.durationSec % 60}s)` : ""}`,
      leadId: lead.id,
      userId: agent?.id ?? null,
    });
    if (status === "ANSWERED") await db.lead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
  }

  if (direction === "IN" && status === "MISSED") {
    const owner = lead?.assignedToId ?? agent?.id ?? (await pickAssignee())?.id ?? null;
    const who = lead?.name ?? n.customerNumber ?? n.from ?? "unknown number";
    if (lead) {
      await db.followUp.create({
        data: {
          title: "Call back - missed call",
          type: "CALL",
          dueAt: addMinutes(new Date(), 10),
          priority: "HIGH",
          notes: `Missed incoming call from ${n.customerNumber ?? n.from ?? "customer"}.`,
          leadId: lead.id,
          assignedToId: owner,
        },
      });
    }
    await notifyUser(owner, {
      title: `Missed call from ${who}`,
      body: lead ? `${lead.phone} - a call-back follow-up is due in 10 minutes.` : `${n.customerNumber ?? n.from ?? ""} is not in your CRM yet.`,
      url: lead ? `/leads/${lead.id}` : "/calls?status=MISSED",
      tag: `missed-${call.id}`,
    });
  }

  await db.integrationLog.create({
    data: {
      source: provider,
      status: "OK",
      message: `${direction === "IN" ? "Incoming" : "Outgoing"} call recorded: ${status}${lead ? ` (${lead.name})` : " (no matching lead)"}`,
      payload: JSON.stringify(payload).slice(0, 8000),
      leadId: lead?.id ?? null,
    },
  });
  return { ok: true as const, callId: call.id, created: true, status };
}
