import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, Kanban, List, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { isManager, leadScope, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { leadScore } from "@/lib/lead-score";
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button-styles";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { NewLeadButton } from "@/components/leads/lead-form";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadsBoard } from "@/components/leads/leads-board";
import { ImportLeadsButton } from "@/components/leads/import-leads";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

type SP = { q?: string; status?: string; source?: string; priority?: string; assignee?: string; view?: string; page?: string; sort?: string; new?: string; stage?: string };

const PAGE_SIZE = 25;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const manager = isManager(user);
  const board = sp.view === "board";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { preferredLocation: { contains: sp.q, mode: "insensitive" } }, { tags: { contains: sp.q, mode: "insensitive" } }];
  if (sp.status) where.status = sp.status;
  else if (sp.stage === "open") where.status = { in: OPEN_LEAD_STATUSES };
  if (sp.source) where.source = sp.source;
  if (sp.priority) where.priority = sp.priority;
  if (sp.assignee && manager) where.assignedToId = sp.assignee === "none" ? null : sp.assignee;

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sp.sort === "oldest" ? { createdAt: "asc" } : sp.sort === "budget" ? { budgetMax: "desc" } : sp.sort === "name" ? { name: "asc" } : sp.sort === "contacted" ? { lastContactedAt: "asc" } : { createdAt: "desc" };

  const include = {
    assignedTo: { select: { id: true, name: true } },
    followUps: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" as const }, take: 1, select: { dueAt: true } },
  };

  const [users, total, leads, statusCounts] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    board ? Promise.resolve(0) : db.lead.count({ where }),
    db.lead.findMany({ where, orderBy, include, skip: board ? 0 : (page - 1) * PAGE_SIZE, take: board ? 500 : PAGE_SIZE }),
    db.lead.groupBy({ by: ["status"], where: { ...leadScope(user) }, _count: true }),
  ]);
  const totalAll = statusCounts.reduce((s, c) => s + c._count, 0);
  const openCount = statusCounts.filter((c) => OPEN_LEAD_STATUSES.includes(c.status)).reduce((s, c) => s + c._count, 0);

  const rows = leads.map((l) => ({
    ...l,
    score: leadScore(l),
    createdAt: l.createdAt.toISOString(),
    lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
    nextFollowUp: l.followUps[0]?.dueAt.toISOString() ?? null,
  }));

  const viewHref = (v: "list" | "board") => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (val && k !== "view" && k !== "page" && k !== "new") p.set(k, val);
    if (v === "board") p.set("view", "board");
    const qs = p.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };
  const exportParams = new URLSearchParams();
  for (const k of ["q", "status", "source", "priority", "assignee"] as const) if (sp[k]) exportParams.set(k, sp[k]!);

  return (
    <>
      <PageHeader
        icon={board ? Kanban : Users}
        title={board ? "Sales pipeline" : "Leads"}
        description={`${totalAll} total leads, ${openCount} active in pipeline`}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
              <Link href={viewHref("list")} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium", !board ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-800")}>
                <List className="size-4" /> List
              </Link>
              <Link href={viewHref("board")} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium", board ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-800")}>
                <Kanban className="size-4" /> Board
              </Link>
            </div>
            <ImportLeadsButton users={users} canAssign={manager} />
            <a href={`/api/export/leads?${exportParams.toString()}`} className={buttonClass("secondary")}>
              <Download /> Export
            </a>
            <NewLeadButton users={users} canAssign={manager} currentUserId={user.id} defaultOpen={sp.new === "1"}>
              <Plus /> Add lead
            </NewLeadButton>
          </>
        }
      />

      {!board && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <StatusPill label="All" count={totalAll} active={!sp.status} sp={sp} value={null} />
          {LEAD_STATUSES.map((s) => (
            <StatusPill key={s.value} label={s.label} dot={s.dot} count={statusCounts.find((c) => c.status === s.value)?._count ?? 0} active={sp.status === s.value} sp={sp} value={s.value} />
          ))}
        </div>
      )}

      <Card className={board ? "mb-4 border-0 bg-transparent shadow-none" : "overflow-hidden"}>
        <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center", board ? "" : "border-b border-slate-100 p-4")}>
          <SearchInput placeholder="Search name, phone, email, location, tag..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="priority" options={PRIORITIES} placeholder="All priorities" />
            <FilterSelect param="source" options={LEAD_SOURCES} placeholder="All sources" />
            {manager && <FilterSelect param="assignee" options={[{ value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} placeholder="All agents" />}
            {!board && (
              <FilterSelect
                param="sort"
                options={[
                  { value: "oldest", label: "Oldest first" },
                  { value: "budget", label: "Highest budget" },
                  { value: "name", label: "Name A-Z" },
                  { value: "contacted", label: "Least recently contacted" },
                ]}
                placeholder="Newest first"
              />
            )}
            <ClearFilters keys={["q", "priority", "source", "assignee", "sort", "status"]} />
          </div>
        </div>
        {!board && (
          <>
            <LeadsTable leads={rows} users={users} canManage={manager} currentUserId={user.id} currency={settings.currency} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/leads" searchParams={sp as Record<string, string | undefined>} />
          </>
        )}
      </Card>

      {board && (
        <LeadsBoard
          currency={settings.currency}
          leads={rows.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            status: l.status,
            priority: l.priority,
            preferredLocation: l.preferredLocation,
            bedrooms: l.bedrooms,
            budgetMin: l.budgetMin,
            budgetMax: l.budgetMax,
            assignedTo: l.assignedTo,
            nextFollowUp: l.nextFollowUp,
            score: l.score,
          }))}
        />
      )}
    </>
  );
}

function StatusPill({ label, count, active, dot, sp, value }: { label: string; count: number; active: boolean; dot?: string; sp: SP; value: string | null }) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && !["status", "page", "new", "stage"].includes(k)) p.set(k, v);
  if (value) p.set("status", value);
  const qs = p.toString();
  return (
    <Link
      href={qs ? `/leads?${qs}` : "/leads"}
      scroll={false}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
        active ? "border-brand-200 bg-white text-brand-700 shadow-xs ring-4 ring-brand-500/5" : "border-transparent text-slate-600 hover:bg-white hover:text-slate-900",
      )}
    >
      {dot && <span className={cn("size-2 rounded-full", dot)} />}
      {label}
      <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-brand-100 text-brand-700" : "bg-slate-200/70 text-slate-600")}>{count}</span>
    </Link>
  );
}
