import Link from "next/link";
import { addDays, endOfDay, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Flame,
  Handshake,
  Plus,
  Target,
  TrendingUp,
  Users,
  CalendarCheck,
  PhoneCall,
  Building2,
} from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_LEAD_STATUSES, labelOf } from "@/lib/constants";
import { formatBudget, formatCompact, formatRelative, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { AreaTrend, DonutChart, FunnelBars } from "@/components/charts";
import { FollowUpList } from "@/components/followups/followup-list";
import { SendWhatsAppButton } from "@/components/whatsapp/send-whatsapp";

export const metadata = { title: "Dashboard" };

function trend(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const cur = settings.currency;
  const manager = isManager(user);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthSameDay = subMonths(now, 1);
  const leadScope = manager ? {} : { assignedToId: user.id };
  const dealScope = manager ? {} : { agentId: user.id };
  const fuScope = manager ? {} : { assignedToId: user.id };
  const trendStart = startOfDay(subDays(now, 29));

  const [
    openLeads,
    newThisMonth,
    newPrevMonth,
    dueToday,
    overdue,
    pipelineAgg,
    wonThisMonth,
    wonPrevMonth,
    totalClosedLeads,
    wonLeads,
    statusGroups,
    sourceGroups,
    recentLeads,
    agenda,
    hotLeads,
    activities,
    users,
    properties,
    agents,
    availableProps,
  ] = await Promise.all([
    db.lead.count({ where: { ...leadScope, status: { in: OPEN_LEAD_STATUSES } } }),
    db.lead.count({ where: { ...leadScope, createdAt: { gte: monthStart } } }),
    db.lead.count({ where: { ...leadScope, createdAt: { gte: prevMonthStart, lte: prevMonthSameDay } } }),
    db.followUp.count({ where: { ...fuScope, status: "PENDING", dueAt: { gte: startOfDay(now), lte: endOfDay(now) } } }),
    db.followUp.count({ where: { ...fuScope, status: "PENDING", dueAt: { lt: startOfDay(now) } } }),
    db.deal.aggregate({ where: { ...dealScope, stage: { in: ["NEGOTIATION", "TOKEN", "AGREEMENT"] } }, _sum: { value: true }, _count: true }),
    db.deal.findMany({ where: { ...dealScope, stage: "WON", closedAt: { gte: monthStart } }, select: { value: true, commissionPct: true } }),
    db.deal.findMany({ where: { ...dealScope, stage: "WON", closedAt: { gte: prevMonthStart, lte: prevMonthSameDay } }, select: { value: true } }),
    db.lead.count({ where: { ...leadScope, status: { in: ["WON", "LOST"] } } }),
    db.lead.count({ where: { ...leadScope, status: "WON" } }),
    db.lead.groupBy({ by: ["status"], where: leadScope, _count: true }),
    db.lead.groupBy({ by: ["source"], where: leadScope, _count: true, orderBy: { _count: { source: "desc" } } }),
    db.lead.findMany({ where: { ...leadScope, createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    db.followUp.findMany({
      where: { ...fuScope, status: "PENDING", dueAt: { lte: endOfDay(now) } },
      orderBy: { dueAt: "asc" },
      take: 8,
      include: { lead: { select: { id: true, name: true, phone: true } }, property: { select: { id: true, title: true, code: true } }, assignedTo: { select: { id: true, name: true } } },
    }),
    db.lead.findMany({
      where: {
        ...leadScope,
        priority: "HOT",
        status: { in: OPEN_LEAD_STATUSES },
        OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: subDays(now, 2) } }],
      },
      orderBy: [{ lastContactedAt: "asc" }],
      take: 6,
    }),
    db.activity.findMany({
      where: manager ? { leadId: { not: null } } : { lead: { assignedToId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } }, lead: { select: { id: true, name: true } } },
    }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
    db.property.findMany({ where: { status: "AVAILABLE" }, select: { id: true, title: true, code: true }, take: 200 }),
    manager
      ? db.user.findMany({
          where: { active: true, role: { in: ["AGENT", "MANAGER"] } },
          select: {
            id: true,
            name: true,
            monthlyTarget: true,
            deals: { where: { stage: "WON", closedAt: { gte: monthStart } }, select: { value: true } },
            _count: { select: { assignedLeads: { where: { status: { in: OPEN_LEAD_STATUSES } } } } },
          },
        })
      : Promise.resolve([]),
    db.property.count({ where: { status: "AVAILABLE" } }),
  ]);

  const revenue = wonThisMonth.reduce((s, d) => s + d.value, 0);
  const commission = wonThisMonth.reduce((s, d) => s + (d.value * d.commissionPct) / 100, 0);
  const revenuePrev = wonPrevMonth.reduce((s, d) => s + d.value, 0);
  const conversion = percent(wonLeads, totalClosedLeads);

  // Leads trend: last 30 days
  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) byDay.set(format(addDays(trendStart, i), "dd MMM"), 0);
  for (const l of recentLeads) {
    const k = format(l.createdAt, "dd MMM");
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const trendData = [...byDay.entries()].map(([label, value]) => ({ label, value }));

  const funnel = LEAD_STATUSES.filter((s) => s.value !== "LOST").map((s) => {
    const idx = LEAD_STATUSES.findIndex((x) => x.value === s.value);
    // cumulative: leads that reached at least this stage (approximation using current status)
    const reached = statusGroups.filter((g) => {
      const gi = LEAD_STATUSES.findIndex((x) => x.value === g.status);
      return g.status !== "LOST" && gi >= idx;
    });
    return { label: s.label, value: reached.reduce((a, g) => a + g._count, 0) + (s.value === "NEW" ? (statusGroups.find((g) => g.status === "LOST")?._count ?? 0) : 0) };
  });

  const sources = sourceGroups.slice(0, 6).map((g) => ({ label: labelOf(LEAD_SOURCES, g.source), value: g._count }));
  const otherSources = sourceGroups.slice(6).reduce((s, g) => s + g._count, 0);
  if (otherSources) sources.push({ label: "Others", value: otherSources });

  const myTarget = manager ? agents.reduce((s, a) => s + a.monthlyTarget, 0) : (await db.user.findUnique({ where: { id: user.id }, select: { monthlyTarget: true } }))?.monthlyTarget ?? 0;
  const targetPct = myTarget ? Math.min(100, Math.round((revenue / myTarget) * 100)) : 0;

  const leaderboard = agents
    .map((a) => ({ id: a.id, name: a.name, revenue: a.deals.reduce((s, d) => s + d.value, 0), won: a.deals.length, open: a._count.assignedLeads, target: a.monthlyTarget }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{format(now, "EEEE, d MMMM yyyy")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            You have <span className="font-semibold text-slate-800">{dueToday + overdue} follow-ups</span> to clear today
            {overdue > 0 && (
              <>
                , including <span className="font-semibold text-rose-600">{overdue} overdue</span>
              </>
            )}
            .
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/follow-ups" variant="secondary">
            <CalendarClock /> My agenda
          </LinkButton>
          <LinkButton href="/leads?new=1">
            <Plus /> Add lead
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active leads" value={openLeads} icon={Users} tone="brand" trend={trend(newThisMonth, newPrevMonth)} sub={<span>{newThisMonth} new this month</span>} />
        <StatCard
          label="Follow-ups today"
          value={dueToday + overdue}
          icon={CalendarClock}
          tone={overdue ? "rose" : "amber"}
          sub={overdue ? <span className="font-medium text-rose-600">{overdue} overdue</span> : <span>All on track</span>}
        />
        <StatCard label="Pipeline value" value={formatCompact(pipelineAgg._sum.value ?? 0, cur)} icon={Handshake} tone="violet" sub={<span>{pipelineAgg._count} open deals</span>} />
        <StatCard label="Closed this month" value={formatCompact(revenue, cur)} icon={CircleDollarSign} tone="emerald" trend={trend(revenue, revenuePrev)} sub={<span>{formatCompact(commission, cur)} commission</span>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="New leads"
            description="Last 30 days"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                <TrendingUp className="size-3.5" /> {recentLeads.length} leads
              </span>
            }
          />
          <div className="px-3 pb-3 pt-4">
            <AreaTrend data={trendData} height={260} seriesName="Leads" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Pipeline funnel" description={`${conversion}% win rate on closed leads`} action={<Link href="/leads?view=board" className="text-[13px] font-medium text-brand-600 hover:underline">Open board</Link>} />
          <div className="p-5">
            <FunnelBars data={funnel} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Today's agenda"
            description="Overdue and due-today follow-ups"
            action={
              <Link href="/follow-ups" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {agenda.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="You are all caught up" description="No follow-ups due today. A great time to reach out to hot leads." />
          ) : (
            <FollowUpList items={agenda.map((f) => ({ ...f, dueAt: f.dueAt.toISOString(), completedAt: f.completedAt?.toISOString() ?? null }))} users={users} properties={properties} showLead />
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Flame className="size-4 text-rose-500" /> Hot leads going cold
              </span>
            }
            description="Not contacted in 2+ days"
          />
          {hotLeads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Every hot lead was contacted recently.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hotLeads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/leads/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={l.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 hover:text-brand-700">{l.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {formatBudget(l.budgetMin, l.budgetMax, cur)} - {l.lastContactedAt ? `last contact ${formatRelative(l.lastContactedAt)}` : "never contacted"}
                      </p>
                    </div>
                  </Link>
                  <a href={`tel:${l.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Call">
                    <PhoneCall className="size-4" />
                  </a>
                  <SendWhatsAppButton lead={{ id: l.id, name: l.name, phone: l.phone }} iconOnly variant="ghost" size="icon" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Lead sources" description="Where your leads come from" />
          <div className="p-5">
            <DonutChart data={sources} centerLabel="Leads" height={170} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={manager ? "Team target" : "My target"}
            description={format(now, "MMMM yyyy")}
            action={<Target className="size-4 text-slate-400" />}
          />
          <div className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{formatCompact(revenue, cur)}</p>
                <p className="text-xs text-slate-500">of {myTarget ? formatCompact(myTarget, cur) : "no target set"}</p>
              </div>
              <span className={cn("text-sm font-semibold", targetPct >= 100 ? "text-emerald-600" : targetPct >= 50 ? "text-amber-600" : "text-slate-600")}>{targetPct}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${targetPct}%` }} />
            </div>
            {manager && leaderboard.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {leaderboard.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
                    <Avatar name={a.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {a.won} won - {a.open} open leads
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{formatCompact(a.revenue, cur)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-lg font-semibold text-slate-900">{wonThisMonth.length}</p>
                  <p className="text-xs text-slate-500">Deals won</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-lg font-semibold text-slate-900">{conversion}%</p>
                  <p className="text-xs text-slate-500">Win rate</p>
                </div>
              </div>
            )}
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-600">
              <Building2 className="size-4 text-slate-400" />
              <span>
                <span className="font-semibold text-slate-800">{availableProps}</span> properties available in inventory
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          {activities.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  <Avatar name={a.user?.name ?? "System"} size="sm" />
                  <div className="min-w-0 text-sm">
                    <p className="line-clamp-2 text-slate-700">
                      <span className="font-medium text-slate-900">{a.user?.name?.split(" ")[0] ?? "System"}</span> {a.content.charAt(0).toLowerCase() + a.content.slice(1)}
                      {a.lead && (
                        <>
                          {" "}
                          on{" "}
                          <Link href={`/leads/${a.lead.id}`} className="font-medium text-brand-700 hover:underline">
                            {a.lead.name}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatRelative(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
