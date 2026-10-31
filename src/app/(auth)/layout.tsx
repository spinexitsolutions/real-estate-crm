import { Building2, CalendarClock, ChartColumn, MessageCircle } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

const points = [
  { icon: Building2, title: "Leads and inventory in one place", text: "Track every enquiry and match it with the right property." },
  { icon: CalendarClock, title: "Never miss a follow-up", text: "Smart reminders for calls, meetings and site visits." },
  { icon: MessageCircle, title: "WhatsApp built in", text: "Send templates and property details in one click." },
  { icon: ChartColumn, title: "Reports that drive decisions", text: "Source ROI, agent performance and revenue at a glance." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center gap-2.5">
            <LogoMark className="size-9" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">{BRAND.name}</span>
          </Link>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b1020] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -right-32 -top-32 size-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-200">Real Estate CRM</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-white">
            Manage follow-ups.
            <br />
            Close more deals.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Everything your sales team needs to turn enquiries into bookings, in one fast and focused workspace.
          </p>
          <div className="mt-10 grid gap-5">
            {points.map((p) => (
              <div key={p.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-brand-200 ring-1 ring-white/10">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
