"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { submitEnquiry } from "@/app/site/actions";

const input =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
      {pending ? "Sending..." : "Send enquiry"}
    </button>
  );
}

export function EnquiryForm({ propertyId, defaultMessage, showVisitDate = true }: { propertyId?: string; defaultMessage?: string; showVisitDate?: boolean }) {
  const [state, action] = useActionState(submitEnquiry, undefined);
  if (state?.ok)
    return (
      <div className="flex flex-col items-center rounded-xl bg-emerald-50 px-5 py-8 text-center">
        <CircleCheck className="size-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-slate-900">Thank you, our team will call you shortly.</p>
        <p className="mt-1 text-sm text-slate-600">We usually respond within 15 minutes during working hours.</p>
      </div>
    );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3">
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <input name="name" required minLength={2} placeholder="Your name" autoComplete="name" className={input} aria-label="Your name" />
      <input name="phone" required inputMode="tel" placeholder="Mobile number" autoComplete="tel" className={input} aria-label="Mobile number" />
      <input name="email" type="email" placeholder="Email (optional)" autoComplete="email" className={input} aria-label="Email" />
      {showVisitDate && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Preferred site visit date (optional)</span>
          <input name="visitDate" type="date" min={today} className={input} />
        </label>
      )}
      <textarea name="message" rows={3} defaultValue={defaultMessage} placeholder="Message (optional)" className={`${input} resize-y`} aria-label="Message" />
      <Submit />
      <p className="text-center text-[11px] text-slate-400">By submitting you agree to be contacted about properties by phone, WhatsApp or email.</p>
    </form>
  );
}
