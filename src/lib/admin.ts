import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser, isSuperAdminEmail } from "./auth";
import { rawDb } from "./db";

/**
 * Platform owner (super admin) helpers. Super admins are listed in SUPER_ADMIN_EMAILS.
 * Everything under /admin uses rawDb (cross-company) and must call requireSuperAdmin() first.
 */

export async function getSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.impersonatorId || !isSuperAdminEmail(user.email)) return null;
  return user;
}

/** 404 for everyone who is not a platform super admin (we do not reveal that /admin exists). */
export async function requireSuperAdmin() {
  const user = await getSuperAdmin();
  if (!user) notFound();
  return user;
}

export const ORG_STATUSES = [
  { value: "TRIAL", label: "Trial", color: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  { value: "ACTIVE", label: "Active", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  { value: "PAST_DUE", label: "Past due", color: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  { value: "SUSPENDED", label: "Suspended", color: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
];

export const BUSINESS_TYPES = [
  { value: "BROKER", label: "Broker / Agency" },
  { value: "BUILDER", label: "Builder / Developer" },
  { value: "BOTH", label: "Both" },
];

export const FEATURE_KEYS: { key: string; label: string }[] = [
  { key: "leads", label: "Lead management" },
  { key: "pipeline", label: "Pipeline board" },
  { key: "followups", label: "Follow-up reminders" },
  { key: "properties", label: "Property inventory" },
  { key: "whatsapp_link", label: "WhatsApp click-to-chat" },
  { key: "reports", label: "Reports & analytics" },
  { key: "brochure", label: "Brochure PDF" },
  { key: "mobile", label: "Mobile app (PWA)" },
  { key: "whatsapp_api", label: "WhatsApp Business API" },
  { key: "portal_integrations", label: "Portal & Facebook leads" },
  { key: "website", label: "Public website" },
  { key: "bookings", label: "Bookings & payments" },
  { key: "customer_portal", label: "Customer portal" },
  { key: "documents", label: "Documents" },
  { key: "attendance", label: "Attendance & site check-in" },
  { key: "click_to_call", label: "Click-to-call / IVR" },
  { key: "api_access", label: "API access" },
  { key: "priority_support", label: "Priority support" },
];

/** Monthly recurring revenue contributed by an organization (only ACTIVE subscriptions count). */
export function orgMrr(org: { status: string; billingCycle: string; plan: { priceMonthly: number; priceYearly: number } | null }) {
  if (org.status !== "ACTIVE" || !org.plan) return 0;
  return org.billingCycle === "YEARLY" ? org.plan.priceYearly / 12 : org.plan.priceMonthly;
}

async function clientIp() {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || null;
  } catch {
    return null;
  }
}

/** Records a super admin action. Never throws (auditing must not break the action itself). */
export async function adminAudit(
  actor: { id: string; email: string } | null,
  action: string,
  organizationId: string | null,
  details?: Record<string, unknown>,
) {
  const entry = {
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? "system",
    action,
    organizationId,
    details: details ? JSON.stringify(details).slice(0, 4000) : null,
    ip: await clientIp(),
  };
  console.info("[admin-audit]", JSON.stringify(entry));
  try {
    await rawDb.adminAuditLog.create({ data: entry });
  } catch (e) {
    console.error("Failed to write admin audit log", e);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  ORG_UPDATED: "Profile updated",
  TRIAL_EXTENDED: "Trial extended",
  ORG_ACTIVATED: "Activated manually",
  PLAN_CHANGED: "Plan changed",
  SUBSCRIPTION_UPDATED: "Subscription updated",
  ORG_PAST_DUE: "Marked past due",
  ORG_CANCELLED: "Cancelled",
  ORG_SUSPENDED: "Suspended",
  ORG_UNSUSPENDED: "Unsuspended",
  ORG_DELETED: "Company deleted",
  INVOICE_CREATED: "Invoice recorded",
  IMPERSONATION_STARTED: "Logged in as user",
  IMPERSONATION_ENDED: "Returned to admin",
  PLAN_CREATED: "Plan created",
  PLAN_UPDATED: "Plan updated",
  PLAN_DELETED: "Plan deleted",
};
