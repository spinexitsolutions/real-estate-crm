"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert } from "lucide-react";
import { createLead, updateLead } from "@/actions/leads";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PROPERTY_TYPES, PURPOSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type LeadFormValues = {
  id: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  source: string;
  status: string;
  priority: string;
  purpose: string;
  propertyType: string | null;
  preferredLocation: string | null;
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  tags: string;
  assignedToId: string | null;
};

export function LeadFormModal({
  open,
  onClose,
  users,
  lead,
  canAssign,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  users: { id: string; name: string }[];
  lead?: LeadFormValues;
  canAssign: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dupWarned, setDupWarned] = useState(false);
  const [priority, setPriority] = useState(lead?.priority ?? "WARM");
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (fd: FormData) => {
    setError(null);
    fd.set("priority", priority);
    if (dupWarned) fd.set("allowDuplicate", "1");
    start(async () => {
      const res = lead ? await updateLead(lead.id, fd) : await createLead(fd);
      if (res.error) {
        if (res.error.startsWith("A lead with this phone")) setDupWarned(true);
        setError(res.error);
        return;
      }
      toast.success(lead ? "Lead updated" : "Lead created", {
        action: !lead && res.data && "id" in res.data ? { label: "Open", onClick: () => router.push(`/leads/${(res.data as { id: string }).id}`) } : undefined,
      });
      setDupWarned(false);
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      size="lg"
      title={lead ? "Edit lead" : "Add new lead"}
      description={lead ? "Update contact details and requirement." : "Capture contact details and what they are looking for."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => formRef.current?.requestSubmit()}>
            {lead ? "Save changes" : dupWarned ? "Save anyway" : "Create lead"}
          </Button>
        </>
      }
    >
      <form ref={formRef} action={submit} className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <Input name="name" defaultValue={lead?.name} required placeholder="e.g. Rahul Verma" autoFocus />
            </Field>
            <Field label="Phone" required>
              <Input name="phone" defaultValue={lead?.phone} required placeholder="98XXXXXXXX" inputMode="tel" />
            </Field>
            <Field label="Alternate phone">
              <Input name="alternatePhone" defaultValue={lead?.alternatePhone ?? ""} inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={lead?.email ?? ""} placeholder="name@example.com" />
            </Field>
            <Field label="Source">
              <Select name="source" options={LEAD_SOURCES} defaultValue={lead?.source ?? "WEBSITE"} />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Requirement</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Purpose">
              <Select name="purpose" options={PURPOSES} defaultValue={lead?.purpose ?? "BUY"} />
            </Field>
            <Field label="Property type">
              <Select name="propertyType" options={PROPERTY_TYPES} placeholder="Any" defaultValue={lead?.propertyType ?? ""} />
            </Field>
            <Field label="Bedrooms (BHK)">
              <Select
                name="bedrooms"
                placeholder="Any"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 5 ? "5+ BHK" : `${n} BHK` }))}
                defaultValue={lead?.bedrooms ? String(lead.bedrooms) : ""}
              />
            </Field>
            <Field label="Preferred location" className="sm:col-span-3">
              <Input name="preferredLocation" defaultValue={lead?.preferredLocation ?? ""} placeholder="e.g. Baner, Pune" />
            </Field>
            <Field label="Budget min" hint="In rupees, e.g. 5000000">
              <Input name="budgetMin" inputMode="numeric" defaultValue={lead?.budgetMin ?? ""} placeholder="0" />
            </Field>
            <Field label="Budget max">
              <Input name="budgetMax" inputMode="numeric" defaultValue={lead?.budgetMax ?? ""} placeholder="0" />
            </Field>
            <Field label="Tags" hint="Comma separated">
              <Input name="tags" defaultValue={lead?.tags ?? ""} placeholder="NRI, Home Loan" />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Pipeline</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" className="sm:col-span-2">
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      priority === p.value ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", p.dot)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Status">
              <Select name="status" options={LEAD_STATUSES} defaultValue={lead?.status ?? "NEW"} />
            </Field>
            <Field label="Assigned to">
              {canAssign ? (
                <Select name="assignedToId" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Unassigned" defaultValue={lead ? (lead.assignedToId ?? "") : currentUserId} />
              ) : (
                <Input disabled value={users.find((u) => u.id === (lead?.assignedToId ?? currentUserId))?.name ?? "Me"} />
              )}
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea name="notes" defaultValue={lead?.notes ?? ""} placeholder="Anything important about this client..." />
            </Field>
          </div>
        </section>
      </form>
    </Modal>
  );
}

/** Button + modal combo for creating a lead from anywhere. */
export function NewLeadButton(props: Omit<React.ComponentProps<typeof LeadFormModal>, "open" | "onClose" | "lead"> & { defaultOpen?: boolean; children: React.ReactNode }) {
  const { defaultOpen, children, ...rest } = props;
  const [open, setOpen] = useState(!!defaultOpen);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>{children}</Button>
      <LeadFormModal
        {...rest}
        open={open}
        onClose={() => {
          setOpen(false);
          if (defaultOpen) router.replace("/leads", { scroll: false });
        }}
      />
    </>
  );
}
