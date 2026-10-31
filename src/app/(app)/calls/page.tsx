import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { startOfDay, startOfMonth, subDays } from "date-fns";
import { Clock, PhoneCall, PhoneMissed, PhoneOff, Settings } from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { telephonyStatus } from "@/lib/telephony";
import { CALL_STATUSES } from "@/lib/constants";
import { formatDateTime, percent } from "@/lib/format";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ClearFilters, FilterSelect, Pagination, SegmentTabs } from "@/components/ui/filters";
import { CallDirectionIcon, PROVIDER_LABEL, RecordingPlayer, formatCallDuration } from "@/components/calls/call-meta";

export const metadata = { title: "Calls" };

type SP = { range?: string; agent?: string; status?: string; direction?: string; lead?: string; page?: string };
const PAGE_SIZE = 30;

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function rangeStart(range: string) {
  const now = new Date();
  if (range === "today") return startOfDay(now);
  if (range === "7d") return startOfDay(subDays(now, 6));
  if (range === "30d") return startOfDay(subDays(now, 29));
  if (range === "month") return startOfMonth(now);
  return null;
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const range = sp.range ?? "7d";
  const page = Math.max(1, Number(sp.page) || 1);
  const from = rangeStart(range);

  const scope: Prisma.CallLogWhereInput = manager ? (sp.agent ? { userId: sp.agent } : {}) : { OR: [{ userId: user.id }, { lead: { assignedToId: user.id } }] };
  const base: Prisma.CallLogWhereInput = { ...scope, ...(from ? { startedAt: { gte: from } } : {}), ...(sp.lead ? { leadId: sp.lead } : {}) };
  const where: Prisma.CallLogWhereInput = {
    ...base,
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.direction ? { direction: sp.direction } : {}),
  };

  const todayScope: Prisma.CallLogWhereInput = { ...scope, startedAt: { gte: startOfDay(new Date()) } };
  const [settings, users, total, calls, todayCount, rangeTotal, answered, talk, missedIn] = await Promise.all([
    db.settings.findFirst(),
    manager ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.callLog.count({ where }),
    db.callLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { lead: { select: { id: true, name: true, phone: true } }, user: { select: { name: true } } },
    }),
    db.callLog.count({ where: todayScope }),
    db.callLog.count({ where: { ...base, status: { notIn: ["INITIATED", "RINGING"] } } }),
    db.callLog.count({ where: { ...base, status: "ANSWERED" } }),
    db.callLog.aggregate({ where: base, _sum: { durationSec: true } }),
    db.callLog.count({ where: { ...base, direction: "IN", status: "MISSED" } }),
  ]);
  const tel = telephonyStatus(settings);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "";

  return (
    <>
      <PageHeader
        icon={PhoneCall}
        title="Calls"
        description={tel.enabled ? `Click-to-call via ${tel.provider === "EXOTEL" ? "Exotel" : "Knowlarity"} is active. Calls and recordings sync automatically.` : "Every call made or logged by your team, with outcomes and recordings."}
        actions={
          !tel.enabled && user.role === "ADMIN" ? (
            <Link href="/settings#telephony" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50">
              <Settings className="size-4" /> Connect Exotel / Knowlarity
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Calls today" value={todayCount} icon={PhoneCall} tone="brand" sub={<span>{manager && !sp.agent ? "Whole team" : "Your calls"}</span>} />
        <StatCard label="Connect rate" value={`${percent(answered, rangeTotal)}%`} icon={PhoneOff} tone="emerald" sub={<span>{answered} of {rangeTotal} answered ({rangeLabel})</span>} />
        <StatCard label="Talk time" value={formatCallDuration(talk._sum.durationSec ?? 0)} icon={Clock} tone="violet" sub={<span>{rangeLabel}</span>} />
        <StatCard label="Missed incoming" value={missedIn} icon={PhoneMissed} tone={missedIn ? "rose" : "sky"} sub={<span>{missedIn ? "Call these back first" : "None missed"}</span>} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentTabs param="range" defaultValue="7d" options={RANGES} />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="direction" placeholder="All directions" options={[{ value: "OUT", label: "Outgoing" }, { value: "IN", label: "Incoming" }]} />
            <FilterSelect param="status" placeholder="All statuses" options={CALL_STATUSES} />
            {manager && <FilterSelect param="agent" placeholder="All agents" options={users.map((u) => ({ value: u.id, label: u.name }))} />}
            <ClearFilters keys={["direction", "status", "agent", "lead"]} />
          </div>
        </div>

        {calls.length === 0 ? (
          <EmptyState icon={PhoneCall} title="No calls in this period" description="Use the Call button on any lead to dial and log calls. With Exotel or Knowlarity connected, calls are recorded automatically." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Lead</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Duration</th>
                  <th className="table-th">Outcome</th>
                  {manager && <th className="table-th">Agent</th>}
                  <th className="table-th">Recording</th>
                  <th className="table-th">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {calls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <CallDirectionIcon direction={c.direction} status={c.status} />
                        {c.lead ? (
                          <Link href={`/leads/${c.lead.id}`} className="min-w-0">
                            <span className="block font-medium text-slate-900 hover:text-brand-700">{c.lead.name}</span>
                            <span className="block text-xs text-slate-500">{c.lead.phone}</span>
                          </Link>
                        ) : (
                          <span>
                            <span className="block font-medium text-slate-700">Unknown caller</span>
                            <span className="block text-xs text-slate-500">{c.direction === "IN" ? c.fromNumber : c.toNumber}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-td">
                      <OptionBadge list={CALL_STATUSES} value={c.status} />
                      <span className="mt-1 block text-[11px] text-slate-400">{PROVIDER_LABEL[c.provider] ?? c.provider}</span>
                    </td>
                    <td className="table-td font-medium text-slate-800">{formatCallDuration(c.durationSec)}</td>
                    <td className="table-td">
                      <p className="max-w-56 truncate text-slate-700" title={c.notes ?? undefined}>
                        {c.outcome ?? <span className="text-slate-400">-</span>}
                      </p>
                      {c.notes && <p className="max-w-56 truncate text-xs text-slate-500">{c.notes}</p>}
                    </td>
                    {manager && (
                      <td className="table-td">
                        {c.user ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={c.user.name} size="xs" />
                            {c.user.name.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="table-td">{c.recordingUrl ? <RecordingPlayer callId={c.id} compact /> : <span className="text-xs text-slate-400">Not recorded</span>}</td>
                    <td className="table-td text-[13px] text-slate-600">{formatDateTime(c.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/calls" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
