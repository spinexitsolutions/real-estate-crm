import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-slate-500">Enter your work email and we will send you a link to reset it.</p>
      <ForgotPasswordForm />
      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </>
  );
}
