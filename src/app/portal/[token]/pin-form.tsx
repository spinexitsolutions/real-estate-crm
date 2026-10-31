"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { unlockPortal } from "@/actions/portal";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function PinForm({ token, color }: { token: string; color: string }) {
  const [state, action] = useActionState(unlockPortal.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: `${color}14`, color }}>
        <LockKeyhole className="size-5" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-semibold text-slate-900">Enter your PIN</h1>
        <p className="mt-1 text-sm text-slate-500">Your relationship manager shared a 4-6 digit PIN with you.</p>
      </div>
      {state?.error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{state.error}</p>}
      <Input name="pin" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="PIN" className="h-12 text-center text-xl tracking-[0.5em]" />
      <SubmitButton size="lg" className="w-full" pendingText="Checking...">
        View my account
      </SubmitButton>
    </form>
  );
}
