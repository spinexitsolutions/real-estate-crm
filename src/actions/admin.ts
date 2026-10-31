"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { rawDb, invalidateOrgStatus } from "@/lib/db";
import { createSession, getCurrentUser, isSuperAdminEmail } from "@/lib/auth";
import { adminAudit, requireSuperAdmin, FEATURE_KEYS } from "@/lib/admin";
import { slugify } from "@/lib/tenancy";
import type { ActionResult } from "@/lib/action";
import { optNum, optStr, str } from "@/lib/utils";

const STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"];

function parseDay(v: string): Date | null {
  if (!v) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function done(orgId: string) {
  invalidateOrgStatus(orgId);
  revalidatePath("/admin", "layout");
}

async function loadOrg(id: string) {
  return rawDb.organization.findUnique({ where: { id }, include: { plan: true } });
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const last = await rawDb.invoice.findFirst({ where: { number: { startsWith: `INV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `INV-${year}-${String(n).padStart(5, "0")}`;
}

// ---------------------------------------------------------------- company profile

export async function updateOrgProfile(orgId: string, fd: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  if (!name) return { error: "Company name is required." };
  if (slug !== org.slug) {
    const taken = await rawDb.organization.findUnique({ where: { slug }, select: { id: true } });
    if (taken) return { error: `The URL "${slug}" is already used by another company.` };
  }
  const ownerEmail = optStr(fd, "ownerEmail");
  if (ownerEmail && !/^\S+@\S+\.\S+$/.test(ownerEmail)) return { error: "Enter a valid owner email." };
  const data = {
    name,
    slug,
    ownerName: optStr(fd, "ownerName"),
    ownerEmail: ownerEmail?.toLowerCase() ?? null,
    ownerPhone: optStr(fd, "ownerPhone"),
    city: optStr(fd, "city"),
    businessType: optStr(fd, "businessType"),
    teamSize: optStr(fd, "teamSize"),
    notes: optStr(fd, "notes"),
  };
  await rawDb.organization.update({ where: { id: orgId }, data });
  const changed = Object.fromEntries(Object.entries(data).filter(([k, v]) => (org as Record<string, unknown>)[k] !== v));
  if (Object.keys(changed).length) await adminAudit(admin, "ORG_UPDATED", orgId, changed);
  done(orgId);
  return { ok: true };
}

// ---------------------------------------------------------------- subscription

export async function extendTrial(orgId: string, days: number): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  const d = Math.round(Number(days));
  if (!Number.isFinite(d) || d < 1 || d > 365) return { error: "Enter between 1 and 365 days." };
  const from = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
  const trialEndsAt = addDays(from, d);
  await rawDb.organization.update({ where: { id: orgId }, data: { status: org.status === "ACTIVE" ? org.status : "TRIAL", trialEndsAt, suspendedReason: null } });
  await adminAudit(admin, "TRIAL_EXTENDED", orgId, { days: d, trialEndsAt: trialEndsAt.toISOString(), previousStatus: org.status });
  done(orgId);
  return { ok: true };
}

/** Marks a company as paid (e.g. bank transfer / cheque) for a period, optionally recording an invoice. */
export async function activateManually(orgId: string, fd: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  const planId = str(fd, "planId") || org.planId;
  if (!planId) return { error: "Select a plan." };
  const plan = await rawDb.plan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found." };
  const billingCycle = str(fd, "billingCycle") === "YEARLY" ? "YEARLY" : "MONTHLY";
  const periodEnd = parseDay(str(fd, "periodEnd")) ?? addDays(new Date(), billingCycle === "YEARLY" ? 365 : 30);
  if (periodEnd <= new Date()) return { error: "Paid-until date must be in the future." };
  const recordInvoice = str(fd, "recordInvoice") === "on" || str(fd, "recordInvoice") === "1";
  const amount = optNum(fd, "amount");
  if (recordInvoice && (!amount || amount <= 0)) return { error: "Enter the amount received for the invoice." };

  await rawDb.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE", planId, billingCycle, currentPeriodEnd: periodEnd, suspendedReason: null },
  });
  let invoiceNo: string | null = null;
  if (recordInvoice && amount) {
    invoiceNo = await nextInvoiceNumber();
    await rawDb.invoice.create({
      data: {
        organizationId: orgId,
        number: invoiceNo,
        amount,
        status: "PAID",
        description: optStr(fd, "description") ?? `${plan.name} plan - ${billingCycle === "YEARLY" ? "yearly" : "monthly"} (offline payment)`,
        periodStart: new Date(),
        periodEnd,
      },
    });
  }
  await adminAudit(admin, "ORG_ACTIVATED", orgId, { plan: plan.code, billingCycle, periodEnd: periodEnd.toISOString(), invoice: invoiceNo, amount: amount ?? null, previousStatus: org.status });
  done(orgId);
  return { ok: true };
}

/** Direct edit of subscription fields (status, plan, cycle, dates). */
export async function updateSubscription(orgId: string, fd: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  const status = str(fd, "status");
  if (!STATUSES.includes(status)) return { error: "Invalid status." };
  const planId = str(fd, "planId") || null;
  if (planId && !(await rawDb.plan.findUnique({ where: { id: planId }, select: { id: true } }))) return { error: "Plan not found." };
  const billingCycle = str(fd, "billingCycle") === "YEARLY" ? "YEARLY" : "MONTHLY";
  const trialEndsAt = parseDay(str(fd, "trialEndsAt"));
  const currentPeriodEnd = parseDay(str(fd, "currentPeriodEnd"));
  const suspendedReason = status === "SUSPENDED" ? optStr(fd, "suspendedReason") ?? org.suspendedReason ?? "Suspended by admin" : null;
  await rawDb.organization.update({ where: { id: orgId }, data: { status, planId, billingCycle, trialEndsAt, currentPeriodEnd, suspendedReason } });
  const before = { status: org.status, planId: org.planId, billingCycle: org.billingCycle, trialEndsAt: org.trialEndsAt?.toISOString() ?? null, currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null };
  const after = { status, planId, billingCycle, trialEndsAt: trialEndsAt?.toISOString() ?? null, currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null };
  const changed = Object.fromEntries(Object.entries(after).filter(([k, v]) => before[k as keyof typeof before] !== v).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }]));
  if (Object.keys(changed).length) await adminAudit(admin, planId !== org.planId && Object.keys(changed).length === 1 ? "PLAN_CHANGED" : "SUBSCRIPTION_UPDATED", orgId, changed);
  done(orgId);
  return { ok: true };
}

export async function setOrgStatus(orgId: string, status: "PAST_DUE" | "CANCELLED" | "SUSPENDED" | "ACTIVE", reason?: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  if (status === "SUSPENDED" && !(reason ?? "").trim()) return { error: "Enter a reason for suspending this company." };
  let next = status;
  // Unsuspend -> back to trial if the trial is still running, otherwise to the paid state
  if (status === "ACTIVE" && org.status === "SUSPENDED") {
    next = org.trialEndsAt && org.trialEndsAt > new Date() && !org.currentPeriodEnd ? ("TRIAL" as never) : "ACTIVE";
  }
  await rawDb.organization.update({
    where: { id: orgId },
    data: { status: next, suspendedReason: status === "SUSPENDED" ? reason!.trim().slice(0, 300) : null },
  });
  const action = status === "SUSPENDED" ? "ORG_SUSPENDED" : status === "CANCELLED" ? "ORG_CANCELLED" : status === "PAST_DUE" ? "ORG_PAST_DUE" : "ORG_UNSUSPENDED";
  await adminAudit(admin, action, orgId, { from: org.status, to: next, reason: reason?.trim() || undefined });
  done(orgId);
  return { ok: true };
}

export async function recordInvoice(orgId: string, fd: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  const amount = optNum(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter the amount." };
  const status = ["PAID", "FAILED", "REFUNDED"].includes(str(fd, "status")) ? str(fd, "status") : "PAID";
  const number = await nextInvoiceNumber();
  await rawDb.invoice.create({
    data: {
      organizationId: orgId,
      number,
      amount,
      status,
      description: optStr(fd, "description"),
      periodStart: parseDay(str(fd, "periodStart")),
      periodEnd: parseDay(str(fd, "periodEnd")),
    },
  });
  await adminAudit(admin, "INVOICE_CREATED", orgId, { number, amount, status });
  done(orgId);
  return { ok: true };
}

export async function deleteOrganization(orgId: string, confirmSlug: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const org = await loadOrg(orgId);
  if (!org) return { error: "Company not found." };
  if (confirmSlug.trim() !== org.slug) return { error: `Type "${org.slug}" exactly to confirm.` };
  if (admin.organizationId === orgId) return { error: "You cannot delete the company your own admin account belongs to." };
  const counts = { users: await rawDb.user.count({ where: { organizationId: orgId } }), leads: await rawDb.lead.count({ where: { organizationId: orgId } }) };
  await rawDb.organization.delete({ where: { id: orgId } });
  await adminAudit(admin, "ORG_DELETED", orgId, { name: org.name, slug: org.slug, ownerEmail: org.ownerEmail, ...counts });
  invalidateOrgStatus(orgId);
  revalidatePath("/admin", "layout");
  redirect("/admin/companies");
}

// ---------------------------------------------------------------- impersonation

export async function impersonate(userId: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const target = await rawDb.user.findUnique({ where: { id: userId }, include: { organization: { select: { name: true } } } });
  if (!target) return { error: "User not found." };
  if (!target.active) return { error: "This user is deactivated." };
  await adminAudit(admin, "IMPERSONATION_STARTED", target.organizationId, { userId: target.id, userEmail: target.email, company: target.organization.name });
  await createSession(target, { impersonatorId: admin.id });
  redirect("/dashboard");
}

export async function stopImpersonation(): Promise<void> {
  const current = await getCurrentUser();
  if (!current?.impersonatorId) redirect("/dashboard");
  const admin = await rawDb.user.findUnique({ where: { id: current.impersonatorId } });
  if (!admin || !admin.active || !isSuperAdminEmail(admin.email)) redirect("/login");
  await createSession(admin);
  await adminAudit({ id: admin.id, email: admin.email }, "IMPERSONATION_ENDED", current.organizationId, { userId: current.id, userEmail: current.email });
  redirect(`/admin/companies/${current.organizationId}`);
}

// ---------------------------------------------------------------- plans

export async function savePlan(id: string | null, fd: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const code = str(fd, "code").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const name = str(fd, "name");
  const priceMonthly = optNum(fd, "priceMonthly");
  const priceYearly = optNum(fd, "priceYearly");
  if (!code || !name) return { error: "Code and name are required." };
  if (priceMonthly === null || priceMonthly < 0 || priceYearly === null || priceYearly < 0) return { error: "Enter valid monthly and yearly prices." };
  const int = (k: string, def: number) => {
    const n = optNum(fd, k);
    return n === null ? def : Math.max(0, Math.round(n));
  };
  const keys = new Set(FEATURE_KEYS.map((f) => f.key));
  const features = fd.getAll("features").map(String).filter((f) => keys.has(f)).join(",");
  const clash = await rawDb.plan.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== id) return { error: `A plan with code ${code} already exists.` };
  const data = {
    code,
    name,
    description: optStr(fd, "description"),
    priceMonthly,
    priceYearly,
    maxUsers: int("maxUsers", 3),
    maxLeads: int("maxLeads", 0),
    maxProperties: int("maxProperties", 0),
    storageGb: int("storageGb", 2),
    features,
    highlighted: str(fd, "highlighted") === "on",
    active: str(fd, "active") === "on",
    sortOrder: int("sortOrder", 0),
  };
  if (id) {
    await rawDb.plan.update({ where: { id }, data });
    // plan limits/features changed: refresh cached status for companies on it
    const orgs = await rawDb.organization.findMany({ where: { planId: id }, select: { id: true } });
    orgs.forEach((o) => invalidateOrgStatus(o.id));
    await adminAudit(admin, "PLAN_UPDATED", null, { code, name, priceMonthly, priceYearly });
  } else {
    await rawDb.plan.create({ data });
    await adminAudit(admin, "PLAN_CREATED", null, { code, name, priceMonthly, priceYearly });
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const plan = await rawDb.plan.findUnique({ where: { id }, include: { _count: { select: { organizations: true } } } });
  if (!plan) return { error: "Plan not found." };
  if (plan._count.organizations > 0) return { error: `${plan._count.organizations} companies are on this plan. Deactivate it instead so new customers cannot choose it.` };
  await rawDb.plan.delete({ where: { id } });
  await adminAudit(admin, "PLAN_DELETED", null, { code: plan.code, name: plan.name });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function setPlanActive(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const plan = await rawDb.plan.update({ where: { id }, data: { active } });
  await adminAudit(admin, "PLAN_UPDATED", null, { code: plan.code, active });
  revalidatePath("/admin", "layout");
  return { ok: true };
}
