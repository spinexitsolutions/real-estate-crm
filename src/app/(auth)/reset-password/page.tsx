import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { isResetTokenValid } from "@/actions/password";
import { buttonClass } from "@/components/ui/button-styles";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await isResetTokenValid(token);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
      {valid ? (
        <>
          <p className="mt-1.5 text-sm text-slate-500">Use at least 8 characters. You will be asked to sign in again.</p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <>
          <div className="mt-8 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            This reset link is invalid, has expired or was already used.
          </div>
          <Link href="/forgot-password" className={buttonClass("primary", "lg", "mt-6 w-full")}>
            Request a new link
          </Link>
        </>
      )}
    </>
  );
}
