"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button-styles";
import { featureLabel, limitLabel } from "@/lib/feature-labels";
import { cn } from "@/lib/utils";

export type PricingPlan = {
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxLeads: number;
  maxProperties: number;
  storageGb: number;
  features: string[];
  highlighted: boolean;
};

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** Highlights shown on each card: what the plan adds on top of the previous one. */
function highlights(plan: PricingPlan, prev: PricingPlan | undefined) {
  const prevSet = new Set(prev?.features ?? []);
  const added = plan.features.filter((f) => !prevSet.has(f));
  return (prev ? added : plan.features).slice(0, prev ? 7 : 6).map(featureLabel);
}

export function PricingCards({ plans, trialDays }: { plans: PricingPlan[]; trialDays: number }) {
  const [yearly, setYearly] = useState(false);
  const maxSave = Math.max(0, ...plans.map((p) => (p.priceMonthly * 12 > p.priceYearly ? Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100) : 0)));

  if (!plans.length) return <p className="text-center text-slate-500">Plans will be available soon.</p>;

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-xs" role="group" aria-label="Billing period">
          {[
            { v: false, l: "Monthly" },
            { v: true, l: "Yearly" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              aria-pressed={yearly === o.v}
              onClick={() => setYearly(o.v)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition", yearly === o.v ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}
            >
              {o.l}
              {o.v && maxSave > 0 && <span className={cn("ml-1.5 text-xs", yearly ? "text-emerald-300" : "text-emerald-600")}>Save {maxSave}%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mx-auto mt-10 grid max-w-6xl gap-6", plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {plans.map((p, i) => {
          const perMonth = yearly ? p.priceYearly / 12 : p.priceMonthly;
          return (
            <div
              key={p.code}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-7",
                p.highlighted ? "border-brand-500 shadow-pop ring-4 ring-brand-500/10" : "border-slate-200 shadow-card",
              )}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
              {p.description && <p className="mt-1 min-h-10 text-sm text-slate-500">{p.description}</p>}
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight text-slate-900">{inr(Math.round(perMonth))}</span>
                <span className="pb-1.5 text-sm text-slate-500">/ month</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {yearly ? `${inr(p.priceYearly)} billed yearly` : "Billed monthly"} + 18% GST
              </p>
              <Link href={`/signup?plan=${p.code}`} className={buttonClass(p.highlighted ? "primary" : "secondary", "lg", "mt-6 w-full")}>
                Start {trialDays}-day free trial
              </Link>
              <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-6 text-sm">
                <li className="font-medium text-slate-900">
                  {limitLabel(p.maxUsers)} {p.maxUsers === 1 ? "user" : "users"}, {limitLabel(p.maxLeads)} leads
                </li>
                {i > 0 && <li className="text-slate-500">Everything in {plans[i - 1].name}, plus:</li>}
                {highlights(p, plans[i - 1]).map((f) => (
                  <li key={f} className="flex gap-2.5 text-slate-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
