import "server-only";
import { Prisma } from "@prisma/client";
import { invalidateOrgStatus, rawDb } from "./db";
import { formatInvoiceNumber, nextInvoiceSeq, statusForSubscriptionEvent } from "./billing-core";

type Entity<T> = { entity: T };
export type RazorpayEvent = {
  event: string;
  payload: {
    subscription?: Entity<{ id: string; plan_id: string; status: string; current_start: number | null; current_end: number | null; notes?: Record<string, string> | [] }>;
    payment?: Entity<{ id: string; amount: number; currency: string; status: string; created_at: number; error_description?: string | null; notes?: Record<string, string> | [] }>;
  };
};

function notesOf(n: Record<string, string> | [] | undefined) {
  return n && !Array.isArray(n) ? n : {};
}

async function nextInvoiceNumber(year: number) {
  const last = await rawDb.invoice.findFirst({ where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  return formatInvoiceNumber(year, nextInvoiceSeq(last?.number, year));
}

/** Records a paid subscription invoice once per Razorpay payment id (retries on number collisions). */
async function recordInvoice(orgId: string, payment: NonNullable<RazorpayEvent["payload"]["payment"]>["entity"], description: string, periodStart: Date | null, periodEnd: Date | null) {
  const existing = await rawDb.invoice.findUnique({ where: { razorpayPaymentId: payment.id } });
  if (existing) return existing;
  const year = new Date(payment.created_at * 1000).getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await rawDb.invoice.create({
        data: {
          organizationId: orgId,
          number: await nextInvoiceNumber(year),
          amount: payment.amount / 100,
          currency: payment.currency || "INR",
          status: "PAID",
          description,
          razorpayPaymentId: payment.id,
          periodStart,
          periodEnd,
          createdAt: new Date(payment.created_at * 1000),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await rawDb.invoice.findUnique({ where: { razorpayPaymentId: payment.id } });
        if (dup) return dup;
        continue; // invoice number taken by a concurrent webhook - try the next number
      }
      throw e;
    }
  }
  throw new Error("Could not allocate an invoice number");
}

/** Applies a Razorpay webhook event to the matching organization. Returns a short result for logging. */
export async function processRazorpayEvent(evt: RazorpayEvent): Promise<{ handled: boolean; orgId?: string; note?: string }> {
  const sub = evt.payload.subscription?.entity;
  const payment = evt.payload.payment?.entity;
  const notes = { ...notesOf(payment?.notes), ...notesOf(sub?.notes) };

  // Find the organization: subscription notes first, then the stored subscription id.
  let org = notes.organizationId ? await rawDb.organization.findUnique({ where: { id: notes.organizationId } }) : null;
  if (!org && sub?.id) org = await rawDb.organization.findUnique({ where: { razorpaySubscriptionId: sub.id } });
  if (!org) return { handled: false, note: "organization not found" };

  if (evt.event === "payment.failed") {
    console.warn(`Razorpay payment failed for ${org.name}: ${payment?.error_description ?? "unknown reason"}`);
    return { handled: true, orgId: org.id, note: "payment failed logged" };
  }

  const status = statusForSubscriptionEvent(evt.event);
  if (!status || !sub) return { handled: false, orgId: org.id, note: `ignored ${evt.event}` };

  // Ignore late events for a subscription the organization has already replaced.
  if (org.razorpaySubscriptionId && org.razorpaySubscriptionId !== sub.id && evt.event !== "subscription.activated" && evt.event !== "subscription.charged") {
    return { handled: false, orgId: org.id, note: "event for a replaced subscription" };
  }

  const plan = notes.planId ? await rawDb.plan.findUnique({ where: { id: notes.planId } }) : await rawDb.plan.findFirst({ where: { OR: [{ razorpayPlanIdMonthly: sub.plan_id }, { razorpayPlanIdYearly: sub.plan_id }] } });
  const cycle = notes.cycle === "YEARLY" || (plan && plan.razorpayPlanIdYearly === sub.plan_id) ? "YEARLY" : "MONTHLY";
  const currentEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;
  const currentStart = sub.current_start ? new Date(sub.current_start * 1000) : null;

  await rawDb.organization.update({
    where: { id: org.id },
    data: {
      status,
      ...(status === "ACTIVE" ? { razorpaySubscriptionId: sub.id, planId: plan?.id ?? org.planId, billingCycle: cycle, suspendedReason: null } : {}),
      ...(currentEnd ? { currentPeriodEnd: currentEnd } : {}),
    },
  });
  invalidateOrgStatus(org.id);

  if (evt.event === "subscription.charged" && payment && payment.status === "captured") {
    await recordInvoice(org.id, payment, `${plan?.name ?? "Subscription"} plan - ${cycle === "YEARLY" ? "yearly" : "monthly"} (incl. 18% GST)`, currentStart, currentEnd);
  }
  return { handled: true, orgId: org.id, note: `${evt.event} -> ${status}` };
}
