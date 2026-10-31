"use client";

import { useActionState } from "react";
import { CircleAlert, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/actions/password";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  if (state?.message)
    return (
      <div className="mt-8 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <MailCheck className="mt-0.5 size-5 shrink-0" />
        <p>{state.message}</p>
      </div>
    );
  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-10" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending link...">
        Send reset link
      </SubmitButton>
    </form>
  );
}
