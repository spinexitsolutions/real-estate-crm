"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  BellRing,
  CircleCheck,
  Ellipsis,
  FileDown,
  IndianRupee,
  Plus,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react";
import {
  addInstallment,
  deleteInstallment,
  markReminderSent,
  moveInstallment,
  recordPayment,
  setInstallmentWaived,
  updateInstallment,
} from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { OptionBadge } from "@/components/ui/badge";
import { INSTALLMENT_STATUSES, PAYMENT_METHODS, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, toDateInput } from "@/lib/format";
import { amountInWordsINR, effectiveStatus } from "@/lib/payment-plan";
import { cn, waLink } from "@/lib/utils";

export type InstallmentRow = {
  id: string;
  label: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  paidAt: string | null;
  /** Active (non-cancelled) receipts issued against this installment */
  receipts: { id: string; receiptNo: string; amount: number; paidAt: string; method: string; reference: string | null }[];
  /** True when any receipt (including cancelled) exists - such installments cannot be deleted */
  hasReceipts: boolean;
  reminderSentAt: string | null;
};

type Ctx = {
  bookingId: string;
  bookingNo: string;
  cancelled: boolean;
  canManage: boolean;
  customer: { name: string; phone: string };
  propertyTitle: string | null;
  company: string;
  countryCode: string;
  portalUrl: string | null;
};

export function InstallmentTable({ rows, ctx }: { rows: InstallmentRow[]; ctx: Ctx }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState<InstallmentRow | null>(null);
  const [editing, setEditing] = useState<InstallmentRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete"; row: InstallmentRow } | null>(null);
  const now = new Date();

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) return void toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });

  const reminderText = (r: InstallmentRow) => {
    const first = ctx.customer.name.split(" ")[0];
    const bal = r.amount - r.paidAmount;
    const overdue = effectiveStatus(r, now) === "OVERDUE";
    return `Dear ${first}, this is a gentle reminder from ${ctx.company} that ${formatCurrency(bal)} towards "${r.label}"${ctx.propertyTitle ? ` for ${ctx.propertyTitle}` : ""} ${overdue ? "was due" : "is due"} on ${formatDate(r.dueDate)} (Booking ${ctx.bookingNo}).${ctx.portalUrl ? `\n\nView your payment schedule and receipts: ${ctx.portalUrl}` : ""}\n\nPlease ignore if already paid. Thank you.`;
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="table-th w-10">#</th>
              <th className="table-th">Installment</th>
              <th className="table-th">Due date</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th text-right">Received</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r, idx) => {
              const st = effectiveStatus(r, now);
              const balance = Math.max(0, r.amount - r.paidAmount);
              const open = (r.status === "PENDING" || r.status === "PARTIAL") && !ctx.cancelled;
              return (
                <tr key={r.id} className={cn("hover:bg-slate-50/70", st === "OVERDUE" && "bg-rose-50/30")}>
                  <td className="table-td text-xs text-slate-400">{idx + 1}</td>
                  <td className="table-td min-w-64 whitespace-normal">
                    <p className="font-medium text-slate-800">{r.label}</p>
                    {r.receipts.map((rc) => (
                      <a
                        key={rc.id}
                        href={`/api/receipts/${rc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-slate-500 hover:text-brand-700"
                        title="Open receipt PDF"
                      >
                        <span className="font-medium text-slate-600">{rc.receiptNo}</span> - {formatCurrency(rc.amount)} - {labelOf(PAYMENT_METHODS, rc.method)}
                        {rc.reference ? ` ${rc.reference}` : ""} - {formatDate(rc.paidAt)}
                      </a>
                    ))}
                  </td>
                  <td className={cn("table-td", st === "OVERDUE" ? "font-medium text-rose-600" : "")}>{formatDate(r.dueDate)}</td>
                  <td className="table-td text-right font-medium text-slate-900">{formatCurrency(r.amount)}</td>
                  <td className="table-td text-right">
                    <span className={r.paidAmount > 0 ? "font-medium text-emerald-700" : "text-slate-400"}>{formatCurrency(r.paidAmount)}</span>
                    {r.status === "PARTIAL" && <p className="text-xs text-slate-500">{formatCurrency(balance)} left</p>}
                  </td>
                  <td className="table-td">
                    <OptionBadge list={INSTALLMENT_STATUSES} value={st} withDot />
                  </td>
                  <td className="table-td">
                    <div className="flex items-center justify-end gap-1">
                      {open && (
                        <Button size="sm" variant="secondary" onClick={() => setPaying(r)}>
                          <IndianRupee /> Record payment
                        </Button>
                      )}
                      {r.receipts.length > 0 && (
                        <a
                          href={`/api/receipts/${r.receipts[r.receipts.length - 1].id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Latest receipt PDF"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <FileDown className="size-4" />
                        </a>
                      )}
                      <Dropdown
                        trigger={({ toggle }) => (
                          <button onClick={toggle} disabled={pending} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="More actions">
                            <Ellipsis className="size-4" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            {open && (
                              <DropdownItem
                                icon={BellRing}
                                onClick={() => {
                                  close();
                                  window.open(waLink(ctx.customer.phone, reminderText(r), ctx.countryCode), "_blank", "noopener");
                                  run(() => markReminderSent(r.id), "Reminder logged");
                                }}
                              >
                                Send reminder on WhatsApp
                              </DropdownItem>
                            )}
                            {!ctx.cancelled && (
                              <DropdownItem
                                icon={SquarePen}
                                onClick={() => {
                                  close();
                                  setEditing(r);
                                }}
                              >
                                Edit installment
                              </DropdownItem>
                            )}
                            <DropdownItem
                              icon={ArrowUp}
                              onClick={() => {
                                close();
                                run(() => moveInstallment(r.id, "up"), "Moved");
                              }}
                            >
                              Move up
                            </DropdownItem>
                            <DropdownItem
                              icon={ArrowDown}
                              onClick={() => {
                                close();
                                run(() => moveInstallment(r.id, "down"), "Moved");
                              }}
                            >
                              Move down
                            </DropdownItem>
                            {ctx.canManage && r.status !== "PAID" && (
                              <DropdownItem
                                icon={r.status === "WAIVED" ? RotateCcw : Ban}
                                onClick={() => {
                                  close();
                                  run(() => setInstallmentWaived(r.id, r.status !== "WAIVED"), r.status === "WAIVED" ? "Installment reinstated" : "Installment waived");
                                }}
                              >
                                {r.status === "WAIVED" ? "Reinstate" : "Waive balance"}
                              </DropdownItem>
                            )}
                            {!r.hasReceipts && (
                              <DropdownItem
                                icon={Trash2}
                                danger
                                onClick={() => {
                                  close();
                                  setConfirm({ kind: "delete", row: r });
                                }}
                              >
                                Delete
                              </DropdownItem>
                            )}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!ctx.cancelled && (
        <div className="border-t border-slate-100 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add installment
          </Button>
        </div>
      )}

      {paying && <RecordPaymentModal row={paying} onClose={() => setPaying(null)} />}
      {(editing || adding) && <InstallmentModal bookingId={ctx.bookingId} row={editing} onClose={() => (setEditing(null), setAdding(false))} />}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete this installment?"
        description="The installment will be removed from the schedule."
        confirmLabel="Delete"
        action={async () => {
          const r = await deleteInstallment(confirm!.row.id);
          if (!r.error) router.refresh();
          return r;
        }}
        successMessage="Installment deleted"
      />
    </>
  );
}

function RecordPaymentModal({ row, onClose }: { row: InstallmentRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const balance = Math.max(0, row.amount - row.paidAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("UPI");
  const [error, setError] = useState<string | null>(null);
  const num = Number(amount) || 0;

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title="Record payment"
      description={`${row.label} - balance due ${formatCurrency(balance)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="success"
            loading={pending}
            onClick={() => {
              const form = document.getElementById("pay-form") as HTMLFormElement;
              const fd = new FormData(form);
              setError(null);
              start(async () => {
                const r = await recordPayment(row.id, fd);
                if (r.error) return void setError(r.error);
                toast.success(`Payment recorded. Receipt ${r.data?.receiptNo}`, {
                  action: { label: "Open receipt", onClick: () => window.open(`/api/receipts/${r.data?.paymentId}`, "_blank") },
                });
                onClose();
                router.refresh();
              });
            }}
          >
            <CircleCheck /> Save payment
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received" required hint={num ? amountInWordsINR(num) : undefined} className="sm:col-span-2">
            <Input name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} autoFocus />
          </Field>
          <Field label="Payment date" required>
            <Input name="paidAt" type="date" defaultValue={toDateInput(new Date())} />
          </Field>
          <Field label="Mode">
            <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />
          </Field>
          <Field
            label={method === "CHEQUE" || method === "DD" ? "Cheque / DD number and bank" : ["CASH", "CARD", "HOME_LOAN", "OTHER"].includes(method) ? "Reference (optional)" : "Transaction ID / UTR"}
            required={["CHEQUE", "DD", "UPI", "NEFT", "RTGS", "IMPS"].includes(method)}
            className="sm:col-span-2"
          >
            <Input name="reference" placeholder={method === "CHEQUE" ? "e.g. 004512, HDFC Bank" : "e.g. 4231 8890 1123"} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="notes" className="min-h-16" />
          </Field>
        </div>
        {num > 0 && num < balance && (
          <p className="text-xs text-slate-500">This will be saved as a part payment. {formatCurrency(balance - num)} will remain due.</p>
        )}
      </form>
    </Modal>
  );
}

function InstallmentModal({ bookingId, row, onClose }: { bookingId: string; row: InstallmentRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      size="sm"
      onClose={() => !pending && onClose()}
      title={row ? "Edit installment" : "Add installment"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              const fd = new FormData(document.getElementById("inst-form") as HTMLFormElement);
              start(async () => {
                const r = row ? await updateInstallment(row.id, fd) : await addInstallment(bookingId, fd);
                if (r.error) return void toast.error(r.error);
                toast.success(row ? "Installment updated" : "Installment added");
                onClose();
                router.refresh();
              });
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="inst-form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <Field label="Name" required>
          <Input name="label" defaultValue={row?.label ?? ""} placeholder="e.g. On 4th slab" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount" required>
            <Input name="amount" inputMode="numeric" defaultValue={row ? String(Math.round(row.amount)) : ""} />
          </Field>
          <Field label="Due date" required>
            <Input name="dueDate" type="date" defaultValue={row ? toDateInput(row.dueDate) : toDateInput(new Date())} />
          </Field>
        </div>
        {row && row.paidAmount > 0 && <p className="text-xs text-slate-500">Already received {formatCurrency(row.paidAmount)}. The amount cannot be lower than that.</p>}
      </form>
    </Modal>
  );
}
