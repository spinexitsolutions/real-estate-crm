import "server-only";
import { differenceInCalendarDays, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { isManager, type CurrentUser } from "@/lib/auth";
import {
  FOLLOWUP_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  labelOf,
} from "@/lib/constants";
import { bucketize, resolveRange } from "./range";

const QUALIFIED = ["QUALIFIED", "SITE_VISIT", "NEGOTIATION", "WON"];
const FUNNEL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "NEGOTIATION", "WON"];

export async function resolveScope(user: CurrentUser, agentParam?: string) {
  if (!isManager(user)) return user.id;
  if (agentParam) return agentParam;
  return null;
}

export async function getReportData(user: CurrentUser, rangeParam?: string, agentParam?: string) {
  const agentId = await resolveScope(user, agentParam);
  const earliest = await db.lead.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const range = resolveRange(rangeParam, earliest?.createdAt);
  const { start, end, granularity } = range;
  const now = new Date();

  const leadScope = agentId ? { assignedToId: agentId } : {};
  const dealScope = agentId ? { agentId } : {};
  const fuScope = agentId ? { assignedToId: agentId } : {};

  const [leads, wonDeals, lostLeads, followUps, overdueByUser, properties, users, monthDeals] = await Promise.all([
    db.lead.findMany({
      where: { ...leadScope, createdAt: { gte: start } },
      select: { id: true, source: true, status: true, createdAt: true, assignedToId: true },
    }),
    db.deal.findMany({
      where: { ...dealScope, stage: "WON", closedAt: { gte: start } },
      select: { id: true, value: true, commissionPct: true, closedAt: true, createdAt: true, agentId: true, lead: { select: { source: true, createdAt: true } } },
    }),
    db.lead.findMany({
      where: { ...leadScope, status: "LOST", updatedAt: { gte: start } },
      select: { lostReason: true },
    }),
    db.followUp.findMany({
      where: { ...fuScope, dueAt: { gte: start, lte: end } },
      select: { type: true, status: true, dueAt: true, completedAt: true, assignedToId: true },
    }),
    db.followUp.groupBy({
      by: ["assignedToId"],
      where: { ...fuScope, status: "PENDING", dueAt: { lt: now } },
      _count: { _all: true },
    }),
    db.property.findMany({
      where: agentId ? { agentId } : {},
      select: { status: true, type: true, price: true, listingType: true },
    }),
    db.user.findMany({
      where: agentId ? { id: agentId } : { active: true },
      select: { id: true, name: true, role: true, monthlyTarget: true },
      orderBy: { name: "asc" },
    }),
    db.deal.findMany({
      where: { ...dealScope, stage: "WON", closedAt: { gte: startOfMonth(now) } },
      select: { value: true, agentId: true },
    }),
  ]);

  // KPIs
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "WON").length;
  const revenue = wonDeals.reduce((s, d) => s + d.value, 0);
  const commission = wonDeals.reduce((s, d) => s + (d.value * d.commissionPct) / 100, 0);
  const avgDeal = wonDeals.length ? revenue / wonDeals.length : 0;
  const daysToClose = wonDeals
    .map((d) => (d.closedAt ? differenceInCalendarDays(d.closedAt, d.lead?.createdAt ?? d.createdAt) : null))
    .filter((x): x is number => x !== null && x >= 0);
  const avgDays = daysToClose.length ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length) : 0;

  const leadsTrend = bucketize(leads, (l) => l.createdAt, () => 1, start, end, granularity);
  const revenueTrend = bucketize(wonDeals, (d) => d.closedAt, (d) => d.value, start, end, granularity);

  // Sources
  const sources = LEAD_SOURCES.map((s) => {
    const ls = leads.filter((l) => l.source === s.value);
    const won = ls.filter((l) => l.status === "WON").length;
    return {
      source: s.value,
      label: s.label,
      leads: ls.length,
      qualified: ls.filter((l) => QUALIFIED.includes(l.status)).length,
      won,
      conversion: ls.length ? Math.round((won / ls.length) * 1000) / 10 : 0,
      revenue: wonDeals.filter((d) => d.lead?.source === s.value).reduce((a, d) => a + d.value, 0),
    };
  })
    .filter((s) => s.leads > 0 || s.revenue > 0)
    .sort((a, b) => b.leads - a.leads);

  // Funnel (reached at least this stage; lost leads only count as "New")
  const idx = (st: string) => FUNNEL_ORDER.indexOf(st);
  const funnel = FUNNEL_ORDER.map((st, i) => ({
    label: labelOf(LEAD_STATUSES, st),
    value: i === 0 ? totalLeads : leads.filter((l) => idx(l.status) >= i).length,
  }));

  const statusBreakdown = LEAD_STATUSES.map((s) => ({ label: s.label, value: leads.filter((l) => l.status === s.value).length }));

  // Lost reasons
  const lostMap = new Map<string, number>();
  for (const l of lostLeads) {
    const k = l.lostReason?.trim() || "Not specified";
    lostMap.set(k, (lostMap.get(k) ?? 0) + 1);
  }
  const lostReasons = [...lostMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // Agents
  const overdueMap = new Map(overdueByUser.map((o) => [o.assignedToId, o._count._all]));
  const agents = users
    .map((u) => {
      const rev = wonDeals.filter((d) => d.agentId === u.id).reduce((a, d) => a + d.value, 0);
      const monthRev = monthDeals.filter((d) => d.agentId === u.id).reduce((a, d) => a + d.value, 0);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        leads: leads.filter((l) => l.assignedToId === u.id).length,
        followUpsDone: followUps.filter((f) => f.assignedToId === u.id && f.status === "COMPLETED").length,
        overdue: overdueMap.get(u.id) ?? 0,
        dealsWon: wonDeals.filter((d) => d.agentId === u.id).length,
        revenue: rev,
        monthRevenue: monthRev,
        target: u.monthlyTarget,
        achievement: u.monthlyTarget > 0 ? Math.round((monthRev / u.monthlyTarget) * 100) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.dealsWon - a.dealsWon || b.leads - a.leads);

  // Inventory
  const inventoryStatus = PROPERTY_STATUSES.map((s) => ({ label: s.label, value: properties.filter((p) => p.status === s.value).length }));
  const inventoryType = PROPERTY_TYPES.map((t) => ({ label: t.label, value: properties.filter((p) => p.type === t.value).length })).filter((x) => x.value > 0);
  const inventoryValue = properties.filter((p) => p.status === "AVAILABLE" && p.listingType === "SALE").reduce((a, p) => a + p.price, 0);

  // Follow-ups
  const followUpStats = FOLLOWUP_TYPES.map((t) => {
    const fs = followUps.filter((f) => f.type === t.value);
    const completed = fs.filter((f) => f.status === "COMPLETED").length;
    const overdue = fs.filter((f) => f.status === "PENDING" && f.dueAt < now).length;
    const due = fs.filter((f) => f.dueAt <= now && f.status !== "CANCELLED").length;
    return { type: t.value, label: t.label, total: fs.length, completed, overdue, rate: due ? Math.round((completed / due) * 100) : 0 };
  }).filter((f) => f.total > 0);
  const fuDue = followUps.filter((f) => f.dueAt <= now && f.status !== "CANCELLED");
  const fuCompletion = fuDue.length ? Math.round((fuDue.filter((f) => f.status === "COMPLETED").length / fuDue.length) * 100) : 0;

  return {
    range,
    agentId,
    kpis: {
      totalLeads,
      wonLeads,
      conversion: totalLeads ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0,
      revenue,
      commission,
      avgDeal,
      avgDays,
      dealsWon: wonDeals.length,
      fuCompletion,
    },
    leadsTrend,
    revenueTrend,
    sources,
    funnel,
    statusBreakdown,
    lostReasons,
    agents,
    inventoryStatus,
    inventoryType,
    inventoryValue,
    totalProperties: properties.length,
    followUpStats,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
