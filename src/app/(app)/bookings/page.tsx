import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { CircleAlert, IndianRupee, Plus, ReceiptText, Wallet, Landmark } from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BOOKING_STATUSES, INSTALLMENT_STATUSES } from "@/lib/constants";
import { formatCompact, formatDate } from "@/lib/format";
import { effectiveStatus, summarizeInstallments } from "@/lib/payment-plan";
import { cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput, SegmentTabs } from "@/components/ui/filters";
import { ProgressBar } from "@/components/charts";

export const metadata = { title: "Bookings & Payments" };

type SP = { q?: string; tab?: string; agent?: string; status?: string; page?: string };
const PAGE_SIZE = 20;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const cur = settings.currency;
  const manager = isManager(user);
  const tab = sp.tab ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  const today = startOfDay(now);

  const scope: Prisma.BookingWhereInput = user.role === "AGENT" ? { lead: { assignedToId: user.id } } : manager && sp.agent ? { lead: { assignedToId: sp.agent } } : {};
  const base: Prisma.BookingWhereInput = { ...scope };
  if (sp.q)
    base.OR = [
      { bookingNo: { contains: sp.q, mode: "insensitive" } },
      { unitNumber: { contains: sp.q, mode: "insensitive" } },
      { lead: { name: { contains: sp.q, mode: "insensitive" } } },
      { lead: { phone: { contains: sp.q } } },
      { property: { title: { contains: sp.q, mode: "insensitive" } } },
      { property: { code: { contains: sp.q, mode: "insensitive" } } },
    ];
  if (sp.status) base.status = sp.status;

  const unpaid = { status: { in: ["PENDING", "PARTIAL"] } };
  const tabWhere: Record<string, Prisma.BookingWhereInput> = {
    all: {},
    upcoming: { status: "ACTIVE", installments: { some: { ...unpaid, dueDate: { gte: today, lte: endOfDay(addDays(now, 30)) } } } },
    overdue: { status: "ACTIVE", installments: { some: { ...unpaid, dueDate: { lt: today } } } },
    completed: { status: "COMPLETED" },
  };
  const where: Prisma.BookingWhereInput = { AND: [base, tabWhere[tab] ?? {}] };

  const [bookings, total, counts, liveInstallments, users] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { bookingDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        lead: { select: { id: true, name: true, phone: true, assignedTo: { select: { name: true } } } },
        property: { select: { id: true, title: true, code: true } },
        installments: { select: { amount: true, paidAmount: true, status: true, dueDate: true, label: true } },
      },
    }),
    db.booking.count({ where }),
    Promise.all(Object.entries(tabWhere).map(async ([k, w]) => [k, await db.booking.count({ where: { AND: [base, w] } })] as const)),
    db.paymentInstallment.findMany({
      where: { booking: { ...scope, status: { not: "CANCELLED" } } },
      select: { amount: true, paidAmount: true, status: true, dueDate: true },
    }),
    manager ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const totals = summarizeInstallments(liveInstallments, now);
  const countOf = Object.fromEntries(counts);

  return (
    <>
      <PageHeader
        icon={ReceiptText}
        title="Bookings & Payments"
        description="Track every booking, payment schedule, collection and receipt."
        actions={
          <LinkButton href="/bookings/new">
            <Plus /> New booking
          </LinkButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total booked value" value={formatCompact(totals.total, cur)} icon={Landmark} tone="brand" sub={<span>{countOf.all ?? 0} bookings</span>} />
        <StatCard label="Collected" value={formatCompact(totals.paid, cur)} icon={Wallet} tone="emerald" sub={<span>{totals.progress}% of payable value</span>} />
        <StatCard label="Outstanding" value={formatCompact(totals.outstanding, cur)} icon={IndianRupee} tone="violet" sub={<span>Across active bookings</span>} />
        <StatCard
          label="Overdue"
          value={formatCompact(totals.overdue, cur)}
          icon={CircleAlert}
          tone={totals.overdue ? "rose" : "sky"}
          sub={totals.overdueCount ? <span className="font-medium text-rose-600">{totals.overdueCount} installments overdue</span> : <span>Nothing overdue</span>}
        />
      </div>

      <div className="mb-4">
        <SegmentTabs
          param="tab"
          defaultValue="all"
          options={[
            { value: "all", label: "All", count: countOf.all },
            { value: "upcoming", label: "Due in 30 days", count: countOf.upcoming },
            { value: "overdue", label: "Overdue", count: countOf.overdue },
            { value: "completed", label: "Completed", count: countOf.completed },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput placeholder="Search booking no, customer, unit, property..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="status" options={BOOKING_STATUSES} placeholder="Any status" />
            {manager && <FilterSelect param="agent" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="All agents" />}
            <ClearFilters keys={["q", "status", "agent"]} />
          </div>
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No bookings found"
            description="Create a booking when a customer pays the token amount. The payment schedule and reminders are set up automatically."
            action={
              <LinkButton href="/bookings/new">
                <Plus /> New booking
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Booking</th>
                  <th className="table-th">Customer</th>
                  <th className="table-th">Property / unit</th>
                  <th className="table-th text-right">Value</th>
                  <th className="table-th">Collected</th>
                  <th className="table-th">Next due</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((b) => {
                  const s = summarizeInstallments(b.installments, now);
                  const next = s.nextDue;
                  const nextStatus = next ? effectiveStatus(next, now) : null;
                  return (
                    <tr key={b.id} className="group hover:bg-slate-50/70">
                      <td className="table-td">
                        <Link href={`/bookings/${b.id}`} className="font-medium text-slate-900 group-hover:text-brand-700">
                          {b.bookingNo}
                        </Link>
                        <p className="text-xs text-slate-500">{formatDate(b.bookingDate)}</p>
                      </td>
                      <td className="table-td">
                        <Link href={`/leads/${b.lead.id}`} className="flex items-center gap-2.5">
                          <Avatar name={b.lead.name} size="sm" />
                          <span>
                            <span className="block font-medium text-slate-800 hover:text-brand-700">{b.lead.name}</span>
                            <span className="block text-xs text-slate-500">{b.lead.assignedTo?.name ?? "Unassigned"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="table-td">
                        <p className="max-w-56 truncate text-slate-800">{b.property ? b.property.title : "-"}</p>
                        <p className="text-xs text-slate-500">{[b.property?.code, b.unitNumber].filter(Boolean).join(" - ") || "-"}</p>
                      </td>
                      <td className="table-td text-right font-medium text-slate-900">{formatCompact(b.totalAmount, cur)}</td>
                      <td className="table-td">
                        <div className="w-36">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="font-medium text-slate-700">{formatCompact(s.paid, cur)}</span>
                            <span className="text-slate-400">{s.progress}%</span>
                          </div>
                          <ProgressBar value={s.progress} />
                        </div>
                      </td>
                      <td className="table-td">
                        {next && b.status === "ACTIVE" ? (
                          <>
                            <p className={cn("text-[13px] font-medium", nextStatus === "OVERDUE" ? "text-rose-600" : "text-slate-800")}>
                              {formatCompact(next.amount - next.paidAmount, cur)} {nextStatus === "OVERDUE" ? "overdue" : ""}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(next.dueDate)} - {next.label}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex flex-col items-start gap-1">
                          <OptionBadge list={BOOKING_STATUSES} value={b.status} withDot />
                          {s.overdueCount > 0 && b.status === "ACTIVE" && <OptionBadge list={INSTALLMENT_STATUSES} value="OVERDUE" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/bookings" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
