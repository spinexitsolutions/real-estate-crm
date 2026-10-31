"use client";

import { useEffect, useState, useTransition } from "react";
import { addDays, addHours, addWeeks, setHours, setMinutes, startOfHour } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FOLLOWUP_PRIORITIES, FOLLOWUP_TYPES } from "@/lib/constants";
import { toDateTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createFollowUp, updateFollowUp } from "@/actions/followups";
import { FollowUpTypeIcon } from "./followup-icon";

export type FollowUpFormValue = {
  id: string;
  title: string;
  type: string;
  dueAt: string;
  priority: string;
  notes: string | null;
  leadId: string;
  propertyId: string | null;
  assignedToId: string | null;
};

const DEFAULT_TITLES: Record<string, string> = {
  CALL: "Follow-up call",
  MEETING: "Meeting",
  SITE_VISIT: "Site visit",
  WHATSAPP: "Send details on WhatsApp",
  EMAIL: "Send email",
  OTHER: "Follow-up",
};

function quickTimes() {
  const now = new Date();
  const tomorrow10 = setMinutes(setHours(addDays(now, 1), 10), 0);
  return [
    { label: "In 1 hour", value: startOfHour(addHours(now, 2)) },
    { label: "Tomorrow 10 AM", value: tomorrow10 },
    { label: "In 3 days", value: setMinutes(setHours(addDays(now, 3), 11), 0) },
    { label: "Next week", value: setMinutes(setHours(addWeeks(now, 1), 11), 0) },
  ];
}

export function FollowUpFormModal({
  open,
  onClose,
  leadId,
  leads,
  users,
  properties,
  followUp,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: string;
  leads?: { id: string; name: string; phone: string }[];
  users: { id: string; name: string }[];
  properties: { id: string; title: string; code: string }[];
  followUp?: FollowUpFormValue;
  defaultType?: string;
}) {
  const [pending, start] = useTransition();
  const [type, setType] = useState(followUp?.type ?? defaultType ?? "CALL");
  const [title, setTitle] = useState(followUp?.title ?? DEFAULT_TITLES[defaultType ?? "CALL"]);
  const [titleTouched, setTitleTouched] = useState(!!followUp);
  const [due, setDue] = useState(followUp ? toDateTimeLocal(followUp.dueAt) : toDateTimeLocal(quickTimes()[1].value));

  useEffect(() => {
    if (!open) return;
    const t = followUp?.type ?? defaultType ?? "CALL";
    setType(t);
    setTitle(followUp?.title ?? DEFAULT_TITLES[t]);
    setTitleTouched(!!followUp);
    setDue(followUp ? toDateTimeLocal(followUp.dueAt) : toDateTimeLocal(quickTimes()[1].value));
  }, [open, followUp, defaultType]);

  const fixedLead = leadId ?? (followUp && !leads ? followUp.leadId : undefined);
  const formId = "followup-form";

  const submit = (fd: FormData) => {
    if (!due) {
      toast.error("Please choose a due date and time.");
      return;
    }
    fd.set("dueAt", new Date(due).toISOString());
    fd.set("type", type);
    fd.set("title", title);
    if (fixedLead) fd.set("leadId", fixedLead);
    start(async () => {
      const res = followUp ? await updateFollowUp(followUp.id, fd) : await createFollowUp(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(followUp ? "Follow-up updated" : "Follow-up scheduled");
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={followUp ? "Edit follow-up" : "Schedule follow-up"}
      description="Set a reminder so no lead goes cold."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {followUp ? "Save changes" : "Schedule"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="space-y-5"
      >
        <div>
          <p className="label">Type</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FOLLOWUP_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setType(t.value);
                  if (!titleTouched) setTitle(DEFAULT_TITLES[t.value]);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition",
                  type === t.value ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <FollowUpTypeIcon type={t.value} className="size-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!fixedLead && (
            <Field label="Lead" required className="sm:col-span-2">
              <select name="leadId" required defaultValue={followUp?.leadId ?? ""} className="input">
                <option value="">Select a lead</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} - {l.phone}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Title" required className="sm:col-span-2">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              required
              placeholder="e.g. Discuss payment plan"
            />
          </Field>
          <Field label="Due date and time" required className="sm:col-span-2">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickTimes().map((q) => {
                const v = toDateTimeLocal(q.value);
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setDue(v)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      due === v ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Priority">
            <Select name="priority" options={FOLLOWUP_PRIORITIES} defaultValue={followUp?.priority ?? "MEDIUM"} />
          </Field>
          <Field label="Assign to">
            <Select name="assignedToId" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Lead owner" defaultValue={followUp?.assignedToId ?? ""} />
          </Field>
          <Field label={type === "SITE_VISIT" ? "Property to visit" : "Related property"} className="sm:col-span-2">
            <Select
              name="propertyId"
              options={properties.map((p) => ({ value: p.id, label: `${p.code} - ${p.title}` }))}
              placeholder="None"
              defaultValue={followUp?.propertyId ?? ""}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={followUp?.notes ?? ""} placeholder="Talking points, documents to carry, etc." />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
