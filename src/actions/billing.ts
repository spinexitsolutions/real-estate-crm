"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { invalidateOrgStatus, rawDb } from "@/lib/db";
import type { ActionResult } from "@/lib/action";
import { verifySubscriptionPayment } from "@/lib/billing-core";
import { RazorpayError, cancelSubscription as rzpCancel, createSubscription, fetchSubscription, isRazorpayConfigured, razorpayKeyId } from "@/lib/razorpay";

type Cycle = "MONTHLY" | "YEARLY";

async function requireBillingAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

function periodEnd(sub: { current_end: number | null }, cycle: Cycle) {
  if (sub.current_end) return new Date(sub.current_end * 1000);
  const d = new Date();
  if (cycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export type CheckoutData = {
  subscriptionId: string;
  keyId: string;
  planName: string;
  cycle: Cycle;
  prefill: { name: string; email: string; contact: string };
};

/** Creates a Razorpay subscription for the chosen plan; the client then opens Razorpay Checkout. */
export async function startSubscription(planId: string, cycle: Cycle): Promise<ActionResult<CheckoutData>> {
  const user = await requireBillingAdmin();
  if (!user) return { error: "Only administrators can manage billing." };
  if (!isRazorpayConfigured()) return { error: "Online payments are not configured yet. Please contact us to activate your plan." };
  if (cycle !== "MONTHLY" && cycle !== "YEARLY") return { error: "Choose monthly or yearly billing." };

  const [plan, org] = await Promise.all([
    rawDb.plan.findFirst({ where: { id: planId, active: true } }),
    rawDb.organization.findUnique({ where: { id: user.organizationId } }),
  ]);
  if (!plan || !org) return { error: "Plan not found." };
  if (org.status === "SUSPENDED") return { error: "This account is suspended. Please contact support." };
  if (org.status === "ACTIVE" && org.planId === plan.id && org.billingCycle === cycle && org.razorpaySubscriptionId) {
    return { error: `You are already subscribed to ${plan.name} (${cycle.toLowerCase()}).` };
  }
  const rzpPlanId = cycle === "YEARLY" ? plan.razorpayPlanIdYearly : plan.razorpayPlanIdMonthly;
  if (!rzpPlanId) return { error: `The ${plan.name} plan is not available for online payment yet. Please contact us.` };

  try {
    const sub = await createSubscription({
      planId: rzpPlanId,
      totalCount: cycle === "YEARLY" ? 10 : 120,
      notes: { organizationId: org.id, planId: plan.id, cycle, organizationName: org.name.slice(0, 200) },
    });
    return {
      ok: true,
      data: {
        subscriptionId: sub.id,
        keyId: razorpayKeyId(),
        planName: plan.name,
        cycle,
        prefill: { name: user.name, email: user.email, contact: user.phone ?? org.ownerPhone ?? "" },
      },
    };
  } catch (e) {
    console.error("Razorpay subscription create failed", e);
    return { error: e instanceof RazorpayError ? `Payment gateway error: ${e.message}` : "Could not start checkout. Please try again." };
  }
}

/**
 * Called by the browser after Razorpay Checkout succeeds. Verifies the signature and activates the
 * plan immediately (the webhook stays the source of truth for renewals, failures and cancellations).
 */
export async function verifySubscription(input: { paymentId: string; subscriptionId: string; signature: string }): Promise<ActionResult<{ planName: string }>> {
  const user = await requireBillingAdmin();
  if (!user) return { error: "Only administrators can manage billing." };
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!verifySubscriptionPayment(input.paymentId, input.subscriptionId, input.signature, secret)) {
    return { error: "We could not verify this payment. If money was deducted it will be confirmed automatically within a few minutes." };
  }
  const sub = await fetchSubscription(input.subscriptionId).catch(() => null);
  if (!sub || sub.notes?.organizationId !== user.organizationId) return { error: "This payment does not belong to your account." };
  const cycle: Cycle = sub.notes?.cycle === "YEARLY" ? "YEARLY" : "MONTHLY";
  const plan = sub.notes?.planId ? await rawDb.plan.findUnique({ where: { id: sub.notes.planId } }) : null;
  const org = await rawDb.organization.findUniqueOrThrow({ where: { id: user.organizationId } });

  // Replacing an older subscription (plan change): stop the old one so the customer is not charged twice.
  if (org.razorpaySubscriptionId && org.razorpaySubscriptionId !== sub.id) {
    await rzpCancel(org.razorpaySubscriptionId, false).catch((e) => console.error("Could not cancel previous subscription", e));
  }
  await rawDb.organization.update({
    where: { id: org.id },
    data: {
      status: "ACTIVE",
      planId: plan?.id ?? org.planId,
      billingCycle: cycle,
      razorpaySubscriptionId: sub.id,
      currentPeriodEnd: periodEnd(sub, cycle),
      suspendedReason: null,
    },
  });
  invalidateOrgStatus(org.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { planName: plan?.name ?? "your plan" } };
}

/** Cancels the subscription at the end of the paid period (access continues until then). */
export async function cancelMySubscription(): Promise<ActionResult> {
  const user = await requireBillingAdmin();
  if (!user) return { error: "Only administrators can manage billing." };
  const org = await rawDb.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  if (org.status !== "ACTIVE" && org.status !== "PAST_DUE") return { error: "There is no active subscription to cancel." };
  if (org.razorpaySubscriptionId && isRazorpayConfigured()) {
    try {
      await rzpCancel(org.razorpaySubscriptionId, true);
    } catch (e) {
      console.error("Razorpay cancel failed", e);
      return { error: "Could not cancel with the payment gateway. Please try again or contact support." };
    }
  }
  await rawDb.organization.update({ where: { id: org.id }, data: { status: "CANCELLED" } });
  invalidateOrgStatus(org.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
