import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  ChartColumn,
  CircleCheck,
  FileText,
  Globe,
  Kanban,
  MapPinCheck,
  PhoneCall,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { ProductMockup } from "@/components/marketing/product-mockup";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import { BRAND } from "@/lib/brand";
import { getPublicPlans } from "@/lib/public-plans";
import { TRIAL_DAYS } from "@/lib/tenancy";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} - Real Estate CRM for Brokers and Builders in India` },
  description:
    "Capture leads from 99acres, MagicBricks, Housing and Facebook, follow up on WhatsApp, track site visits, bookings and payments - and close more deals. Free trial, no credit card.",
  openGraph: {
    title: `${BRAND.name} - Manage follow-ups, close more deals`,
    description: "The real estate CRM built for Indian brokers, agencies and builders.",
    type: "website",
  },
};

const TRUST = ["WhatsApp", "99acres", "MagicBricks", "Housing.com", "Facebook Lead Ads", "Razorpay"];

const PROBLEMS = [
  "Leads scattered across portals, WhatsApp and Excel sheets",
  "Follow-ups forgotten, hot buyers going cold",
  "No idea which agent called whom, or which source actually converts",
  "Payment schedules and receipts tracked by hand",
];
const SOLUTIONS = [
  "Every enquiry lands in one place, auto-assigned in seconds",
  "Reminders on phone and desktop - nobody misses a follow-up",
  "Calls, notes and site visits logged on every lead, with reports",
  "Booking, installments and GST-ready receipts in a few clicks",
];

const FEATURES = [
  { icon: Kanban, title: "Leads and pipeline", text: "Capture, score and move leads through a visual pipeline. Bulk actions, CSV import and smart property matching." },
  { icon: CalendarClock, title: "Follow-up reminders", text: "Calls, meetings and site visits with push, email and WhatsApp reminders. A daily agenda for every agent." },
  { icon: WhatsAppIcon, title: "WhatsApp inbox", text: "Templates, broadcasts and a two-way inbox with the WhatsApp Business API - or one-click chat without it." },
  { icon: PlugZap, title: "Portal integrations", text: "Leads from 99acres, MagicBricks, Housing.com, Facebook and Instagram arrive automatically, de-duplicated." },
  { icon: Building2, title: "Inventory and brochures", text: "Listings with photos and specs. Branded PDF brochures shared on WhatsApp in one tap." },
  { icon: ReceiptText, title: "Bookings and receipts", text: "Construction-linked plans, part payments, numbered receipts and statements, with due-date reminders." },
  { icon: UserRound, title: "Customer portal", text: "Buyers see their payment schedule, receipts and documents on a private link - fewer calls for your team." },
  { icon: PhoneCall, title: "Click-to-call", text: "Exotel and Knowlarity integration with call recordings and missed-call follow-ups." },
  { icon: MapPinCheck, title: "Attendance and site check-in", text: "GPS check-in for agents and verified site visits, with late and absent tracking." },
  { icon: ChartColumn, title: "Reports that matter", text: "Source ROI, conversion funnel, revenue and agent leaderboards against monthly targets." },
  { icon: Globe, title: "Your property website", text: "A fast listing website with enquiry forms that drop straight into your CRM." },
  { icon: Smartphone, title: "Works on every phone", text: "Install it like an app. Built for agents in the field, not just the office." },
];

const STEPS = [
  { n: "1", title: "Create your workspace", text: `Sign up in two minutes. Your ${TRIAL_DAYS}-day trial includes every core feature - no credit card.` },
  { n: "2", title: "Connect your lead sources", text: "Plug in portals, Facebook and your website, import your Excel sheet, and invite your team." },
  { n: "3", title: "Follow up and close", text: "Agents get reminders and WhatsApp templates; you see the pipeline, revenue and who is performing." },
];

const FAQ = [
  {
    q: "Is my data safe? Who can see it?",
    a: "Each company's data is fully isolated - no other customer can ever see it. Data is encrypted in transit, stored on secure cloud infrastructure with daily backups, and only your team members can access it, based on their role. You can export everything at any time.",
  },
  {
    q: "Do I need the WhatsApp Business API?",
    a: "No. Out of the box you can message any lead in one click with pre-filled templates through regular WhatsApp. If you want automatic sending, broadcasts and a shared inbox, connect your own WhatsApp Business API number from Settings.",
  },
  {
    q: "Will I get a GST invoice?",
    a: "Yes. Every subscription payment comes with a GST invoice. Add your company's GSTIN in billing to claim input tax credit.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month or yearly with no lock-in. If you cancel, you keep access until the end of the period you have paid for.",
  },
  {
    q: "What happens to my data if I stop using it?",
    a: "Your data stays yours. Download a full backup and CSV exports any time from Settings - even after your trial ends.",
  },
  {
    q: "Can I bring my existing leads?",
    a: "Yes. Import leads from Excel or CSV in a few clicks. Duplicates are detected automatically by phone number.",
  },
  {
    q: "Is it available in Hindi?",
    a: "The app is in English today. Hindi and other Indian languages are on our roadmap - tell us which language your team needs.",
  },
  {
    q: "Do you help with setup?",
    a: "Yes. Our team can help you import data, connect portals and train your agents. Reach out from the contact page.",
  },
];

export default async function LandingPage() {
  const plans = await getPublicPlans();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-gradient-to-b from-brand-50/70 via-white to-white" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:pb-28 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
              <BellRing className="size-3.5" /> Built for Indian brokers, agencies and builders
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Manage follow-ups.
              <br />
              <span className="text-brand-600">Close more deals.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              {BRAND.name} brings every enquiry from portals, WhatsApp and your website into one place, reminds your team to follow up, and tracks
              site visits, bookings and payments until the keys are handed over.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClass("primary", "lg", "h-12 px-6 text-[15px]")}>
                Start {TRIAL_DAYS}-day free trial <ArrowRight />
              </Link>
              <Link href="/pricing" className={buttonClass("secondary", "lg", "h-12 px-6 text-[15px]")}>
                See pricing
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              {["No credit card", "Set up in 2 minutes", "Cancel anytime"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CircleCheck className="size-4 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <ProductMockup />
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="Works with" className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:justify-between lg:px-8">
          <p className="text-sm font-medium text-slate-500">Works with the tools your team already uses</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST.map((t) => (
              <li key={t} className="text-[15px] font-semibold tracking-tight text-slate-400">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Problem -> solution */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Most deals are lost to slow follow-up</h2>
          <p className="mt-4 text-lg text-slate-600">Buyers enquire with several brokers at once. The one who calls back first, with the right property, wins.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-rose-600">Without a CRM</p>
            <ul className="mt-5 space-y-4">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 text-slate-700">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-rose-400" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">With {BRAND.name}</p>
            <ul className="mt-5 space-y-4">
              {SOLUTIONS.map((p) => (
                <li key={p} className="flex gap-3 text-slate-700">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /> {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-slate-50/70 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Everything in one place</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">From first enquiry to final payment</h2>
            <p className="mt-4 text-lg text-slate-600">One system for your sales team, your inventory and your customers.</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Up and running today</h2>
          <p className="mt-4 text-lg text-slate-600">No installation, no training week. Your team can start in minutes.</p>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{s.n}</span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Your data is isolated and encrypted" },
            { icon: FileText, t: "GST invoice on every payment" },
            { icon: Users, t: "Roles for admins, managers and agents" },
          ].map((x) => (
            <p key={x.t} className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <x.icon className="size-5 shrink-0 text-brand-600" /> {x.t}
            </p>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50/70 py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Simple pricing that grows with you</h2>
            <p className="mt-4 text-lg text-slate-600">Start free for {TRIAL_DAYS} days. Pick a plan only when you are ready.</p>
          </div>
          <PricingCards plans={plans} trialDays={TRIAL_DAYS} />
          <p className="mt-8 text-center text-sm text-slate-500">
            Need a detailed comparison?{" "}
            <Link href="/pricing" className="font-medium text-brand-600 hover:underline">
              Compare all features
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Frequently asked questions</h2>
        <div className="mt-10">
          <Faq items={FAQ} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#0b1020] px-6 py-14 text-center sm:px-12">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your next deal is already in your inbox</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">Bring every lead into one place and never miss a follow-up again.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClass("primary", "lg", "h-12 px-6 text-[15px]")}>
                Start free trial <ArrowRight />
              </Link>
              <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-[15px] font-medium text-white transition hover:bg-white/10">
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
