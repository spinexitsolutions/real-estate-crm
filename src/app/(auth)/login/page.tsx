import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CircleCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-500">Sign in to your workspace to continue.</p>
      {reset === "1" && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CircleCheck className="size-4 shrink-0" />
          Your password was changed. Sign in with your new password.
        </div>
      )}
      <LoginForm next={next ?? ""} />
      <p className="mt-6 text-center text-sm text-slate-500">
        New to {BRAND.name}?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Start your free trial
        </Link>
      </p>
    </>
  );
}
