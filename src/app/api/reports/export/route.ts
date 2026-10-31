import { getCurrentUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { labelOf, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, DEAL_STAGES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { toCsv } from "@/lib/utils";
import { getReportData } from "@/app/(app)/reports/data";

function csvResponse(name: string, csv: string) {
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "leads";
  const data = await getReportData(user, sp.get("range") ?? undefined, isManager(user) ? sp.get("agent") ?? undefined : undefined);
  const { start } = data.range;

  if (type === "sources") {
    return csvResponse(
      "source-performance",
      toCsv(
        ["Source", "Leads", "Qualified", "Won", "Conversion %", "Revenue"],
        data.sources.map((s) => [s.label, s.leads, s.qualified, s.won, s.conversion, Math.round(s.revenue)]),
      ),
    );
  }

  if (type === "agents") {
    return csvResponse(
      "agent-leaderboard",
      toCsv(
        ["Member", "Leads", "Follow-ups Done", "Overdue", "Deals Won", "Revenue", "Revenue This Month", "Monthly Target", "Target Achievement %"],
        data.agents.map((a) => [a.name, a.leads, a.followUpsDone, a.overdue, a.dealsWon, Math.round(a.revenue), Math.round(a.monthRevenue), a.target, a.achievement ?? ""]),
      ),
    );
  }

  if (type === "deals") {
    const deals = await db.deal.findMany({
      where: { stage: "WON", closedAt: { gte: start }, ...(data.agentId ? { agentId: data.agentId } : {}) },
      include: { lead: { select: { name: true, phone: true, source: true } }, property: { select: { code: true, title: true } }, agent: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
    });
    return csvResponse(
      "closed-deals",
      toCsv(
        ["Deal", "Client", "Phone", "Source", "Property Code", "Property", "Agent", "Value", "Commission %", "Commission", "Stage", "Closed On"],
        deals.map((d) => [
          d.title,
          d.lead.name,
          d.lead.phone,
          labelOf(LEAD_SOURCES, d.lead.source),
          d.property?.code ?? "",
          d.property?.title ?? "",
          d.agent?.name ?? "",
          Math.round(d.value),
          Math.round(d.commissionPct * 100) / 100,
          Math.round((d.value * d.commissionPct) / 100),
          labelOf(DEAL_STAGES, d.stage),
          formatDate(d.closedAt),
        ]),
      ),
    );
  }

  const leads = await db.lead.findMany({
    where: { createdAt: { gte: start }, ...(data.agentId ? { assignedToId: data.agentId } : {}) },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return csvResponse(
    "leads-report",
    toCsv(
      ["Name", "Phone", "Email", "Status", "Priority", "Source", "Assigned To", "Created At"],
      leads.map((l) => [l.name, l.phone, l.email ?? "", labelOf(LEAD_STATUSES, l.status), labelOf(PRIORITIES, l.priority), labelOf(LEAD_SOURCES, l.source), l.assignedTo?.name ?? "", formatDate(l.createdAt)]),
    ),
  );
}
