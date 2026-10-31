"use client";

import { useState, useTransition } from "react";
import { addDays, setHours, setMinutes } from "date-fns";
import { appNow, fromDateTimeLocal } from "@/lib/timezone";
import { Check, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FOLLOWUP_OUTCOMES, FOLLOWUP_TYPES } from "@/lib/constants";
import { toDateTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { completeFollowUp } from "@/actions/followups";

export function CompleteFollowUpButton({ id, leadName, size = "sm" }: { id: string; leadName: string; size?: "sm" | "md" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDue, setNextDue] = useState("");

  const openModal = () => {
    setOutcome("");
    setScheduleNext(false);
    setNextDue(toDateTimeLocal(setMinutes(setHours(addDays(appNow(), 2), 11), 0)));
    setOpen(true);
  };

  const submit = (fd: FormData) => {
    fd.set("outcome", outcome);
    if (scheduleNext) {
      if (!nextDue) {
        toast.error("Pick a date for the next follow-up.");
        return;
      }
      fd.set("scheduleNext", "true");
      fd.set("nextDueAt", fromDateTimeLocal(nextDue));
    }
    start(async () => {
      const res = await completeFollowUp(id, fd);
      if (res.error) return void toast.error(res.error);
      toast.success(scheduleNext ? "Marked done and next follow-up scheduled" : "Follow-up marked as done");
      setOpen(false);
    });
  };

  return (
    <>
      {size === "icon" ? (
        <button
          type="button"
          onClick={openModal}
          title="Mark as done"
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <Check className="size-4" />
        </button>
      ) : (
        <Button variant="secondary" size={size} onClick={openModal}>
          <CircleCheck className="text-emerald-600" /> Done
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Complete follow-up"
        description={`Log the outcome of your interaction with ${leadName}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form={`complete-${id}`} variant="success" loading={pending}>
              <Check /> Mark as done
            </Button>
          </>
        }
      >
        <form
          id={`complete-${id}`}
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
          className="space-y-5"
        >
          <div>
            <p className="label">Outcome</p>
            <div className="flex flex-wrap gap-1.5">
              {FOLLOWUP_OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(outcome === o ? "" : o)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    outcome === o ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="What was discussed? Any objections or next steps?" />
          </Field>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} className="size-4 rounded border-slate-300 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium text-slate-800">Schedule next follow-up</span>
                <span className="block text-xs text-slate-500">Keep the conversation moving with a new reminder.</span>
              </span>
            </label>
            {scheduleNext && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Title" className="sm:col-span-2">
                  <Input name="nextTitle" defaultValue="Follow-up call" />
                </Field>
                <Field label="Type">
                  <Select name="nextType" options={FOLLOWUP_TYPES} defaultValue="CALL" />
                </Field>
                <Field label="Due">
                  <Input type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
