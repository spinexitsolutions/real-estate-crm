import { CreditCard, FileText, Mail, Phone } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActivePlans, getOrgPlan, orgUsage } from "@/lib/plans";
import { orgAccess } from "@/lib/tenancy";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { FEATURES, limitOf, planFeatures, priceWithGst, usagePercent, type FeatureKey } from "@/lib/billing-core";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanPicker, CancelSubscriptionButton } from "./billing-client";

export const metadata = { title: "Plan & Billing" };

const STATUS: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: "Free trial", cls: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  PAST_DUE: { label: "Payment due", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  SUSPENDED: { label: "Suspended", cls: "bg-rose-50 text-rose-700 ring-rose-600/20" },
};

export default async function BillingPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const [org, plans, usage, invoices] = await Promise.all([getOrgPlan(user.organizationId), getActivePlans(), orgUsage(), db.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 36 })]);
  if (!org) return null;
  const access = orgAccess(org);
  const plan = org.plan;
  const isAdmin = user.role === "ADMIN";
  const online = isRazorpayConfigured();
  const status = STATUS[org.status] ?? STATUS.ACTIVE;
  const supportEmail = process.env.PLATFORM_SUPPORT_EMAIL ?? null;
  const supportPhone = process.env.PLATFORM_SUPPORT_PHONE ?? null;

  const meters: { label: string; used: number; limit: number }[] = [
    { label: "Active users", used: usage.users, limit: limitOf(plan, "users") },
    { label: "Leads", used: usage.leads, limit: limitOf(plan, "leads") },
    { label: "Properties", used: usage.properties, limit: limitOf(plan, "properties") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} title="Plan & Billing" description="Your subscription, usage and invoices" />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Current plan" action={<Badge className={status.cls}>{status.label}</Badge>} />
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">{plan?.name ?? "No plan"}</p>
              {plan && (
                <p className="mt-1 text-sm text-slate-500">
                  {org.status === "TRIAL"
                    ? "All features of this plan are included in your trial."
                    : `${formatCurrency(org.billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly)} per ${org.billingCycle === "YEARLY" ? "year" : "month"} + 18% GST`}
                </p>
              )}
              <div className="mt-4 space-y-1 text-sm">
                {org.status === "TRIAL" && (
                  <p className={cn("font-medium", access.state === "trial_expired" ? "text-rose-600" : "text-slate-700")}>
                    {access.state === "trial_expired" ? `Trial ended on ${formatDate(org.trialEndsAt)}` : `Trial ends on ${formatDate(org.trialEndsAt)} (${access.daysLeft} days left)`}
                  </p>
                )}
                {org.status === "ACTIVE" && org.currentPeriodEnd && <p className="text-slate-700">Renews on {formatDate(org.currentPeriodEnd)}</p>}
                {org.status === "CANCELLED" && (
                  <p className="text-slate-700">{org.currentPeriodEnd && org.currentPeriodEnd > new Date() ? `Access continues until ${formatDate(org.currentPeriodEnd)}` : "Subscription ended"}</p>
                )}
                {org.status === "PAST_DUE" && <p className="font-medium text-amber-700">We could not collect your last payment. Razorpay will retry automatically; you can also subscribe again below.</p>}
              </div>
              {isAdmin && (org.status === "ACTIVE" || org.status === "PAST_DUE") && org.razorpaySubscriptionId && (
                <div className="mt-4">
                  <CancelSubscriptionButton periodEnd={org.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : null} />
                </div>
              )}
            </div>
            <div className="space-y-4">
              {meters.map((m) => {
                const pct = usagePercent(m.used, m.limit);
                return (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-slate-600">{m.label}</span>
                      <span className="font-medium text-slate-900">
                        {m.used.toLocaleString("en-IN")} <span className="font-normal text-slate-400">/ {m.limit ? m.limit.toLocaleString("en-IN") : "Unlimited"}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-600")} style={{ width: `${m.limit ? pct : 4}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Included in your plan" />
          <ul className="space-y-2 p-5 text-sm">
            {planFeatures(plan).map((f: FeatureKey) => (
              <li key={f} className="flex items-start gap-2 text-slate-700">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                {FEATURES[f]}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {!online && (
        <div className="card flex flex-col gap-3 border-amber-200 bg-amber-50/60 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Online payments are not configured yet</p>
            <p className="mt-0.5 text-sm text-slate-600">Contact us to activate or change your plan. We will set it up for you right away.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {supportEmail && (
              <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Activate plan for ${org.name}`)}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                <Mail className="size-4" /> {supportEmail}
              </a>
            )}
            {supportPhone && (
              <a href={`tel:${supportPhone}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                <Phone className="size-4" /> {supportPhone}
              </a>
            )}
          </div>
        </div>
      )}

      <PlanPicker
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          maxUsers: p.maxUsers,
          maxLeads: p.maxLeads,
          maxProperties: p.maxProperties,
          highlighted: p.highlighted,
          features: planFeatures(p).map((f) => FEATURES[f]),
          onlineReady: Boolean(p.razorpayPlanIdMonthly || p.razorpayPlanIdYearly),
          monthlyWithGst: priceWithGst(p.priceMonthly),
          yearlyWithGst: priceWithGst(p.priceYearly),
        }))}
        currentPlanId={org.status === "ACTIVE" || org.status === "PAST_DUE" ? org.planId : null}
        currentCycle={org.billingCycle as "MONTHLY" | "YEARLY"}
        canBuy={isAdmin && online}
        isAdmin={isAdmin}
        brandColor="#4f46e5"
      />

      <Card>
        <CardHeader title="Invoices" description="GST tax invoices for your subscription payments" />
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Invoices appear here after your first payment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Invoice</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Description</th>
                  <th className="table-th text-right">Amount</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="table-td font-medium text-slate-900">{inv.number}</td>
                    <td className="table-td">{formatDate(inv.createdAt)}</td>
                    <td className="table-td whitespace-normal text-slate-600">{inv.description}</td>
                    <td className="table-td text-right font-medium">{formatCurrency(inv.amount)}</td>
                    <td className="table-td">
                      <Badge className={inv.status === "PAID" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-rose-50 text-rose-700 ring-rose-600/20"}>{inv.status === "PAID" ? "Paid" : inv.status}</Badge>
                    </td>
                    <td className="table-td text-right">
                      <a href={`/api/billing/invoices/${inv.id}`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-brand-600 hover:underline">
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
