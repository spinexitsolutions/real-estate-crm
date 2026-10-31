"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { resetPassword } from "@/actions/password";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <Field label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Saving...">
        Set new password
      </SubmitButton>
    </form>
  );
}
