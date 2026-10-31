"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { isManager, requireUser, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { formatCurrency } from "@/lib/format";
import { fromDateTimeLocal, inAppTz } from "@/lib/timezone";
import { labelOf, PAYMENT_METHODS } from "@/lib/constants";
import { optNum, optStr, str } from "@/lib/utils";

/** yyyy-MM-dd (date input) -> Date at app-timezone midnight */
function parseDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(fromDateTimeLocal(`${v}T00:00`));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const rs = (n: number) => formatCurrency(n, "INR").replace("₹", "Rs. ");

async function bookingForUser(id: string, user: CurrentUser) {
  const b = await db.booking.findUnique({ where: { id }, include: { lead: { select: { id: true, name: true, assignedToId: true } } } });
  if (!b) return null;
  if (user.role === "AGENT" && b.lead.assignedToId !== user.id) return null;
  return b;
}

async function installmentForUser(id: string, user: CurrentUser) {
  const i = await db.paymentInstallment.findUnique({
    where: { id },
    include: { booking: { include: { lead: { select: { id: true, name: true, assignedToId: true } } } } },
  });
  if (!i) return null;
  if (user.role === "AGENT" && i.booking.lead.assignedToId !== user.id) return null;
  return i;
}

async function nextBookingNo() {
  const year = format(inAppTz(new Date()), "yyyy");
  const last = await db.booking.findFirst({ where: { bookingNo: { startsWith: `BK-${year}-` } }, orderBy: { bookingNo: "desc" }, select: { bookingNo: true } });
  const n = last ? Number(last.bookingNo.split("-")[2]) + 1 : 1;
  return `BK-${year}-${String(n).padStart(4, "0")}`;
}

type PlanInput = { label: string; dueDate: string; amount: number };

function parsePlan(raw: string): PlanInput[] | string {
  let rows: unknown;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    return "The payment schedule could not be read.";
  }
  if (!Array.isArray(rows) || rows.length === 0) return "Add at least one installment to the payment schedule.";
  const out: PlanInput[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const label = String(r.label ?? "").trim();
    const amount = Math.round(Number(r.amount));
    const dueDate = String(r.dueDate ?? "");
    if (!label) return "Every installment needs a name.";
    if (!Number.isFinite(amount) || amount <= 0) return `Enter a valid amount for "${label}".`;
    if (!parseDay(dueDate)) return `Enter a due date for "${label}".`;
    out.push({ label: label.slice(0, 120), dueDate, amount });
  }
  return out;
}

/** After payments change: auto-complete or re-open the booking and keep the property status in sync. */
async function syncBookingStatus(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { installments: true, property: true } });
  if (!b || b.status === "CANCELLED") return;
  const complete = b.installments.length > 0 && b.installments.every((i) => i.status === "PAID" || i.status === "WAIVED");
  const status = complete ? "COMPLETED" : "ACTIVE";
  if (status !== b.status) await db.booking.update({ where: { id: b.id }, data: { status } });
  if (b.property) {
    const target = complete ? (b.property.listingType === "RENT" ? "RENTED" : "SOLD") : "RESERVED";
    if (b.property.status !== target && ["AVAILABLE", "RESERVED", "SOLD", "RENTED"].includes(b.property.status)) {
      await db.property.update({ where: { id: b.property.id }, data: { status: target } });
    }
  }
}

export async function createBooking(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const leadId = str(fd, "leadId");
  const dealId = optStr(fd, "dealId");
  const propertyId = optStr(fd, "propertyId");
  const totalAmount = optNum(fd, "totalAmount");
  const bookingDate = parseDay(str(fd, "bookingDate")) ?? new Date();
  const agreementDate = parseDay(str(fd, "agreementDate"));
  if (!leadId) return { error: "Select the customer (lead) for this booking." };
  if (!totalAmount || totalAmount <= 0) return { error: "Enter the total agreement value." };

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || (user.role === "AGENT" && lead.assignedToId !== user.id)) return { error: "Lead not found or access denied." };

  const plan = parsePlan(str(fd, "installments"));
  if (typeof plan === "string") return { error: plan };
  const planTotal = plan.reduce((s, r) => s + r.amount, 0);
  if (Math.abs(planTotal - Math.round(totalAmount)) > 1) {
    return { error: `The schedule adds up to ${rs(planTotal)} but the total is ${rs(totalAmount)}. Adjust the installments.` };
  }

  let deal = null;
  if (dealId) {
    deal = await db.deal.findUnique({ where: { id: dealId }, include: { booking: true } });
    if (!deal) return { error: "Deal not found." };
    if (deal.booking) return { error: `This deal already has booking ${deal.booking.bookingNo}.` };
  }

  let booking = null;
  for (let attempt = 0; attempt < 3 && !booking; attempt++) {
    try {
      booking = await db.booking.create({
        data: {
          bookingNo: await nextBookingNo(),
          leadId,
          dealId,
          propertyId: propertyId ?? deal?.propertyId ?? null,
          unitNumber: optStr(fd, "unitNumber"),
          bookingDate,
          agreementDate,
          totalAmount: Math.round(totalAmount),
          notes: optStr(fd, "notes"),
          createdById: user.id,
          installments: {
            create: plan.map((r, i) => ({ label: r.label, dueDate: parseDay(r.dueDate)!, amount: r.amount, sortOrder: i })),
          },
        },
      });
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  if (!booking) return { error: "Could not create the booking. Please try again." };

  if (deal && deal.stage !== "WON") {
    await db.deal.update({ where: { id: deal.id }, data: { stage: "WON", closedAt: new Date() } });
    await logActivity({ type: "DEAL", content: `Deal marked as won on booking`, leadId, dealId: deal.id, userId: user.id });
  }
  if (lead.status !== "WON") {
    await db.lead.update({ where: { id: leadId }, data: { status: "WON", lostReason: null } });
    await logActivity({ type: "STATUS", content: "Status changed to Won (booking created)", leadId, userId: user.id });
  }
  if (booking.propertyId) {
    const p = await db.property.findUnique({ where: { id: booking.propertyId } });
    if (p && p.status === "AVAILABLE") await db.property.update({ where: { id: p.id }, data: { status: "RESERVED" } });
    await db.leadProperty.upsert({
      where: { leadId_propertyId: { leadId, propertyId: booking.propertyId } },
      create: { leadId, propertyId: booking.propertyId },
      update: {},
    });
  }
  await logActivity({
    type: "PAYMENT",
    content: `Booking ${booking.bookingNo} created for ${rs(booking.totalAmount)} with ${plan.length} installments`,
    leadId,
    propertyId: booking.propertyId,
    userId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: booking.id } };
}

export async function updateBooking(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const b = await bookingForUser(id, user);
  if (!b) return { error: "Booking not found or access denied." };
  const totalAmount = optNum(fd, "totalAmount");
  if (!totalAmount || totalAmount <= 0) return { error: "Enter the total agreement value." };
  await db.booking.update({
    where: { id },
    data: {
      unitNumber: optStr(fd, "unitNumber"),
      bookingDate: parseDay(str(fd, "bookingDate")) ?? b.bookingDate,
      agreementDate: parseDay(str(fd, "agreementDate")),
      totalAmount: Math.round(totalAmount),
      notes: optStr(fd, "notes"),
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelBooking(id: string, reason?: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers can cancel bookings." };
  const b = await bookingForUser(id, user);
  if (!b) return { error: "Booking not found." };
  if (b.status === "CANCELLED") return { ok: true };
  await db.booking.update({ where: { id }, data: { status: "CANCELLED", notes: [b.notes, reason ? `Cancelled: ${reason}` : "Cancelled"].filter(Boolean).join("\n") } });

  // Free the property only if no other live booking holds it and it was held by bookings (RESERVED/SOLD/RENTED).
  if (b.propertyId) {
    const others = await db.booking.count({ where: { propertyId: b.propertyId, id: { not: id }, status: { in: ["ACTIVE", "COMPLETED"] } } });
    const p = await db.property.findUnique({ where: { id: b.propertyId } });
    if (!others && p && ["RESERVED", "SOLD", "RENTED"].includes(p.status)) {
      await db.property.update({ where: { id: p.id }, data: { status: "AVAILABLE" } });
    }
  }
  await logActivity({ type: "PAYMENT", content: `Booking ${b.bookingNo} cancelled${reason ? `: ${reason}` : ""}`, leadId: b.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reactivateBooking(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers can reactivate bookings." };
  const b = await bookingForUser(id, user);
  if (!b) return { error: "Booking not found." };
  await db.booking.update({ where: { id }, data: { status: "ACTIVE" } });
  await syncBookingStatus(id);
  await logActivity({ type: "PAYMENT", content: `Booking ${b.bookingNo} reactivated`, leadId: b.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can delete bookings." };
  const b = await db.booking.findUnique({ where: { id } });
  if (!b) return { error: "Booking not found." };
  if (b.status !== "CANCELLED") await cancelBooking(id, "Deleted");
  await db.booking.delete({ where: { id } });
  await logActivity({ type: "PAYMENT", content: `Booking ${b.bookingNo} deleted`, leadId: b.leadId, userId: user.id });
  revalidatePath("/", "layout");
  redirect("/bookings");
}

// ---------------------------------------------------------------- installments

export async function addInstallment(bookingId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const b = await bookingForUser(bookingId, user);
  if (!b) return { error: "Booking not found or access denied." };
  const label = str(fd, "label");
  const amount = optNum(fd, "amount");
  const dueDate = parseDay(str(fd, "dueDate"));
  if (!label || !amount || amount <= 0 || !dueDate) return { error: "Enter a name, amount and due date." };
  const max = await db.paymentInstallment.aggregate({ where: { bookingId }, _max: { sortOrder: true } });
  await db.paymentInstallment.create({ data: { bookingId, label, amount: Math.round(amount), dueDate, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await syncBookingStatus(bookingId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateInstallment(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const i = await installmentForUser(id, user);
  if (!i) return { error: "Installment not found or access denied." };
  const label = str(fd, "label");
  const amount = optNum(fd, "amount");
  const dueDate = parseDay(str(fd, "dueDate"));
  if (!label || !amount || amount <= 0 || !dueDate) return { error: "Enter a name, amount and due date." };
  if (amount < i.paidAmount) return { error: `Amount cannot be less than what is already paid (${rs(i.paidAmount)}).` };
  const status = i.status === "WAIVED" ? "WAIVED" : i.paidAmount <= 0 ? "PENDING" : i.paidAmount >= amount ? "PAID" : "PARTIAL";
  await db.paymentInstallment.update({
    where: { id },
    data: { label, amount: Math.round(amount), dueDate, status, reminderSentAt: dueDate.getTime() !== i.dueDate.getTime() ? null : i.reminderSentAt },
  });
  await syncBookingStatus(i.bookingId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteInstallment(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const i = await installmentForUser(id, user);
  if (!i) return { error: "Installment not found or access denied." };
  const receipts = await db.payment.count({ where: { installmentId: id } });
  if (receipts > 0) return { error: "Receipts have been issued against this installment, so it cannot be deleted. Waive it instead." };
  await db.paymentInstallment.delete({ where: { id } });
  await syncBookingStatus(i.bookingId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveInstallment(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const user = await requireUser();
  const i = await installmentForUser(id, user);
  if (!i) return { error: "Installment not found or access denied." };
  const list = await db.paymentInstallment.findMany({ where: { bookingId: i.bookingId }, orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }] });
  const idx = list.findIndex((x) => x.id === id);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return { ok: true };
  [list[idx], list[swap]] = [list[swap], list[idx]];
  await db.$transaction(list.map((x, n) => db.paymentInstallment.update({ where: { id: x.id }, data: { sortOrder: n } })));
  revalidatePath(`/bookings/${i.bookingId}`);
  return { ok: true };
}

export async function setInstallmentWaived(id: string, waived: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers can waive installments." };
  const i = await installmentForUser(id, user);
  if (!i) return { error: "Installment not found." };
  const status = waived ? "WAIVED" : i.paidAmount <= 0 ? "PENDING" : i.paidAmount >= i.amount ? "PAID" : "PARTIAL";
  await db.paymentInstallment.update({ where: { id }, data: { status } });
  await logActivity({ type: "PAYMENT", content: `${i.label} (${i.booking.bookingNo}) ${waived ? "waived" : "reinstated"}`, leadId: i.booking.leadId, userId: user.id });
  await syncBookingStatus(i.bookingId);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- payments

/** Recomputes an installment's paid amount / status from its active (non-cancelled) payments. */
async function syncInstallment(installmentId: string) {
  const i = await db.paymentInstallment.findUnique({
    where: { id: installmentId },
    include: { payments: { where: { status: "ACTIVE" }, orderBy: { paidAt: "desc" }, select: { amount: true, paidAt: true } } },
  });
  if (!i) return;
  const paidAmount = Math.round(i.payments.reduce((t, p) => t + p.amount, 0));
  const status = i.status === "WAIVED" ? "WAIVED" : paidAmount <= 0 ? "PENDING" : paidAmount >= i.amount ? "PAID" : "PARTIAL";
  await db.paymentInstallment.update({ where: { id: i.id }, data: { paidAmount, status, paidAt: i.payments[0]?.paidAt ?? null } });
}

async function paymentForUser(id: string, user: CurrentUser) {
  const p = await db.payment.findUnique({
    where: { id },
    include: { installment: true, booking: { include: { lead: { select: { id: true, name: true, assignedToId: true } } } } },
  });
  if (!p) return null;
  if (user.role === "AGENT" && p.booking.lead.assignedToId !== user.id) return null;
  return p;
}

/** Records one payment against an installment. Every payment gets its own receipt number. */
export async function recordPayment(installmentId: string, fd: FormData): Promise<ActionResult<{ receiptNo: string; paymentId: string }>> {
  const user = await requireUser();
  const i = await installmentForUser(installmentId, user);
  if (!i) return { error: "Installment not found or access denied." };
  if (i.booking.status === "CANCELLED") return { error: "This booking is cancelled." };
  if (i.status === "WAIVED") return { error: "This installment is waived." };
  const amount = Math.round(optNum(fd, "amount") ?? 0);
  const method = str(fd, "method") || "OTHER";
  const reference = optStr(fd, "reference");
  const notes = optStr(fd, "notes");
  const paidAt = parseDay(str(fd, "paidAt")) ?? new Date();
  if (!amount || amount <= 0) return { error: "Enter the amount received." };
  const due = i.amount - i.paidAmount;
  if (due <= 0) return { error: "This installment is already fully paid." };
  if (amount > due + 1) return { error: `Amount is more than the balance due (${rs(due)}). Edit the installment amount first if needed.` };
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return { error: "Select a payment mode." };
  if (["CHEQUE", "DD", "UPI", "NEFT", "RTGS", "IMPS"].includes(method) && !reference) {
    return { error: `Enter the ${method === "CHEQUE" || method === "DD" ? "cheque / DD number" : "transaction reference (UTR)"} for this payment.` };
  }

  const payment = await db.$transaction(async (tx) => {
    // Atomic increment guarantees unique, gap-free receipt numbers even with simultaneous users.
    const st = await tx.settings.update({ where: { id: 1 }, data: { nextReceiptNo: { increment: 1 } } });
    const receiptNo = `${st.receiptPrefix}-${st.nextReceiptNo - 1}`;
    return tx.payment.create({
      data: { receiptNo, bookingId: i.bookingId, installmentId: i.id, amount, paidAt, method, reference, notes, recordedById: user.id },
    });
  });
  await syncInstallment(i.id);

  await logActivity({
    type: "PAYMENT",
    content: `Payment received ${rs(amount)} for ${i.label} - ${i.booking.bookingNo} (Receipt ${payment.receiptNo}, ${labelOf(PAYMENT_METHODS, method)}${reference ? ` ${reference}` : ""})`,
    leadId: i.booking.leadId,
    userId: user.id,
  });
  await syncBookingStatus(i.bookingId);
  revalidatePath("/", "layout");
  return { ok: true, data: { receiptNo: payment.receiptNo, paymentId: payment.id } };
}

/**
 * Cancels a receipt (e.g. cheque bounced, wrong entry). The receipt is kept and marked
 * CANCELLED so the numbering stays continuous; the amount is removed from the installment.
 */
export async function cancelPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers and admins can cancel receipts." };
  const p = await paymentForUser(paymentId, user);
  if (!p) return { error: "Payment not found." };
  if (p.status === "CANCELLED") return { ok: true };
  const why = (reason || "").trim();
  if (why.length < 3) return { error: "Please enter a reason for cancelling this receipt." };
  await db.payment.update({ where: { id: p.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: why.slice(0, 300), cancelledById: user.id } });
  await syncInstallment(p.installmentId);
  await logActivity({
    type: "PAYMENT",
    content: `Receipt ${p.receiptNo} for ${rs(p.amount)} (${p.installment.label} - ${p.booking.bookingNo}) cancelled: ${why}`,
    leadId: p.booking.leadId,
    userId: user.id,
  });
  await syncBookingStatus(p.bookingId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edits non-financial details of a receipt (reference / notes / mode / date). Amount changes need cancel + re-record. */
export async function updatePaymentDetails(paymentId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only managers and admins can edit receipts." };
  const p = await paymentForUser(paymentId, user);
  if (!p) return { error: "Payment not found." };
  if (p.status === "CANCELLED") return { error: "Cancelled receipts cannot be edited." };
  const method = str(fd, "method") || p.method;
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return { error: "Select a payment mode." };
  await db.payment.update({
    where: { id: p.id },
    data: { method, reference: optStr(fd, "reference"), notes: optStr(fd, "notes"), paidAt: parseDay(str(fd, "paidAt")) ?? p.paidAt },
  });
  await syncInstallment(p.installmentId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markReminderSent(installmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const i = await installmentForUser(installmentId, user);
  if (!i) return { error: "Installment not found." };
  await db.paymentInstallment.update({ where: { id: i.id }, data: { reminderSentAt: new Date() } });
  await logActivity({ type: "WHATSAPP", content: `Payment reminder sent for ${i.label} (${rs(i.amount - i.paidAmount)})`, leadId: i.booking.leadId, userId: user.id });
  revalidatePath(`/bookings/${i.bookingId}`);
  return { ok: true };
}
