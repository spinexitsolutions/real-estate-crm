import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { addDays, format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { AlertTriangle, Building2, CircleDollarSign, Clock, Hourglass, Repeat, TrendingUp, UserPlus } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin, orgMrr, ORG_STATUSES, AUDIT_LABELS } from "@/lib/admin";
import { formatCompact, formatCurrency, formatDate, formatRelative, percent } from "@/lib/format";
import { waLink } from "@/lib/utils";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { OptionBadge } from "@/components/ui/badge";
import { WhatsAppIcon } from "@/components/ui/icons";
import { BarSimple, DonutChart } from "@/components/charts";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  await requireSuperAdmin();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const cohortStart = addDays(now, -90);

  const [orgs, audit] = await Promise.all([
    rawDb.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        billingCycle: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
        ownerName: true,
        ownerPhone: true,
        ownerEmail: true,
        city: true,
        plan: { select: { name: true, priceMonthly: true, priceYearly: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    rawDb.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const count = (s: string) => orgs.filter((o) => o.status === s).length;
  const activeTrials = orgs.filter((o) => o.status === "TRIAL" && (!o.trialEndsAt || o.trialEndsAt > now));
  const trialsEndingSoon = activeTrials
    .filter((o) => o.trialEndsAt && o.trialEndsAt <= addDays(now, 7))
    .sort((a, b) => (a.trialEndsAt!.getTime() - b.trialEndsAt!.getTime()));
  const expiredTrials = orgs.filter((o) => o.status === "TRIAL" && o.trialEndsAt && o.trialEndsAt <= now);
  const pastDue = orgs.filter((o) => o.status === "PAST_DUE");

  const mrr = orgs.reduce((s, o) => s + orgMrr(o), 0);
  const signupsThisMonth = orgs.filter((o) => o.createdAt >= monthStart).length;
  const signupsLastMonth = orgs.filter((o) => o.createdAt >= prevMonthStart && o.createdAt < monthStart).length;
  const signupTrend = signupsLastMonth ? Math.round(((signupsThisMonth - signupsLastMonth) / signupsLastMonth) * 100) : null;

  // Trial -> paid conversion for companies that signed up in the last 90 days and finished their trial
  const cohort = orgs.filter((o) => o.createdAt >= cohortStart);
  const decided = cohort.filter((o) => !(o.status === "TRIAL" && o.trialEndsAt && o.trialEndsAt > now));
  const converted = decided.filter((o) => ["ACTIVE", "PAST_DUE"].includes(o.status) || (o.status === "CANCELLED" && o.currentPeriodEnd));
  const conversion = percent(converted.length, decided.length);

  // Churn this month: subscriptions cancelled this month vs paying companies
  const churned = orgs.filter((o) => o.status === "CANCELLED" && o.updatedAt >= monthStart).length;
  const paying = count("ACTIVE") + count("PAST_DUE");
  const churnRate = percent(churned, paying + churned);

  // Signups per week, last 12 weeks
  const weeks = Array.from({ length: 12 }, (_, i) => startOfWeek(subWeeks(now, 11 - i), { weekStartsOn: 1 }));
  const signupsByWeek = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? addDays(w, 7);
    return { label: format(w, "dd MMM"), value: orgs.filter((o) => o.createdAt >= w && o.createdAt < end).length };
  });

  const byPlan = new Map<string, number>();
  for (const o of orgs) {
    const v = orgMrr(o);
    if (v > 0) byPlan.set(o.plan!.name, (byPlan.get(o.plan!.name) ?? 0) + v);
  }
  const mrrByPlan = [...byPlan.entries()].map(([label, value]) => ({ label, value: Math.round(value) }));

  const nudgeText = (o: { ownerName: string | null; trialEndsAt: Date | null }) =>
    `Hi ${o.ownerName?.split(" ")[0] ?? ""}, your ${BRAND.name} free trial ends on ${formatDate(o.trialEndsAt)}. Can I help you set up anything or choose a plan so your team keeps working without interruption?`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-[22px]">Platform overview</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{format(now, "EEEE, d MMMM yyyy")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(Math.round(mrr))} icon={CircleDollarSign} tone="emerald" sub={<span>ARR {formatCompact(mrr * 12)}</span>} />
        <StatCard label="Paying companies" value={count("ACTIVE")} icon={Building2} tone="brand" sub={<span>{orgs.length} companies in total</span>} />
        <StatCard
          label="On free trial"
          value={activeTrials.length}
          icon={Hourglass}
          tone="sky"
          sub={<span>{trialsEndingSoon.length} ending in 7 days, {expiredTrials.length} expired</span>}
        />
        <StatCard label="Signups this month" value={signupsThisMonth} icon={UserPlus} tone="violet" trend={signupTrend} sub={<span>{signupsLastMonth} last month</span>} />
        <StatCard label="Trial to paid (90 days)" value={`${conversion}%`} icon={TrendingUp} tone="emerald" sub={<span>{converted.length} of {decided.length} finished trials</span>} />
        <StatCard label="Churn this month" value={`${churnRate}%`} icon={Repeat} tone={churned ? "rose" : "brand"} sub={<span>{churned} cancelled</span>} />
        <StatCard label="Past due" value={pastDue.length} icon={AlertTriangle} tone={pastDue.length ? "amber" : "brand"} sub={<span>Payment failed, grace period</span>} />
        <StatCard label="Suspended" value={count("SUSPENDED")} icon={Clock} tone={count("SUSPENDED") ? "rose" : "brand"} sub={<span>{count("CANCELLED")} cancelled</span>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="New companies per week" description="Last 12 weeks" />
          <div className="px-3 pb-3 pt-4">
            <BarSimple data={signupsByWeek} height={240} seriesName="Signups" />
          </div>
        </Card>
        <Card>
          <CardHeader title="MRR by plan" />
          <div className="p-5">
            {mrrByPlan.length ? <DonutChart data={mrrByPlan} currency="INR" centerLabel="MRR" height={170} /> : <p className="py-10 text-center text-sm text-zinc-500">No paying companies yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Trials ending soon" description="Next 7 days - nudge them to subscribe" />
          {trialsEndingSoon.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No trials ending this week.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {trialsEndingSoon.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/admin/companies/${o.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 hover:underline">{o.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {o.ownerName ?? "-"} {o.ownerPhone ? `- ${o.ownerPhone}` : ""} - ends {formatRelative(o.trialEndsAt)}
                    </p>
                  </Link>
                  {o.ownerPhone && (
                    <a href={waLink(o.ownerPhone, nudgeText(o))} target="_blank" rel="noreferrer" title="Nudge on WhatsApp" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50">
                      <WhatsAppIcon className="size-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Newest signups" action={<Link href="/admin/companies" className="text-[13px] font-medium text-zinc-600 hover:underline">All companies</Link>} />
          <ul className="divide-y divide-zinc-100">
            {orgs.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/companies/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{o.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {[o.city, o.ownerEmail].filter(Boolean).join(" - ")} - {formatRelative(o.createdAt)}
                    </p>
                  </div>
                  <OptionBadge list={ORG_STATUSES} value={o.status} withDot />
                </Link>
              </li>
            ))}
            {orgs.length === 0 && <li className="px-5 py-8 text-center text-sm text-zinc-500">No companies yet.</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Past due" description="Payment failed - follow up" />
          {pastDue.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No failed payments.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {pastDue.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/companies/${o.id}`} className="block px-5 py-3 hover:bg-zinc-50">
                    <p className="text-sm font-medium text-zinc-900">{o.name}</p>
                    <p className="text-xs text-zinc-500">
                      {o.plan?.name ?? "No plan"} - period ended {formatDate(o.currentPeriodEnd)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent admin activity" action={<Link href="/admin/audit" className="text-[13px] font-medium text-zinc-600 hover:underline">Full audit log</Link>} />
        {audit.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">No admin actions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className="font-medium text-zinc-900">{AUDIT_LABELS[a.action] ?? a.action}</span>
                {a.organizationId && (
                  <Link href={`/admin/companies/${a.organizationId}`} className="text-zinc-600 hover:underline">
                    {orgs.find((o) => o.id === a.organizationId)?.name ?? "Deleted company"}
                  </Link>
                )}
                <span className="text-xs text-zinc-500">
                  by {a.actorEmail} - {formatRelative(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
