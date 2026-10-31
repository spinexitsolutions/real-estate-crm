import {
  BadgePercent,
  ChartColumn,
  Clock,
  IndianRupee,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatCompact, formatCurrency } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { FilterSelect, SegmentTabs } from "@/components/ui/filters";
import { AreaTrend, BarSimple, DonutChart, FunnelBars, ProgressBar } from "@/components/charts";
import { cn } from "@/lib/utils";
import { getReportData } from "./data";
import { RANGES } from "./range";
import { ReportActions } from "./toolbar";

export const metadata = { title: "Reports & Analytics" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; agent?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const cur = settings.currency;
  const manager = isManager(user);
  const data = await getReportData(user, sp.range, manager ? sp.agent : undefined);
  const agentsList = manager
    ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const query = new URLSearchParams();
  if (sp.range) query.set("range", sp.range);
  if (manager && sp.agent) query.set("agent", sp.agent);
  const k = data.kpis;
  const CurrencyIcon = cur === "INR" ? IndianRupee : Wallet;

  return (
    <div className="space-y-6">
      <style>{`@media print { aside, header { display: none !important; } .lg\\:pl-64 { padding-left: 0 !important; } body, html { background: #fff !important; } .card { break-inside: avoid; box-shadow: none !important; } }`}</style>
      <PageHeader
        title="Reports & Analytics"
        description={`Performance overview - ${data.range.label}${!manager ? " (your data)" : ""}`}
        icon={ChartColumn}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ReportActions query={query.toString()} />
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <SegmentTabs param="range" defaultValue="90d" options={RANGES} />
        {manager && <FilterSelect param="agent" placeholder="All team members" options={agentsList.map((a) => ({ value: a.id, label: a.name }))} />}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Leads" value={k.totalLeads} icon={Users} tone="brand" sub="created in range" />
        <StatCard label="Conversion rate" value={`${k.conversion}%`} icon={Target} tone="violet" sub={`${k.wonLeads} won`} />
        <StatCard label="Revenue closed" value={formatCompact(k.revenue, cur)} icon={CurrencyIcon} tone="emerald" sub={`${k.dealsWon} deals`} />
        <StatCard label="Commission earned" value={formatCompact(k.commission, cur)} icon={BadgePercent} tone="sky" />
        <StatCard label="Avg deal size" value={formatCompact(k.avgDeal, cur)} icon={TrendingUp} tone="amber" />
        <StatCard label="Avg days to close" value={k.avgDays || "-"} icon={Clock} tone="rose" sub="lead to booking" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Leads over time" description="New enquiries created" />
          <div className="p-5">
            <AreaTrend data={data.leadsTrend} seriesName="Leads" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue closed" description="Value of deals marked as won" />
          <div className="p-5">
            <BarSimple data={data.revenueTrend} currency={cur} color="#10b981" seriesName="Revenue" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Lead source performance" description="Which channels bring leads that convert" />
          {data.sources.length === 0 ? (
            <EmptyState icon={ChartColumn} title="No leads in this period" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <th className="table-th">Source</th>
                    <th className="table-th text-right">Leads</th>
                    <th className="table-th text-right">Qualified</th>
                    <th className="table-th text-right">Won</th>
                    <th className="table-th text-right">Conversion</th>
                    <th className="table-th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.sources.map((s) => (
                    <tr key={s.source} className="hover:bg-slate-50/60">
                      <td className="table-td font-medium text-slate-900">{s.label}</td>
                      <td className="table-td text-right">{s.leads}</td>
                      <td className="table-td text-right">{s.qualified}</td>
                      <td className="table-td text-right">{s.won}</td>
                      <td className="table-td text-right">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", s.conversion >= 15 ? "bg-emerald-50 text-emerald-700" : s.conversion >= 5 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
                          {s.conversion}%
                        </span>
                      </td>
                      <td className="table-td text-right font-medium text-slate-900">{formatCompact(s.revenue, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Leads by source" />
          <div className="p-5">
            <DonutChart data={data.sources.slice(0, 8).map((s) => ({ label: s.label, value: s.leads }))} centerLabel="Leads" legend />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Conversion funnel" description="Leads that reached each stage" />
          <div className="p-5">
            <FunnelBars data={data.funnel} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lost reasons" description="Why deals did not go through" />
          <div className="p-5">
            {data.lostReasons.length === 0 ? (
              <EmptyState icon={Target} title="No lost leads" description="No leads were marked lost in this period." className="py-8" />
            ) : (
              <BarSimple data={data.lostReasons.slice(0, 7)} horizontal color="#f43f5e" height={Math.max(160, data.lostReasons.slice(0, 7).length * 38)} seriesName="Leads" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Follow-up discipline" description={`${k.fuCompletion}% of due follow-ups completed`} />
          <div className="divide-y divide-slate-100">
            {data.followUpStats.length === 0 ? (
              <EmptyState icon={Clock} title="No follow-ups in this period" className="py-8" />
            ) : (
              data.followUpStats.map((f) => (
                <div key={f.type} className="px-5 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-slate-700">{f.label}</span>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-900">{f.completed}</span>/{f.total} done
                      {f.overdue > 0 && <span className="ml-2 font-medium text-rose-600">{f.overdue} overdue</span>}
                    </span>
                  </div>
                  <ProgressBar value={f.rate} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Team leaderboard" description="Ranked by revenue closed in range. Target progress is for the current month." />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-100 bg-slate-50/60">
              <tr>
                <th className="table-th w-10">#</th>
                <th className="table-th">Member</th>
                <th className="table-th text-right">Leads</th>
                <th className="table-th text-right">Follow-ups done</th>
                <th className="table-th text-right">Overdue</th>
                <th className="table-th text-right">Deals won</th>
                <th className="table-th text-right">Revenue</th>
                <th className="table-th min-w-56">Monthly target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.agents.map((a, i) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="table-td">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "text-slate-400")}>{i + 1}</span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.name} size="sm" />
                      <span className="font-medium text-slate-900">{a.name}</span>
                    </div>
                  </td>
                  <td className="table-td text-right">{a.leads}</td>
                  <td className="table-td text-right">{a.followUpsDone}</td>
                  <td className={cn("table-td text-right", a.overdue > 0 && "font-medium text-rose-600")}>{a.overdue}</td>
                  <td className="table-td text-right">{a.dealsWon}</td>
                  <td className="table-td text-right font-semibold text-slate-900">{formatCompact(a.revenue, cur)}</td>
                  <td className="table-td">
                    {a.achievement === null ? (
                      <span className="text-xs text-slate-400">No target set</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <ProgressBar value={a.achievement} className="flex-1" />
                        <span className="w-28 text-right text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{a.achievement}%</span> of {formatCompact(a.target, cur)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Lead status mix" description="Current status of leads in range" />
          <div className="p-5">
            <DonutChart data={data.statusBreakdown} centerLabel="Leads" colors={["#0ea5e9", "#4f46e5", "#8b5cf6", "#f59e0b", "#f97316", "#10b981", "#f43f5e"]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Inventory by status" description={`${data.totalProperties} properties - ${formatCurrency(data.inventoryValue, cur)} available for sale`} />
          <div className="p-5">
            <DonutChart data={data.inventoryStatus} centerLabel="Properties" colors={["#10b981", "#f59e0b", "#64748b", "#0ea5e9", "#f43f5e"]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Inventory by type" />
          <div className="p-5">
            <BarSimple data={data.inventoryType} horizontal multiColor height={Math.max(180, data.inventoryType.length * 36)} seriesName="Properties" />
          </div>
        </Card>
      </div>
    </div>
  );
}
