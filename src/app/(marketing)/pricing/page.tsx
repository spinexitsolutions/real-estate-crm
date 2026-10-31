import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import { buttonClass } from "@/components/ui/button-styles";
import { BRAND } from "@/lib/brand";
import { FEATURES, limitLabel } from "@/lib/feature-labels";
import { getPublicPlans } from "@/lib/public-plans";
import { TRIAL_DAYS } from "@/lib/tenancy";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Pricing",
  description: `Simple monthly and yearly plans for real estate teams. Start with a ${TRIAL_DAYS}-day free trial, no credit card needed.`,
  openGraph: { title: `${BRAND.name} pricing`, description: "Plans for brokers, agencies and builders. Free trial, cancel anytime." },
};

const FAQ = [
  { q: "Are prices inclusive of GST?", a: "Prices are shown before GST. 18% GST is added at checkout and shown on your invoice." },
  { q: "What happens after my free trial?", a: "Your data stays safe. You can view and export it, but adding or editing is paused until you choose a plan." },
  { q: "Can I change plans later?", a: "Yes, upgrade or downgrade any time from Billing. Upgrades apply immediately." },
  { q: "How do I pay?", a: "Pay securely with UPI AutoPay, debit or credit card, or net banking through Razorpay." },
  { q: "Do you offer refunds?", a: "See our cancellation and refund policy for details. You can cancel any time and keep access until the end of your paid period." },
];

export default async function PricingPage() {
  const plans = await getPublicPlans();

  const limits: { label: string; value: (p: (typeof plans)[number]) => string }[] = [
    { label: "Team members", value: (p) => limitLabel(p.maxUsers) },
    { label: "Leads", value: (p) => limitLabel(p.maxLeads) },
    { label: "Properties", value: (p) => limitLabel(p.maxProperties) },
    { label: "File storage", value: (p) => (p.storageGb ? `${p.storageGb} GB` : "Unlimited") },
  ];
  const groups = ["Core", "Growth", "Advanced"] as const;

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50/70 to-white px-4 pb-16 pt-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Plans for every real estate team</h1>
          <p className="mt-4 text-lg text-slate-600">
            Start with a {TRIAL_DAYS}-day free trial. No credit card. Upgrade, downgrade or cancel any time.
          </p>
        </div>
        <div className="mt-10">
          <PricingCards plans={plans} trialDays={TRIAL_DAYS} />
        </div>
      </section>

      {plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="compare">
          <h2 id="compare" className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Compare plans
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="w-2/5 px-5 py-4 text-left font-medium text-slate-500">
                    Feature
                  </th>
                  {plans.map((p) => (
                    <th key={p.code} scope="col" className={cn("px-5 py-4 text-center font-semibold text-slate-900", p.highlighted && "bg-brand-50/60")}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th colSpan={plans.length + 1} scope="colgroup" className="bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Limits
                  </th>
                </tr>
                {limits.map((l) => (
                  <tr key={l.label} className="border-t border-slate-100">
                    <th scope="row" className="px-5 py-3 text-left font-normal text-slate-700">
                      {l.label}
                    </th>
                    {plans.map((p) => (
                      <td key={p.code} className={cn("px-5 py-3 text-center font-medium text-slate-900", p.highlighted && "bg-brand-50/40")}>
                        {l.value(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                {groups.map((g) => (
                  <FeatureGroup key={g} group={g} plans={plans} />
                ))}
                <tr className="border-t border-slate-200">
                  <td className="px-5 py-4" />
                  {plans.map((p) => (
                    <td key={p.code} className={cn("px-5 py-4 text-center", p.highlighted && "bg-brand-50/40")}>
                      <Link href={`/signup?plan=${p.code}`} className={buttonClass(p.highlighted ? "primary" : "secondary", "sm")}>
                        Try {p.name}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">All prices in INR, exclusive of 18% GST. Yearly plans are billed upfront.</p>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Billing questions</h2>
        <div className="mt-8">
          <Faq items={FAQ} />
        </div>
        <p className="mt-8 text-center text-sm text-slate-600">
          Large team or need a custom plan?{" "}
          <Link href="/contact" className="font-medium text-brand-600 hover:underline">
            Contact us
          </Link>
        </p>
      </section>
    </>
  );
}

function FeatureGroup({ group, plans }: { group: string; plans: Awaited<ReturnType<typeof getPublicPlans>> }) {
  const rows = FEATURES.filter((f) => f.group === group);
  return (
    <>
      <tr>
        <th colSpan={plans.length + 1} scope="colgroup" className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
          {group}
        </th>
      </tr>
      {rows.map((f) => (
        <tr key={f.key} className="border-t border-slate-100">
          <th scope="row" className="px-5 py-3 text-left font-normal text-slate-700">
            {f.label}
          </th>
          {plans.map((p) => {
            const has = p.features.includes(f.key);
            return (
              <td key={p.code} className={cn("px-5 py-3 text-center", p.highlighted && "bg-brand-50/40")}>
                {has ? (
                  <Check className="mx-auto size-5 text-emerald-600" aria-label="Included" />
                ) : (
                  <Minus className="mx-auto size-4 text-slate-300" aria-label="Not included" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
