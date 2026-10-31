import { Lock, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import type { FeatureLock } from "@/lib/plans";

/** Full-page state shown when the organization's plan does not include a feature. */
export function UpgradeRequired({ featureLabel, currentPlan, upgradePlan }: FeatureLock) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-lg p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{featureLabel} is not part of your plan</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {currentPlan ? `You are on the ${currentPlan} plan. ` : ""}
          {upgradePlan ? `Upgrade to ${upgradePlan} or higher to unlock ${featureLabel.toLowerCase()} for your whole team.` : "Upgrade your plan to unlock this feature."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton href="/billing">
            <Sparkles /> {upgradePlan ? `Upgrade to ${upgradePlan}` : "See plans"}
          </LinkButton>
          <LinkButton href="/dashboard" variant="secondary">
            Back to dashboard
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

/** Inline lock card for a section (e.g. a settings card) that the plan does not include. */
export function LockedCard({ title, featureLabel, upgradePlan }: { title: string; featureLabel: string; upgradePlan: string | null }) {
  return (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center lg:p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Lock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {featureLabel} is available on {upgradePlan ? `the ${upgradePlan} plan and above` : "higher plans"}.
        </p>
      </div>
      <LinkButton href="/billing" variant="outline" size="sm">
        <Sparkles /> Upgrade
      </LinkButton>
    </section>
  );
}
