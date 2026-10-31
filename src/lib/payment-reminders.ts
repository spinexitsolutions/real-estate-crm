import "server-only";
import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { db } from "./db";
import { notifyUser } from "./notify";
import { appUrl, emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "./email";
import { sendWhatsAppTemplate } from "./whatsapp-digest";
import { formatDate } from "./format";
import { normalizePhone } from "./utils";

const inr = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;

/**
 * Payment due reminders. Picks PENDING / PARTIAL installments that are due within 3 days or overdue,
 * on active bookings, not reminded in the last 3 days. For each one:
 *  - push notification to the assigned agent
 *  - email to the customer (if they have an email and SMTP is configured)
 *  - WhatsApp template to the customer (if settings.waPaymentTemplate and the WhatsApp API are configured)
 *    template params in order: {{1}} customer first name, {{2}} amount due, {{3}} due date, {{4}} property
 * Safe to run every few minutes; each installment is reminded at most once every 3 days.
 */
export async function runPaymentReminders(now: Date = new Date()) {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const due = await db.paymentInstallment.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lte: endOfDay(addDays(now, 3)) },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: subDays(now, 3) } }],
      booking: { status: "ACTIVE" },
    },
    include: {
      booking: {
        include: {
          lead: { select: { id: true, name: true, phone: true, email: true, assignedToId: true } },
          property: { select: { title: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  const emailOn = isEmailConfigured();
  const waOn = !!(settings?.waApiEnabled && settings.waPhoneNumberId && settings.waAccessToken && settings.waPaymentTemplate);
  const portals = new Map(
    (await db.portalAccess.findMany({ where: { leadId: { in: due.map((d) => d.booking.leadId) }, revokedAt: null }, select: { leadId: true, token: true } })).map((p) => [p.leadId, p.token]),
  );

  const result = { checked: due.length, agentNotified: 0, emails: 0, whatsapp: 0, errors: [] as string[] };
  for (const i of due) {
    const lead = i.booking.lead;
    const balance = Math.max(0, i.amount - i.paidAmount);
    if (balance <= 0) continue;
    const overdue = i.dueDate < startOfDay(now);
    const property = i.booking.property?.title ?? "your property";
    const firstName = lead.name.split(" ")[0];

    await notifyUser(lead.assignedToId, {
      title: overdue ? `Payment overdue: ${lead.name}` : `Payment due soon: ${lead.name}`,
      body: `${i.label} - ${inr(balance)} ${overdue ? "was due" : "due"} on ${formatDate(i.dueDate)} (${i.booking.bookingNo})`,
      url: `/bookings/${i.bookingId}`,
      tag: `payment-${i.id}`,
    });
    if (lead.assignedToId) result.agentNotified++;

    if (emailOn && lead.email) {
      const token = portals.get(lead.id);
      const r = await sendEmail({
        to: lead.email,
        subject: `${overdue ? "Payment overdue" : "Payment reminder"}: ${i.label} - ${i.booking.bookingNo}`,
        html: emailLayout({
          company: settings?.companyName ?? "EstateDesk",
          heading: overdue ? "Your payment is overdue" : "Upcoming payment reminder",
          body: `<p>Dear ${escapeHtml(firstName)},</p>
<p>This is a gentle reminder that the following payment for <strong>${escapeHtml(property)}</strong>${i.booking.unitNumber ? ` (Unit ${escapeHtml(i.booking.unitNumber)})` : ""} ${overdue ? "was due" : "is due"} on <strong>${formatDate(i.dueDate)}</strong>.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;width:100%">
<tr><td style="padding:10px 14px;color:#64748b">Installment</td><td style="padding:10px 14px;text-align:right;font-weight:600">${escapeHtml(i.label)}</td></tr>
<tr><td style="padding:10px 14px;color:#64748b;border-top:1px solid #f1f5f9">Amount due</td><td style="padding:10px 14px;text-align:right;font-weight:600;border-top:1px solid #f1f5f9">${inr(balance)}</td></tr>
<tr><td style="padding:10px 14px;color:#64748b;border-top:1px solid #f1f5f9">Booking</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #f1f5f9">${escapeHtml(i.booking.bookingNo)}</td></tr>
</table>
<p>If you have already made this payment, please ignore this message and share the transaction reference with us.</p>`,
          cta: token ? { label: "View my payment schedule", url: `${appUrl()}/portal/${token}` } : undefined,
        }),
      });
      if (r.ok) result.emails++;
      else if (r.error) result.errors.push(`email ${lead.email}: ${r.error}`);
    }

    if (waOn && settings) {
      const r = await sendWhatsAppTemplate({
        phoneNumberId: settings.waPhoneNumberId!,
        accessToken: settings.waAccessToken!,
        to: normalizePhone(lead.phone, settings.defaultCountryCode),
        template: settings.waPaymentTemplate!,
        language: "en",
        params: [firstName, inr(balance), formatDate(i.dueDate), property],
      });
      if (r.ok) {
        result.whatsapp++;
        await db.whatsAppMessage.create({
          data: {
            phone: lead.phone,
            body: `[Template: ${settings.waPaymentTemplate}] Payment reminder - ${i.label}, ${inr(balance)} due ${formatDate(i.dueDate)}`,
            direction: "OUT",
            channel: "API",
            status: "SENT",
            leadId: lead.id,
          },
        });
      } else if (r.error) result.errors.push(`whatsapp ${lead.phone}: ${r.error}`);
    }

    await db.paymentInstallment.update({ where: { id: i.id }, data: { reminderSentAt: now } });
    await db.activity.create({
      data: { type: "PAYMENT", content: `Automatic payment reminder: ${i.label}, ${inr(balance)} ${overdue ? "overdue since" : "due"} ${formatDate(i.dueDate)}`, leadId: lead.id },
    });
  }
  return result;
}
