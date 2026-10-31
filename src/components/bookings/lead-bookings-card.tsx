import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { BOOKING_STATUSES } from "@/lib/constants";
import { formatCompact, formatDate } from "@/lib/format";
import { effectiveStatus, summarizeInstallments } from "@/lib/payment-plan";
import { cn } from "@/lib/utils";
import { OptionBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/charts";

/** Server component for the lead detail page: the lead's bookings with collection progress and next due. */
export async function LeadBookingsCard({ leadId }: { leadId: string }) {
  const bookings = await db.booking.findMany({
    where: { leadId },
    orderBy: { bookingDate: "desc" },
    include: {
      property: { select: { title: true } },
      installments: { select: { amount: true, paidAmount: true, status: true, dueDate: true, label: true } },
    },
  });
  const now = new Date();

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Bookings & payments</h3>
          <p className="mt-0.5 text-[13px] text-slate-500">{bookings.length ? `${bookings.length} booking${bookings.length > 1 ? "s" : ""}` : "No booking yet"}</p>
        </div>
        <Link href={`/bookings/new?leadId=${leadId}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">
          <Plus className="size-3.5" /> New booking
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-6 text-center">
          <ReceiptText className="mb-2 size-5 text-slate-400" />
          <p className="text-sm text-slate-500">Create a booking when the customer pays the token to track the payment schedule.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {bookings.map((b) => {
            const s = summarizeInstallments(b.installments, now);
            const overdue = s.nextDue ? effectiveStatus(s.nextDue, now) === "OVERDUE" : false;
            return (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {b.bookingNo}
                      <span className="font-normal text-slate-500"> - {b.property?.title ?? "No property"}</span>
                    </p>
                    <OptionBadge list={BOOKING_STATUSES} value={b.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar value={s.progress} className="flex-1" />
                    <span className="whitespace-nowrap text-xs text-slate-600">
                      {formatCompact(s.paid)} / {formatCompact(b.totalAmount)}
                    </span>
                  </div>
                  {s.nextDue && b.status === "ACTIVE" && (
                    <p className={cn("mt-1.5 text-xs", overdue ? "font-medium text-rose-600" : "text-slate-500")}>
                      {overdue ? "Overdue" : "Next due"}: {formatCompact(s.nextDue.amount - s.nextDue.paidAmount)} on {formatDate(s.nextDue.dueDate)} ({s.nextDue.label})
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
