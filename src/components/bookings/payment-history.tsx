"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, FileDown, Wallet } from "lucide-react";
import { cancelPayment } from "@/actions/bookings";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_METHODS, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  receiptNo: string;
  amount: number;
  paidAt: string;
  method: string;
  reference: string | null;
  installmentLabel: string;
  status: string; // ACTIVE | CANCELLED
  cancelReason: string | null;
  cancelledAt: string | null;
  recordedBy: string | null;
};

const CANCEL_REASONS = ["Cheque bounced", "Entered by mistake", "Wrong amount", "Payment refunded", "Duplicate entry"];

export function PaymentHistory({ payments, canManage }: { payments: PaymentRow[]; canManage: boolean }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  if (!payments.length) return <p className="px-5 py-8 text-center text-sm text-slate-500">No payments recorded yet.</p>;

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {payments.map((p) => {
          const cancelled = p.status === "CANCELLED";
          return (
            <li key={p.id} className={cn("flex items-center gap-4 px-5 py-3", cancelled && "bg-slate-50/60")}>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", cancelled ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600")}>
                {cancelled ? <Ban className="size-4" /> : <Wallet className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                  <span className={cn(cancelled && "text-slate-400 line-through")}>{formatCurrency(p.amount)}</span>
                  <span className="font-normal text-slate-500">for {p.installmentLabel}</span>
                  {cancelled && <Badge className="bg-rose-50 text-rose-700 ring-rose-600/20">Cancelled</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">{p.receiptNo}</span> - {labelOf(PAYMENT_METHODS, p.method)}
                  {p.reference ? ` ${p.reference}` : ""} - {formatDate(p.paidAt)}
                  {p.recordedBy ? ` - by ${p.recordedBy}` : ""}
                </p>
                {cancelled && (
                  <p className="mt-0.5 text-xs text-rose-600">
                    Cancelled {formatDate(p.cancelledAt)}
                    {p.cancelReason ? `: ${p.cancelReason}` : ""}
                  </p>
                )}
              </div>
              <a
                href={`/api/receipts/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline"
              >
                <FileDown className="size-4" /> Receipt
              </a>
              {canManage && !cancelled && (
                <button
                  type="button"
                  onClick={() => {
                    setReason("");
                    setCancelling(p);
                  }}
                  className="rounded-lg px-2 py-1 text-[13px] font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  Cancel
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!cancelling}
        onClose={() => !pending && setCancelling(null)}
        size="sm"
        title={`Cancel receipt ${cancelling?.receiptNo ?? ""}?`}
        description="The receipt stays on record marked as cancelled (receipt numbers are never reused), and its amount is removed from the payment schedule."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)} disabled={pending}>
              Keep receipt
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={reason.trim().length < 3}
              onClick={async () => {
                if (!cancelling) return;
                setPending(true);
                const r = await cancelPayment(cancelling.id, reason);
                setPending(false);
                if (r.error) return void toast.error(r.error);
                toast.success(`Receipt ${cancelling.receiptNo} cancelled`);
                setCancelling(null);
                router.refresh();
              }}
            >
              Cancel receipt
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Amount: <span className="font-semibold text-slate-900">{cancelling ? formatCurrency(cancelling.amount) : ""}</span> for {cancelling?.installmentLabel}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                reason === r ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" placeholder="Why is this receipt being cancelled?" />
        </Field>
      </Modal>
    </>
  );
}
