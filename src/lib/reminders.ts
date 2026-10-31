import "server-only";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { db } from "./db";
import { notifyUser } from "./notify";
import { appUrl, emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "./email";
import { sendWhatsAppTemplate } from "./whatsapp-digest";
import { normalizePhone } from "./utils";
import { FOLLOWUP_TYPES, OPEN_LEAD_STATUSES, labelOf } from "./constants";
import { formatTime } from "./format";

export type ReminderRunResult = {
  remindersSent: number;
  digest: { ran: boolean; reason?: string; emails: number; whatsapp: number; skipped: number };
  cleanup: { loginAttempts: number; resetTokens: number };
};

/** (a) Push reminders for follow-ups due soon. */
export async function sendDueReminders(now = new Date()) {
  const due = await db.followUp.findMany({
    where: {
      status: "PENDING",
      reminderSentAt: null,
      dueAt: { gte: new Date(now.getTime() - 5 * 60000), lte: new Date(now.getTime() + 15 * 60000) },
    },
    include: { lead: { select: { id: true, name: true, assignedToId: true } } },
    take: 200,
  });
  for (const f of due) {
    const mins = Math.round((f.dueAt.getTime() - now.getTime()) / 60000);
    const when = mins > 0 ? `in ${mins} min` : "now";
    await notifyUser(f.assignedToId ?? f.lead.assignedToId, {
      title: `Follow-up ${when}: ${f.title}`,
      body: `${labelOf(FOLLOWUP_TYPES, f.type)} with ${f.lead.name} at ${formatTime(f.dueAt)}`,
      url: `/leads/${f.lead.id}`,
      tag: `fu-${f.id}`,
    });
    await db.followUp.update({ where: { id: f.id }, data: { reminderSentAt: now } });
  }
  return due.length;
}

/** (b) Daily digest by email (and WhatsApp template when configured). Runs once per day after 08:00 app time. */
export async function sendDailyDigest(now = new Date(), opts: { force?: boolean; origin?: string } = {}) {
  const result = { ran: false, reason: undefined as string | undefined, emails: 0, whatsapp: 0, skipped: 0 };
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) return { ...result, reason: "No settings" };
  const today = format(now, "yyyy-MM-dd");
  if (!opts.force) {
    if (now.getHours() < 8) return { ...result, reason: "Before 08:00" };
    if (settings.lastDigestDate === today) return { ...result, reason: "Already sent today" };
  }
  const emailOn = settings.emailDigestEnabled && isEmailConfigured();
  const waOn = !!(settings.waApiEnabled && settings.waDigestTemplate && settings.waPhoneNumberId && settings.waAccessToken);
  if (!emailOn && !waOn) return { ...result, reason: "No digest channel configured" };

  // Claim today's run first so concurrent cron calls don't double-send.
  const claimed = await db.settings.updateMany({
    where: { id: 1, OR: [{ lastDigestDate: null }, { lastDigestDate: { not: today } }] },
    data: { lastDigestDate: today },
  });
  if (!claimed.count && !opts.force) return { ...result, reason: "Already sent today" };
  result.ran = true;

  const users = await db.user.findMany({ where: { active: true } });
  const base = appUrl(opts.origin);
  for (const u of users) {
    const mine = { OR: [{ assignedToId: u.id }, { assignedToId: null, lead: { assignedToId: u.id } }] };
    const [overdue, todays, hot] = await Promise.all([
      db.followUp.findMany({ where: { status: "PENDING", dueAt: { lt: startOfDay(now) }, ...mine }, orderBy: { dueAt: "asc" }, take: 15, include: { lead: { select: { name: true, phone: true } } } }),
      db.followUp.findMany({ where: { status: "PENDING", dueAt: { gte: startOfDay(now), lte: endOfDay(now) }, ...mine }, orderBy: { dueAt: "asc" }, take: 25, include: { lead: { select: { name: true, phone: true } } } }),
      db.lead.findMany({
        where: { assignedToId: u.id, priority: "HOT", status: { in: OPEN_LEAD_STATUSES }, OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: subDays(now, 2) } }] },
        take: 10,
        orderBy: { lastContactedAt: "asc" },
      }),
    ]);
    if (!overdue.length && !todays.length && !hot.length) {
      result.skipped++;
      continue;
    }
    const firstName = u.name.split(" ")[0];

    if (emailOn && u.notifyEmail && u.email) {
      const row = (cells: string[], muted = false) =>
        `<tr>${cells.map((c, i) => `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${muted && i === 0 ? "#e11d48" : "#334155"}">${c}</td>`).join("")}</tr>`;
      const fuTable = (items: typeof todays, overdueList = false) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;margin:8px 0 20px">${items
          .map((f) => row([overdueList ? format(f.dueAt, "dd MMM, h:mm a") : formatTime(f.dueAt), escapeHtml(f.title), `${escapeHtml(f.lead.name)} (${escapeHtml(f.lead.phone)})`], overdueList))
          .join("")}</table>`;
      const body = [
        `<p style="margin:0 0 16px">Hi ${escapeHtml(firstName)}, here is your plan for ${format(now, "EEEE, d MMMM")}.</p>`,
        `<p style="margin:0 0 4px"><strong>${todays.length}</strong> follow-ups today, <strong style="color:#e11d48">${overdue.length}</strong> overdue, <strong>${hot.length}</strong> hot leads need a call.</p>`,
        overdue.length ? `<h3 style="margin:20px 0 4px;font-size:14px;color:#e11d48">Overdue</h3>${fuTable(overdue, true)}` : "",
        todays.length ? `<h3 style="margin:20px 0 4px;font-size:14px">Today</h3>${fuTable(todays)}` : "",
        hot.length
          ? `<h3 style="margin:20px 0 4px;font-size:14px">Hot leads not contacted in 2+ days</h3><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;margin:8px 0">${hot
              .map((l) => row([escapeHtml(l.name), escapeHtml(l.phone), l.lastContactedAt ? `Last contact ${format(l.lastContactedAt, "dd MMM")}` : "Never contacted"]))
              .join("")}</table>`
          : "",
      ].join("");
      const r = await sendEmail({
        to: u.email,
        subject: `Your day: ${todays.length} follow-up${todays.length === 1 ? "" : "s"}${overdue.length ? `, ${overdue.length} overdue` : ""}`,
        html: emailLayout({ company: settings.companyName, heading: "Today's follow-up plan", body, cta: { label: "Open my agenda", url: `${base}/follow-ups` } }),
      });
      if (r.ok) result.emails++;
    }

    if (waOn && u.notifyWhatsApp && u.phone) {
      const r = await sendWhatsAppTemplate({
        phoneNumberId: settings.waPhoneNumberId!,
        accessToken: settings.waAccessToken!,
        to: normalizePhone(u.phone, settings.defaultCountryCode),
        template: settings.waDigestTemplate!,
        params: [firstName, String(todays.length), String(overdue.length)],
      });
      if (r.ok) result.whatsapp++;
      else console.error("WhatsApp digest failed for", u.email, r.error);
    }
  }
  return result;
}

/** (c) Housekeeping. */
export async function cleanupSecurityTables(now = new Date()) {
  const [a, t] = await Promise.all([
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: subDays(now, 1) } } }),
    db.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
  ]);
  return { loginAttempts: a.count, resetTokens: t.count };
}

export async function runReminderJobs(opts: { origin?: string } = {}): Promise<ReminderRunResult> {
  const now = new Date();
  const remindersSent = await sendDueReminders(now);
  const digest = await sendDailyDigest(now, { origin: opts.origin });
  const cleanup = await cleanupSecurityTables(now);
  return { remindersSent, digest, cleanup };
}
