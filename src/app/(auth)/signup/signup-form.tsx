"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { register } from "@/actions/auth";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export function SignupForm({ plan }: { plan?: string }) {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      {plan && <input type="hidden" name="plan" value={plan} />}
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <Field label="Company name" required>
        <Input name="company" required placeholder="Skyline Realty" className="h-10" autoComplete="organization" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <Input name="name" required placeholder="Full name" className="h-10" autoComplete="name" />
        </Field>
        <Field label="Mobile number" required>
          <Input name="phone" required inputMode="tel" placeholder="98XXXXXXXX" className="h-10" autoComplete="tel" />
        </Field>
      </div>
      <Field label="Work email" required>
        <Input name="email" type="email" required placeholder="you@company.com" className="h-10" autoComplete="email" />
      </Field>
      <Field label="Password" required hint="Minimum 8 characters">
        <Input name="password" type="password" required minLength={8} className="h-10" autoComplete="new-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="You are a">
          <Select
            name="businessType"
            className="h-10"
            defaultValue="BROKER"
            options={[
              { value: "BROKER", label: "Broker / Agency" },
              { value: "BUILDER", label: "Builder / Developer" },
              { value: "BOTH", label: "Both" },
            ]}
          />
        </Field>
        <Field label="Team size">
          <Select
            name="teamSize"
            className="h-10"
            defaultValue="2-5"
            options={[
              { value: "1", label: "Just me" },
              { value: "2-5", label: "2-5" },
              { value: "6-20", label: "6-20" },
              { value: "21-50", label: "21-50" },
              { value: "50+", label: "50+" },
            ]}
          />
        </Field>
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Creating your workspace...">
        Create my workspace
      </SubmitButton>
      <p className="text-center text-xs text-slate-500">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline hover:text-slate-700">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-slate-700">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
