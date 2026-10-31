"use client";

import Link from "next/link";
import { CircleAlert, RotateCcw } from "lucide-react";
import { getGlobalReadOnlyReason } from "@/components/billing/read-only-context";
import { Button, LinkButton } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const readOnly = getGlobalReadOnlyReason();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{readOnly ? "This account is read-only" : "Something went wrong"}</h1>
        <p className="mt-2 text-sm text-slate-500">{readOnly ?? "The page could not be loaded. Please try again. If it keeps happening, contact support."}</p>
        {error.digest && !readOnly && <p className="mt-2 font-mono text-[11px] text-slate-400">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          {readOnly ? (
            <LinkButton href="/billing">Choose a plan</LinkButton>
          ) : (
            <Button onClick={reset}>
              <RotateCcw /> Try again
            </Button>
          )}
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
