import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { rawDb } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/tenancy";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your free trial" };

const BENEFITS = ["All core features unlocked", "No credit card required", "Import your leads from Excel", "Cancel anytime - your data stays yours"];

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: code } = await searchParams;
  const plan = code ? await rawDb.plan.findFirst({ where: { code: code.toUpperCase(), active: true }, select: { code: true, name: true } }) : null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Start your {TRIAL_DAYS}-day free trial</h1>
      <p className="mt-1.5 text-sm text-slate-500">Set up your {BRAND.name} workspace in under 2 minutes.</p>
      {plan && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Trying the {plan.name} plan
          <Link href="/pricing" className="underline-offset-2 hover:underline">
            Change
          </Link>
        </p>
      )}
      <ul className="mt-5 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {b}
          </li>
        ))}
      </ul>
      <SignupForm plan={plan?.code} />
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
