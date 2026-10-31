import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarClock, CircleCheck, Kanban, Settings, Smartphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db, rawDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { BRAND } from "@/lib/brand";
import { StepCard, StepProgress } from "@/components/onboarding/step-shell";
import { BrandStep, CompanyStep, DoneStep, LeadsStep, TeamStep } from "@/components/onboarding/steps";

export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const { step: raw } = await searchParams;
  const step = Math.min(5, Math.max(1, Number(raw) || 1));

  const [settings, org, userCount, sampleCount] = await Promise.all([
    getSettings(),
    rawDb.organization.findUniqueOrThrow({ where: { id: user.organizationId }, include: { plan: { select: { maxUsers: true } } } }),
    db.user.count({ where: { active: true } }),
    db.lead.count({ where: { tags: { contains: "Sample" } } }),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  const key = settings.leadWebhookKey ?? "";
  const urls = key
    ? [
        { label: "Website / forms", url: `${origin}/api/webhooks/lead?key=${key}` },
        { label: "99acres", url: `${origin}/api/webhooks/portal/99acres?key=${key}` },
        { label: "MagicBricks", url: `${origin}/api/webhooks/portal/magicbricks?key=${key}` },
        { label: "Housing.com", url: `${origin}/api/webhooks/portal/housing?key=${key}` },
      ]
    : [];

  return (
    <>
      <StepProgress step={step} />
      {step === 1 && (
        <StepCard title={`Welcome to ${BRAND.name}, ${user.name.split(" ")[0]}`} description="Tell us about your business. This appears on brochures, receipts and your property website.">
          <CompanyStep
            initial={{
              companyName: settings.companyName,
              companyPhone: settings.companyPhone ?? "",
              companyEmail: settings.companyEmail ?? user.email,
              companyAddress: settings.companyAddress ?? "",
              city: org.city ?? "",
              businessType: org.businessType ?? "",
            }}
          />
        </StepCard>
      )}
      {step === 2 && (
        <StepCard title="Add your logo and colours" description="Make every brochure, receipt and customer page look like your brand.">
          <BrandStep initial={{ logoUrl: settings.logoUrl, brandColor: settings.brandColor, companyName: settings.companyName }} />
        </StepCard>
      )}
      {step === 3 && (
        <StepCard title="Invite your team" description="Add your agents and managers now, or later from the Team page.">
          <TeamStep maxUsers={org.plan?.maxUsers ?? 0} currentUsers={userCount} appUrl={origin} />
        </StepCard>
      )}
      {step === 4 && (
        <StepCard title="Get your leads in" description="Import existing leads, connect your sources, or explore with sample data first.">
          <LeadsStep urls={urls} hasSample={sampleCount > 0} />
        </StepCard>
      )}
      {step === 5 && (
        <StepCard title="You are all set" description="Your workspace is ready. Here are a few things to try first.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Kanban, t: "Open the pipeline", d: "Drag leads between stages as deals progress." },
              { icon: CalendarClock, t: "Clear today's follow-ups", d: "Every reminder in one agenda." },
              { icon: Smartphone, t: "Install on your phone", d: "Open the app in Chrome and choose Add to Home screen." },
              { icon: Settings, t: "Connect WhatsApp and portals", d: "From Settings and Integrations, any time." },
            ].map((x) => (
              <li key={x.t} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <x.icon className="mt-0.5 size-5 shrink-0 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{x.t}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{x.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <CircleCheck className="size-4 text-emerald-600" /> Setup complete
            </p>
            <DoneStep />
          </div>
        </StepCard>
      )}
    </>
  );
}
