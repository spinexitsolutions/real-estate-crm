"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { cancelMySubscription, startSubscription, verifySubscription } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type PlanCard = {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxLeads: number;
  maxProperties: number;
  highlighted: boolean;
  features: string[];
  onlineReady: boolean;
  monthlyWithGst: number;
  yearlyWithGst: number;
};

type Cycle = "MONTHLY" | "YEARLY";

function yearlySavingPercent(monthly: number, yearly: number) {
  if (!monthly || !yearly) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const limit = (n: number, unit: string) => (n ? `Up to ${n.toLocaleString("en-IN")} ${unit}` : `Unlimited ${unit}`);

export function PlanPicker({
  plans,
  currentPlanId,
  currentCycle,
  canBuy,
  isAdmin,
  brandColor,
}: {
  plans: PlanCard[];
  currentPlanId: string | null;
  currentCycle: Cycle;
  canBuy: boolean;
  isAdmin: boolean;
  brandColor: string;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>(currentCycle === "YEARLY" ? "YEARLY" : "MONTHLY");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const maxSaving = Math.max(0, ...plans.map((p) => yearlySavingPercent(p.priceMonthly, p.priceYearly)));

  const subscribe = (plan: PlanCard) =>
    start(async () => {
      setBusy(plan.id);
      const ready = await loadCheckout();
      if (!ready || !window.Razorpay) {
        setBusy(null);
        return void toast.error("Could not load the payment window. Check your internet connection and try again.");
      }
      const res = await startSubscription(plan.id, cycle);
      if (res.error || !res.data) {
        setBusy(null);
        return void toast.error(res.error ?? "Could not start checkout.");
      }
      const d = res.data;
      const rzp = new window.Razorpay({
        key: d.keyId,
        subscription_id: d.subscriptionId,
        name: "Subscription",
        description: `${d.planName} plan - ${d.cycle === "YEARLY" ? "yearly" : "monthly"}`,
        prefill: d.prefill,
        theme: { color: brandColor },
        modal: { ondismiss: () => setBusy(null) },
        handler: async (r: RazorpayResponse) => {
          const v = await verifySubscription({ paymentId: r.razorpay_payment_id, subscriptionId: r.razorpay_subscription_id, signature: r.razorpay_signature });
          setBusy(null);
          if (v.error) return void toast.error(v.error);
          toast.success(`You are now on the ${v.data?.planName} plan. Thank you!`);
          router.refresh();
        },
      });
      rzp.on("payment.failed", (e) => {
        setBusy(null);
        toast.error(e.error?.description ?? "Payment failed. Please try another method.");
      });
      rzp.open();
    });

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
          <p className="text-sm text-slate-500">Prices exclude 18% GST. Cancel anytime.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {(["MONTHLY", "YEARLY"] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cn("rounded-md px-3.5 py-1.5 text-[13px] font-medium transition", cycle === c ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800")}
            >
              {c === "MONTHLY" ? "Monthly" : "Yearly"}
              {c === "YEARLY" && maxSaving > 0 && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-700">Save {maxSaving}%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = currentPlanId === p.id && currentCycle === cycle;
          const price = cycle === "YEARLY" ? p.priceYearly : p.priceMonthly;
          const saving = yearlySavingPercent(p.priceMonthly, p.priceYearly);
          return (
            <div key={p.id} className={cn("card relative flex flex-col p-6", p.highlighted && "border-brand-300 ring-4 ring-brand-500/10")}>
              {p.highlighted && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles className="size-3" /> Most popular
                </span>
              )}
              <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
              {p.description && <p className="mt-1 min-h-10 text-sm text-slate-500">{p.description}</p>}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-slate-900">{formatCurrency(price)}</span>
                <span className="text-sm text-slate-500">/ {cycle === "YEARLY" ? "year" : "month"}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatCurrency(cycle === "YEARLY" ? p.yearlyWithGst : p.monthlyWithGst)} incl. GST
                {cycle === "YEARLY" && saving > 0 ? ` - save ${saving}% vs monthly` : ""}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {limit(p.maxUsers, "users")}
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {limit(p.maxLeads, "leads")}
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {limit(p.maxProperties, "properties")}
                </li>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : !isAdmin ? (
                  <p className="text-center text-xs text-slate-500">Only an administrator can change the plan.</p>
                ) : !canBuy || !p.onlineReady ? (
                  <Button variant="secondary" className="w-full" disabled title="Online payments are not configured yet">
                    Contact us to choose {p.name}
                  </Button>
                ) : (
                  <Button className="w-full" variant={p.highlighted ? "primary" : "secondary"} loading={busy === p.id} disabled={!!busy && busy !== p.id} onClick={() => subscribe(p)}>
                    {currentPlanId ? `Switch to ${p.name}` : `Subscribe to ${p.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CancelSubscriptionButton({ periodEnd }: { periodEnd: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-medium text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline">
        Cancel subscription
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel your subscription?"
        description={`You will not be charged again.${periodEnd ? ` Your team keeps full access until ${periodEnd}` : ""}, after which the account becomes read-only. Your data is never deleted and you can resubscribe anytime.`}
        confirmLabel="Cancel subscription"
        successMessage="Subscription cancelled"
        action={async () => {
          const r = await cancelMySubscription();
          router.refresh();
          return r;
        }}
      />
    </>
  );
}
