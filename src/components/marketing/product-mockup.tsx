import { Bell, CalendarClock, CircleDollarSign, Handshake, Search, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/icons";

const KPIS = [
  { label: "Active leads", value: "248", sub: "+18% this month", icon: Users, tone: "bg-brand-50 text-brand-600" },
  { label: "Follow-ups today", value: "14", sub: "3 overdue", icon: CalendarClock, tone: "bg-amber-50 text-amber-600" },
  { label: "Pipeline", value: "₹42.6 Cr", sub: "31 open deals", icon: Handshake, tone: "bg-violet-50 text-violet-600" },
  { label: "Closed", value: "₹3.8 Cr", sub: "this month", icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-600" },
];

const COLUMNS = [
  { title: "New", dot: "bg-sky-500", cards: [["Rahul Verma", "2 BHK, Baner", "₹85 L"], ["Ananya Iyer", "Villa, Whitefield", "₹2.4 Cr"]] },
  { title: "Site Visit", dot: "bg-amber-500", cards: [["Karan Mehta", "3 BHK, Powai", "₹1.9 Cr"]] },
  { title: "Negotiation", dot: "bg-orange-500", cards: [["Sneha Kapoor", "Office, BKC", "₹5.2 Cr"], ["Vikram Rao", "Plot, Hinjewadi", "₹98 L"]] },
];

/** Stylised, decorative preview of the CRM (pure HTML/CSS, no screenshots). */
export function ProductMockup() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-indigo-100/40 to-emerald-100/40 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <div className="ml-3 flex h-6 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-400">
            <Search className="size-3" /> Search leads, properties...
          </div>
          <Bell className="size-3.5 text-slate-400" />
        </div>
        <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[120px_1fr]">
          <div className="space-y-1.5 bg-[#0b1020] p-2 sm:p-3">
            {["Dashboard", "Leads", "Pipeline", "Follow-ups", "Properties", "WhatsApp"].map((l, i) => (
              <div key={l} className={`truncate rounded-md px-2 py-1.5 text-[9px] font-medium sm:text-[10px] ${i === 2 ? "bg-white/10 text-white" : "text-slate-500"}`}>
                {l}
              </div>
            ))}
          </div>
          <div className="space-y-3 bg-[#f6f7fb] p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-medium text-slate-500">{k.label}</span>
                    <span className={`flex size-5 items-center justify-center rounded ${k.tone}`}>
                      <k.icon className="size-3" />
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{k.value}</p>
                  <p className="text-[8px] text-slate-400">{k.sub}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COLUMNS.map((c) => (
                <div key={c.title} className="rounded-lg bg-slate-100/80 p-1.5">
                  <p className="mb-1.5 flex items-center gap-1 px-1 text-[9px] font-semibold text-slate-700">
                    <span className={`size-1.5 rounded-full ${c.dot}`} /> {c.title}
                  </p>
                  <div className="space-y-1.5">
                    {c.cards.map(([n, r, b]) => (
                      <div key={n} className="rounded-md border border-slate-200 bg-white p-1.5">
                        <p className="truncate text-[9px] font-medium text-slate-800">{n}</p>
                        <p className="truncate text-[8px] text-slate-500">{r}</p>
                        <p className="text-[8px] font-semibold text-slate-700">{b}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-pop sm:block">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <WhatsAppIcon className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">Rahul Verma</p>
            <p className="text-[9px] text-emerald-600">replied just now</p>
          </div>
        </div>
        <p className="mt-2 rounded-lg rounded-tl-none bg-emerald-50 px-2.5 py-1.5 text-[10px] text-slate-700">Yes, Saturday 11 AM works for the site visit.</p>
      </div>
      <div className="absolute -right-3 -top-4 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-pop sm:block">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-900">
          <CalendarClock className="size-3.5 text-amber-500" /> Follow-up in 10 min
        </p>
        <p className="text-[9px] text-slate-500">Call Karan about Powai 3 BHK</p>
      </div>
    </div>
  );
}
