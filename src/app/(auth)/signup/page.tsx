import Link from "next/link";
import { TRIAL_DAYS } from "@/lib/tenancy";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your free trial" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Start your {TRIAL_DAYS}-day free trial</h1>
      <p className="mt-1.5 text-sm text-slate-500">No credit card needed. Set up your company in under 2 minutes.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
