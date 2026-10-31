import { Suspense } from "react";
import { startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";
import { CircleDollarSign, Handshake, Percent, Trophy, Wallet } from "lucide-react";
import { isManager, leadScope, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatCompact } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui/card";
import { ClearFilters, FilterSelect, SearchInput, SegmentTabs } from "@/components/ui/filters";
import { DealsView, NewDealButton, type DealRow } from "@/components/deals/deals-view";
import { DEAL_STAGES } from "@/lib/constants";

export const metadata = { title: "Deals" };

const OPEN = ["NEGOTIATION", "TOKEN", "AGREEMENT"];
// Probability of closing used for the weighted forecast
const STAGE_WEIGHT: Record<string, number> = { NEGOTIATION: 0.3, TOKEN: 0.6, AGREEMENT: 0.85 };

type SP = Record<string, string | undefined>;

export default async function DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const currency = settings.currency;
  const view = sp.view === "list" ? "list" : "board";
  const manager = isManager(user);

  const scope: Prisma.DealWhereInput = manager ? {} : { agentId: user.id };
  const where: Prisma.DealWhereInput = { ...scope };
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { lead: { name: { contains: sp.q, mode: "insensitive" } } }, { property: { code: { contains: sp.q, mode: "insensitive" } } }];
  if (sp.agent && manager) where.agentId = sp.agent;
  if (sp.stage) where.stage = sp.stage;

  const [deals, allScoped, leads, properties, users] = await Promise.all([
    db.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { title: true, code: true } },
        agent: { select: { name: true } },
      },
    }),
    db.deal.findMany({ where: scope, select: { stage: true, value: true, commissionPct: true, closedAt: true } }),
    db.lead.findMany({ where: leadScope(user), select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    db.property.findMany({ select: { id: true, title: true, code: true, price: true }, orderBy: { code: "asc" } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const monthStart = startOfMonth(new Date());
  const open = allScoped.filter((d) => OPEN.includes(d.stage));
  const pipelineValue = open.reduce((a, d) => a + d.value, 0);
  const weightedCommission = open.reduce((a, d) => a + ((d.value * d.commissionPct) / 100) * (STAGE_WEIGHT[d.stage] ?? 0.3), 0);
  const wonMonth = allScoped.filter((d) => d.stage === "WON" && d.closedAt && d.closedAt >= monthStart);
  const wonMonthValue = wonMonth.reduce((a, d) => a + d.value, 0);
  const wonMonthCommission = wonMonth.reduce((a, d) => a + (d.value * d.commissionPct) / 100, 0);
  const won = allScoped.filter((d) => d.stage === "WON").length;
  const lost = allScoped.filter((d) => d.stage === "LOST").length;
  const winRate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;

  const rows: DealRow[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    commissionPct: d.commissionPct,
    stage: d.stage,
    expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    closedAt: d.closedAt?.toISOString() ?? null,
    notes: d.notes,
    leadId: d.leadId,
    leadName: d.lead.name,
    leadPhone: d.lead.phone,
    propertyId: d.propertyId,
    propertyTitle: d.property?.title ?? null,
    propertyCode: d.property?.code ?? null,
    agentId: d.agentId,
    agentName: d.agent?.name ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Deals"
        description="Track negotiations through to closing and forecast your commission."
        icon={Handshake}
        actions={
          <Suspense>
            <NewDealButton />
          </Suspense>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatCompact(pipelineValue, currency)} icon={Wallet} tone="brand" sub={`${open.length} active deals`} />
        <StatCard label="Expected commission" value={formatCompact(Math.round(weightedCommission), currency)} icon={CircleDollarSign} tone="violet" sub="weighted by stage" />
        <StatCard
          label="Won this month"
          value={formatCompact(wonMonthValue, currency)}
          icon={Trophy}
          tone="emerald"
          sub={`${wonMonth.length} deals, ${formatCompact(Math.round(wonMonthCommission), currency)} earned`}
        />
        <StatCard label="Win rate" value={`${winRate}%`} icon={Percent} tone="amber" sub={`${won} won, ${lost} lost`} />
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-2 p-3">
        <SearchInput placeholder="Search deal, lead or property code..." className="w-full sm:w-72" />
        {view === "list" && <FilterSelect param="stage" options={DEAL_STAGES} placeholder="All stages" />}
        {manager && <FilterSelect param="agent" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="All agents" />}
        <ClearFilters keys={["q", "agent", "stage"]} />
        <div className="ml-auto">
          <SegmentTabs
            param="view"
            defaultValue="board"
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
      </div>

      <Suspense>
        <DealsView deals={rows} view={view} currency={currency} defaultCommission={settings.defaultCommission} lists={{ leads, properties, users }} />
      </Suspense>
    </>
  );
}
