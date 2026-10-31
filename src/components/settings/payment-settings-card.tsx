"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReceiptText } from "lucide-react";
import { savePaymentSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function PaymentSettingsCard({ receiptPrefix, nextReceiptNo, waPaymentTemplate }: { receiptPrefix: string; nextReceiptNo: number; waPaymentTemplate: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="card grid gap-6 p-5 lg:grid-cols-[280px_1fr] lg:p-6">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <ReceiptText className="size-[18px]" />
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">Bookings & receipts</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">Receipt numbering and the WhatsApp template used for customer payment reminders.</p>
      </div>
      <form
        action={(fd) =>
          start(async () => {
            const res = await savePaymentSettings(fd);
            if (res.error) return void toast.error(res.error);
            toast.success("Payment settings saved");
            router.refresh();
          })
        }
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Receipt prefix" hint={`Next receipt: ${receiptPrefix}-${nextReceiptNo}`}>
          <Input name="receiptPrefix" defaultValue={receiptPrefix} required maxLength={12} />
        </Field>
        <Field label="Next receipt number">
          <Input name="nextReceiptNo" type="number" min={1} defaultValue={nextReceiptNo} />
        </Field>
        <Field
          label="Payment reminder template (WhatsApp API)"
          className="sm:col-span-2"
          hint="Approved Meta template name. Variables: {{1}} customer first name, {{2}} amount due, {{3}} due date, {{4}} property. Leave empty to remind by push and email only."
        >
          <Input name="waPaymentTemplate" defaultValue={waPaymentTemplate ?? ""} placeholder="payment_due_reminder" />
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}
