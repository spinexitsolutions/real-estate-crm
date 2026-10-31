import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Company", "Branding", "Team", "Leads", "Done"];

export function StepProgress({ step }: { step: number }) {
  return (
    <nav aria-label="Setup progress" className="mb-8">
      <p className="mb-3 text-sm font-medium text-slate-500">
        Step {step} of {STEPS.length}
      </p>
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={s}>
              <Link href={`/onboarding?step=${n}`} className="group block" aria-current={active ? "step" : undefined}>
                <span className={cn("block h-1.5 rounded-full transition", done || active ? "bg-brand-600" : "bg-slate-200 group-hover:bg-slate-300")} />
                <span className={cn("mt-2 hidden items-center gap-1 text-xs font-medium sm:flex", active ? "text-slate-900" : "text-slate-500")}>
                  {done && <Check className="size-3.5 text-brand-600" />}
                  {s}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}
