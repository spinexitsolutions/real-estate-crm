import Link from "next/link";
import { CircleAlert, Clock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusBannerState = "trial" | "trial_expired" | "past_due" | "cancelled" | "suspended" | "ok";

/** Subscription status strip shown above the app header. */
export function StatusBanner({ state, daysLeft, readOnly, isAdmin }: { state: StatusBannerState; daysLeft: number | null; readOnly: boolean; isAdmin: boolean }) {
  if (state === "ok" || state === "suspended") return null;
  const cta = isAdmin ? "/billing" : null;

  if (state === "trial" && !readOnly) {
    const urgent = daysLeft !== null && daysLeft <= 3;
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px]", urgent ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-900")}>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" />
          {daysLeft === null ? "You are on a free trial." : daysLeft <= 1 ? "Your free trial ends today." : `${daysLeft} days left in your free trial.`}
        </span>
        {cta ? (
          <Link href={cta} className="font-semibold underline underline-offset-2 hover:no-underline">
            Choose a plan
          </Link>
        ) : (
          <span className="text-current/70">Ask your administrator to choose a plan.</span>
        )}
      </div>
    );
  }

  const message =
    state === "trial_expired"
      ? "Your free trial has ended. Your data is safe, but the account is read-only until you choose a plan."
      : state === "past_due"
        ? readOnly
          ? "We could not collect your last payment. The account is read-only until the payment is updated."
          : "We could not collect your last payment. Please update your payment method to avoid interruption."
        : "Your subscription has ended. Your data is safe, but the account is read-only until you renew.";
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-rose-600 px-4 py-2.5 text-center text-[13px] text-white">
      <span className="inline-flex items-center gap-1.5">
        <CircleAlert className="size-4 shrink-0" />
        {message}
      </span>
      {cta ? (
        <Link href={cta} className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-50">
          <CreditCard className="size-3.5" /> {state === "past_due" ? "Update payment" : "Choose a plan"}
        </Link>
      ) : (
        <span className="opacity-90">Please contact your administrator.</span>
      )}
    </div>
  );
}
