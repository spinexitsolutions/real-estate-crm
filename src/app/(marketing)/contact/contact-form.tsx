"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { sendContactMessage } from "./actions";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export function ContactForm() {
  const [state, action] = useActionState(sendContactMessage, undefined);
  if (state?.ok)
    return (
      <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
        <CircleCheck className="size-10 text-emerald-600" />
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Message sent</h2>
        <p className="mt-1 text-sm text-slate-600">Thank you for reaching out. We usually reply within one business day.</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
      {state?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Work email" required>
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Mobile number">
          <Input name="phone" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Company">
          <Input name="company" autoComplete="organization" />
        </Field>
      </div>
      <Field label="Topic">
        <Select
          name="topic"
          defaultValue="Sales"
          options={[
            { value: "Sales", label: "I want a demo / pricing" },
            { value: "Support", label: "Help with my account" },
            { value: "Billing", label: "Billing or refund" },
            { value: "Partnership", label: "Partnership" },
            { value: "Other", label: "Something else" },
          ]}
        />
      </Field>
      <Field label="Message" required>
        <Textarea name="message" required minLength={10} rows={5} placeholder="Tell us about your team and what you need..." />
      </Field>
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Sending...">
        Send message
      </SubmitButton>
    </form>
  );
}
