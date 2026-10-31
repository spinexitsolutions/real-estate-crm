"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDeal, updateDeal } from "@/actions/deals";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { DEAL_STAGES } from "@/lib/constants";
import { formatCompact, formatCurrency, toDateInput } from "@/lib/format";

type DealInput = {
  id: string;
  title: string;
  value: number;
  commissionPct: number;
  stage: string;
  expectedCloseDate: string | null;
  notes: string | null;
  leadId: string;
  propertyId: string | null;
  agentId: string | null;
};

export function DealFormModal({
  open,
  onClose,
  leads,
  properties,
  users,
  deal,
  defaultLeadId,
  defaultPropertyId,
  defaultCommission = 2,
  currency = "INR",
}: {
  open: boolean;
  onClose: () => void;
  leads: { id: string; name: string; phone: string }[];
  properties: { id: string; title: string; code: string; price: number }[];
  users: { id: string; name: string }[];
  deal?: DealInput;
  defaultLeadId?: string;
  defaultPropertyId?: string;
  defaultCommission?: number;
  currency?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [leadId, setLeadId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [value, setValue] = useState("");
  const [commission, setCommission] = useState(String(defaultCommission));

  // Reset state whenever the modal opens
  useEffect(() => {
    if (!open) return;
    const initialProperty = deal?.propertyId ?? defaultPropertyId ?? "";
    const prop = properties.find((p) => p.id === initialProperty);
    setLeadId(deal?.leadId ?? defaultLeadId ?? "");
    setPropertyId(initialProperty);
    setTitle(deal?.title ?? "");
    setTitleTouched(!!deal);
    setValue(deal ? String(deal.value) : prop ? String(prop.price) : "");
    setCommission(String(deal?.commissionPct ?? defaultCommission));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal?.id]);

  const lead = leads.find((l) => l.id === leadId);
  const property = properties.find((p) => p.id === propertyId);

  // Auto-generate title until the user edits it
  useEffect(() => {
    if (titleTouched) return;
    const parts = [lead?.name.split(" ")[0], property?.title].filter(Boolean);
    setTitle(parts.join(" - "));
  }, [lead, property, titleTouched]);

  const valueNum = Number(value.replace(/,/g, "")) || 0;
  const pctNum = Number(commission) || 0;
  const commissionAmount = useMemo(() => (valueNum * pctNum) / 100, [valueNum, pctNum]);

  const leadOptions = useMemo(() => leads.map((l) => ({ value: l.id, label: `${l.name} (${l.phone})` })), [leads]);
  const propertyOptions = useMemo(() => properties.map((p) => ({ value: p.id, label: `${p.code} - ${p.title} (${formatCompact(p.price, currency)})` })), [properties, currency]);

  const submit = (fd: FormData) => {
    start(async () => {
      const res = deal ? await updateDeal(deal.id, fd) : await createDeal(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(deal ? "Deal updated" : "Deal created");
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      size="lg"
      title={deal ? "Edit deal" : "New deal"}
      description={deal ? "Update value, stage and closing details." : "Track a negotiation from offer to closing."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="deal-form" loading={pending}>
            {deal ? "Save changes" : "Create deal"}
          </Button>
        </>
      }
    >
      <form id="deal-form" action={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Lead" required>
          <Select name="leadId" required options={leadOptions} placeholder="Select a lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
        </Field>
        <Field label="Property">
          <Select
            name="propertyId"
            options={propertyOptions}
            placeholder="No property linked"
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              const p = properties.find((x) => x.id === e.target.value);
              if (p) setValue(String(p.price));
            }}
          />
        </Field>
        <Field label="Deal title" required className="sm:col-span-2">
          <Input
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            placeholder="e.g. Rahul - 3 BHK Powai"
          />
        </Field>
        <Field label="Deal value" required hint={valueNum > 0 ? formatCurrency(valueNum, currency) : undefined}>
          <Input name="value" inputMode="numeric" required value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Final negotiated amount" />
        </Field>
        <Field label="Commission (%)" hint={commissionAmount > 0 ? `Your earning: ${formatCurrency(Math.round(commissionAmount), currency)}` : undefined}>
          <Input name="commissionPct" type="number" step="0.01" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} />
        </Field>
        <Field label="Stage">
          <Select name="stage" options={DEAL_STAGES} defaultValue={deal?.stage ?? "NEGOTIATION"} key={`stage-${deal?.id ?? "new"}-${open}`} />
        </Field>
        <Field label="Expected closing date">
          <Input name="expectedCloseDate" type="date" defaultValue={toDateInput(deal?.expectedCloseDate)} key={`date-${deal?.id ?? "new"}-${open}`} />
        </Field>
        <Field label="Owner (agent)" className="sm:col-span-2">
          <Select
            name="agentId"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Lead's assigned agent"
            defaultValue={deal?.agentId ?? ""}
            key={`agent-${deal?.id ?? "new"}-${open}`}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={deal?.notes ?? ""} placeholder="Negotiation points, payment terms, documents pending..." key={`notes-${deal?.id ?? "new"}-${open}`} />
        </Field>
        {valueNum > 0 && (
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2">
            <div>
              <p className="text-xs text-slate-500">Deal value</p>
              <p className="text-sm font-semibold text-slate-900">{formatCompact(valueNum, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Commission</p>
              <p className="text-sm font-semibold text-emerald-700">{formatCompact(Math.round(commissionAmount), currency)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">vs. asking</p>
              <p className="text-sm font-semibold text-slate-900">
                {property ? `${(((valueNum - property.price) / property.price) * 100).toFixed(1)}%` : "-"}
              </p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
