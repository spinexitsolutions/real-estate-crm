"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import { register } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <Field label="Company name">
        <Input name="company" placeholder="Skyline Realty" className="h-10" />
      </Field>
      <Field label="Your name" required>
        <Input name="name" required placeholder="Full name" className="h-10" />
      </Field>
      <Field label="Email address" required>
        <Input name="email" type="email" required placeholder="you@company.com" className="h-10" />
      </Field>
      <Field label="Password" required hint="Minimum 8 characters">
        <Input name="password" type="password" required minLength={8} className="h-10" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Creating workspace...">
        Create workspace
      </SubmitButton>
    </form>
  );
}
