"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert } from "lucide-react";
import { createBooking } from "@/actions/bookings";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatCompact } from "@/lib/format";
import { PlanBuilder } from "./plan-builder";

type LeadOpt = { id: string; name: string; phone: string };
type PropOpt = { id: string; title: string; code: string; price: number; status: string };

export function BookingForm({
  leads,
  properties,
  defaults,
}: {
  leads: LeadOpt[];
  properties: PropOpt[];
  defaults: { leadId?: string; dealId?: string; propertyId?: string; totalAmount?: number; bookingDate: string; dealTitle?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState(defaults.leadId ?? "");
  const [propertyId, setPropertyId] = useState(defaults.propertyId ?? "");
  const [total, setTotal] = useState(defaults.totalAmount ? String(Math.round(defaults.totalAmount)) : "");
  const [bookingDate, setBookingDate] = useState(defaults.bookingDate);
  const formRef = useRef<HTMLFormElement>(null);
  const totalNum = Number(total.replace(/,/g, "")) || 0;

  const submit = (fd: FormData) => {
    setError(null);
    start(async () => {
      const res = await createBooking(fd);
      if (res.error) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast.success("Booking created");
      router.push(`/bookings/${res.data!.id}`);
    });
  };

  return (
    <form ref={formRef} action={submit} className="grid gap-6 xl:grid-cols-3">
      {defaults.dealId && <input type="hidden" name="dealId" value={defaults.dealId} />}
      <div className="space-y-6 xl:col-span-2">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        <Card>
          <CardHeader title="Booking details" description={defaults.dealTitle ? `From deal: ${defaults.dealTitle}` : "Customer, property and agreement value"} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Customer" required>
              <Select
                name="leadId"
                required
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="Select customer"
                options={leads.map((l) => ({ value: l.id, label: `${l.name} (${l.phone})` }))}
                disabled={!!defaults.dealId}
              />
              {defaults.dealId && <input type="hidden" name="leadId" value={leadId} />}
            </Field>
            <Field label="Property">
              <Select
                name="propertyId"
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  const p = properties.find((x) => x.id === e.target.value);
                  if (p && !total) setTotal(String(Math.round(p.price)));
                }}
                placeholder="Select property"
                options={properties.map((p) => ({ value: p.id, label: `${p.code} - ${p.title} (${formatCompact(p.price)})` }))}
              />
            </Field>
            <Field label="Unit / flat number">
              <Input name="unitNumber" placeholder="e.g. Tower B, 1203" />
            </Field>
            <Field label="Total agreement value" required hint={totalNum ? formatCompact(totalNum) : "Full amount in rupees"}>
              <Input name="totalAmount" required inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 12500000" />
            </Field>
            <Field label="Booking date" required>
              <Input name="bookingDate" type="date" required value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </Field>
            <Field label="Agreement date">
              <Input name="agreementDate" type="date" />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea name="notes" placeholder="Parking, floor rise, special terms..." className="min-h-20" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment schedule" description="Pick a plan and fine-tune each installment. The schedule must add up to the total value." />
          <div className="p-5">
            <PlanBuilder total={totalNum} startDate={bookingDate} />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5 xl:sticky xl:top-24">
          <p className="text-[13px] font-medium text-slate-500">Agreement value</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{totalNum ? formatCompact(totalNum) : "-"}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>The lead is marked as Won and the property as Reserved.</li>
            <li>Payment reminders go out automatically 3 days before each due date.</li>
            <li>Receipts are numbered automatically when you record a payment.</li>
          </ul>
          <div className="mt-5 flex gap-2">
            <LinkButton href="/bookings" variant="secondary" className="flex-1">
              Cancel
            </LinkButton>
            <Button type="submit" loading={pending} className="flex-1">
              Create booking
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
