import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, List, TriangleAlert, Clock } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { FOLLOWUP_TYPES } from "@/lib/constants";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, PageHeader, StatCard } from "@/components/ui/card";
import { ClearFilters, FilterSelect, SearchInput, SegmentTabs } from "@/components/ui/filters";
import { FollowUpList, type FollowUpItem } from "@/components/followups/followup-list";
import { FollowUpTypeIcon, TYPE_TONES } from "@/components/followups/followup-icon";
import { NewFollowUpButton } from "./new-followup-button";

export const metadata = { title: "Follow-ups" };

type SP = { tab?: string; type?: string; agent?: string; q?: string; view?: string; month?: string; day?: string; new?: string };

const include = {
  lead: { select: { id: true, name: true, phone: true } },
  property: { select: { id: true, title: true, code: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.FollowUpInclude;

type Row = Prisma.FollowUpGetPayload<{ include: typeof include }>;

function serialize(f: Row): FollowUpItem {
  return {
    id: f.id,
    title: f.title,
    type: f.type,
    dueAt: f.dueAt.toISOString(),
    status: f.status,
    priority: f.priority,
    notes: f.notes,
    outcome: f.outcome,
    completedAt: f.completedAt?.toISOString() ?? null,
    leadId: f.leadId,
    lead: f.lead,
    propertyId: f.propertyId,
    property: f.property,
    assignedToId: f.assignedToId,
    assignedTo: f.assignedTo,
  };
}

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const view = sp.view === "calendar" ? "calendar" : "list";
  const tab = ["overdue", "today", "upcoming", "completed"].includes(sp.tab ?? "") ? sp.tab! : "today";

  const scope: Prisma.FollowUpWhereInput =
    user.role === "AGENT" ? { OR: [{ assignedToId: user.id }, { lead: { assignedToId: user.id } }] } : {};
  const filters: Prisma.FollowUpWhereInput = {
    ...(sp.type ? { type: sp.type } : {}),
    ...(manager && sp.agent ? { assignedToId: sp.agent } : {}),
    ...(sp.q ? { lead: { OR: [{ name: { contains: sp.q } }, { phone: { contains: sp.q } }] } } : {}),
  };
  const base: Prisma.FollowUpWhereInput = { AND: [scope, filters] };

  const tabWhere: Record<string, Prisma.FollowUpWhereInput> = {
    overdue: { status: "PENDING", dueAt: { lt: todayStart } },
    today: { status: "PENDING", dueAt: { gte: todayStart, lte: todayEnd } },
    upcoming: { status: "PENDING", dueAt: { gt: todayEnd } },
    completed: { status: "COMPLETED" },
  };

  const thirtyAgo = subDays(now, 30);
  const [overdueCount, todayCount, upcomingCount, completedCount, weekCount, dueLast30, doneLast30, users, properties, leads] = await Promise.all([
    db.followUp.count({ where: { AND: [base, tabWhere.overdue] } }),
    db.followUp.count({ where: { AND: [base, tabWhere.today] } }),
    db.followUp.count({ where: { AND: [base, tabWhere.upcoming] } }),
    db.followUp.count({ where: { AND: [base, tabWhere.completed] } }),
    db.followUp.count({
      where: { AND: [scope, { status: "PENDING", dueAt: { gte: todayStart, lte: endOfWeek(now, { weekStartsOn: 1 }) } }] },
    }),
    db.followUp.count({ where: { AND: [scope, { dueAt: { gte: thirtyAgo, lte: now }, status: { not: "CANCELLED" } }] } }),
    db.followUp.count({ where: { AND: [scope, { dueAt: { gte: thirtyAgo, lte: now }, status: "COMPLETED" }] } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.property.findMany({ where: { status: { in: ["AVAILABLE", "RESERVED"] } }, select: { id: true, title: true, code: true }, orderBy: { code: "asc" } }),
    db.lead.findMany({
      where: { ...(user.role === "AGENT" ? { assignedToId: user.id } : {}), status: { notIn: ["LOST"] } },
      select: { id: true, name: true, phone: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  const counts: Record<string, number> = { overdue: overdueCount, today: todayCount, upcoming: upcomingCount, completed: completedCount };

  return (
    <div>
      <PageHeader
        icon={CalendarClock}
        title="Follow-ups"
        description="Calls, meetings and site visits that keep your deals moving."
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
              <ViewLink href={buildHref(sp, { view: null, month: null, day: null })} active={view === "list"} icon={List} label="List" />
              <ViewLink href={buildHref(sp, { view: "calendar", tab: null })} active={view === "calendar"} icon={CalendarDays} label="Calendar" />
            </div>
            <NewFollowUpButton autoOpen={sp.new === "1"} leads={leads} users={users} properties={properties} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overdue" value={overdueCount} icon={TriangleAlert} tone="rose" sub="Needs attention now" />
        <StatCard label="Due today" value={todayCount} icon={Clock} tone="amber" sub="Scheduled for today" />
        <StatCard label="This week" value={weekCount} icon={CalendarDays} tone="sky" sub="Pending till Sunday" />
        <StatCard label="Completion rate" value={`${percent(doneLast30, dueLast30)}%`} icon={CircleCheck} tone="emerald" sub="Last 30 days" />
      </div>

      {view === "list" ? (
        <ListView sp={sp} tab={tab} counts={counts} where={{ AND: [base, tabWhere[tab]] }} manager={manager} users={users} properties={properties} />
      ) : (
        <CalendarView sp={sp} base={base} manager={manager} users={users} properties={properties} />
      )}
    </div>
  );
}

function Filters({ manager, users }: { manager: boolean; users: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput placeholder="Search lead name or phone" className="w-full sm:w-64" />
      <FilterSelect param="type" options={FOLLOWUP_TYPES} placeholder="All types" />
      {manager && <FilterSelect param="agent" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="All members" />}
      <ClearFilters keys={["q", "type", "agent"]} />
    </div>
  );
}

async function ListView({
  sp,
  tab,
  counts,
  where,
  manager,
  users,
  properties,
}: {
  sp: SP;
  tab: string;
  counts: Record<string, number>;
  where: Prisma.FollowUpWhereInput;
  manager: boolean;
  users: { id: string; name: string }[];
  properties: { id: string; title: string; code: string }[];
}) {
  void sp;
  const rows = await db.followUp.findMany({
    where,
    include,
    orderBy: tab === "completed" ? { completedAt: "desc" } : { dueAt: tab === "overdue" ? "desc" : "asc" },
    take: 200,
  });

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const d = tab === "completed" && r.completedAt ? r.completedAt : r.dueAt;
    const key = format(d, "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <SegmentTabs
          param="tab"
          defaultValue="today"
          options={[
            { value: "overdue", label: "Overdue", count: counts.overdue },
            { value: "today", label: "Today", count: counts.today },
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "completed", label: "Completed", count: counts.completed },
          ]}
        />
        <Filters manager={manager} users={users} />
      </div>
      {rows.length === 0 ? (
        <FollowUpList items={[]} users={users} properties={properties} />
      ) : (
        [...groups.entries()].map(([key, items]) => {
          const d = parse(key, "yyyy-MM-dd", new Date());
          return (
            <section key={key}>
              <div className="sticky top-16 z-[1] flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-5 py-2 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {isToday(d) ? "Today" : format(d, "EEEE, dd MMM yyyy")}
                </p>
                <span className="text-xs text-slate-400">{items.length} item{items.length === 1 ? "" : "s"}</span>
              </div>
              <FollowUpList items={items.map(serialize)} users={users} properties={properties} />
            </section>
          );
        })
      )}
    </Card>
  );
}

async function CalendarView({
  sp,
  base,
  manager,
  users,
  properties,
}: {
  sp: SP;
  base: Prisma.FollowUpWhereInput;
  manager: boolean;
  users: { id: string; name: string }[];
  properties: { id: string; title: string; code: string }[];
}) {
  const parsed = sp.month ? parse(sp.month, "yyyy-MM", new Date()) : new Date();
  const month = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selectedDay = sp.day ? parse(sp.day, "yyyy-MM-dd", new Date()) : null;
  const now = new Date();

  const rows = await db.followUp.findMany({
    where: { AND: [base, { status: { not: "CANCELLED" }, dueAt: { gte: gridStart, lte: endOfDay(gridEnd) } }] },
    include,
    orderBy: { dueAt: "asc" },
  });
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const k = format(r.dueAt, "yyyy-MM-dd");
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(r);
  }
  const selectedKey = selectedDay && !Number.isNaN(selectedDay.getTime()) ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedItems = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Link href={buildHref(sp, { month: format(addMonths(month, -1), "yyyy-MM"), day: null })} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="min-w-36 text-center text-[15px] font-semibold text-slate-900">{format(month, "MMMM yyyy")}</h2>
            <Link href={buildHref(sp, { month: format(addMonths(month, 1), "yyyy-MM"), day: null })} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Next month">
              <ChevronRight className="size-4" />
            </Link>
            <Link href={buildHref(sp, { month: null, day: format(now, "yyyy-MM-dd") })} className="ml-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
              Today
            </Link>
          </div>
          <Filters manager={manager} users={users} />
        </div>
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, month);
            const selected = key === selectedKey;
            const overdue = items.some((i) => i.status === "PENDING" && i.dueAt < now);
            return (
              <Link
                key={key}
                href={buildHref(sp, { day: key, month: format(month, "yyyy-MM") })}
                scroll={false}
                className={cn(
                  "group min-h-[92px] border-b border-r border-slate-100 p-1.5 transition sm:min-h-[112px] sm:p-2",
                  !inMonth && "bg-slate-50/50",
                  selected ? "bg-brand-50/60 ring-2 ring-inset ring-brand-400" : "hover:bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(d) ? "bg-brand-600 text-white" : inMonth ? "text-slate-700" : "text-slate-400",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  {items.length > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600")}>{items.length}</span>
                  )}
                </div>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {items.slice(0, 3).map((i) => (
                    <div
                      key={i.id}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                        i.status === "COMPLETED" ? "bg-slate-100 text-slate-400 line-through" : TYPE_TONES[i.type] ?? TYPE_TONES.OTHER,
                      )}
                    >
                      <FollowUpTypeIcon type={i.type} className="size-3 shrink-0" />
                      <span className="truncate">
                        {format(i.dueAt, "h:mm")} {i.lead.name.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && <p className="px-1.5 text-[11px] font-medium text-slate-500">+{items.length - 3} more</p>}
                </div>
                {items.length > 0 && (
                  <div className="mt-1 flex gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((i) => (
                      <span key={i.id} className={cn("size-1.5 rounded-full", i.status === "COMPLETED" ? "bg-slate-300" : "bg-brand-500")} />
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="h-fit xl:sticky xl:top-24">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-slate-900">{selectedKey ? format(parse(selectedKey, "yyyy-MM-dd", new Date()), "EEEE, dd MMM") : "Select a day"}</h3>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {selectedKey ? `${selectedItems.length} follow-up${selectedItems.length === 1 ? "" : "s"} scheduled` : "Click any date to see its schedule."}
          </p>
        </div>
        {selectedKey ? (
          <FollowUpList items={selectedItems.map(serialize)} users={users} properties={properties} />
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <CalendarDays className="size-5" />
            </span>
            <p className="text-sm text-slate-500">{rows.length} follow-ups this month</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function ViewLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function buildHref(sp: SP, patch: Partial<Record<keyof SP, string | null>>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "new") params.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/follow-ups?${qs}` : "/follow-ups";
}
