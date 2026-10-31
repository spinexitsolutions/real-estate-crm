import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CircleCheck, Download, FileText, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getPortalAccess } from "@/lib/portal-access";
import { DOCUMENT_CATEGORIES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { effectiveStatus, summarizeInstallments } from "@/lib/payment-plan";
import { cn, parseImages, waLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/icons";
import { PinForm } from "./pin-form";

export const metadata: Metadata = { title: "Customer portal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  PARTIAL: { label: "Part paid", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  PENDING: { label: "Upcoming", cls: "bg-slate-50 text-slate-600 ring-slate-500/20" },
  OVERDUE: { label: "Overdue", cls: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  WAIVED: { label: "Waived", cls: "bg-slate-50 text-slate-500 ring-slate-500/20" },
};

function safeColor(c: string | null | undefined) {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#4f46e5";
}

function formatSize(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPortalAccess(token);
  const settings = await getSettings();
  const color = safeColor(settings.brandColor);

  if (!portal) notFound();

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt={settings.companyName} className="h-9 max-w-36 object-contain" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: color }}>
                {settings.companyName.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{settings.companyName}</p>
              <p className="text-xs text-slate-500">Customer portal</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" /> Private and secure
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-400">
        {settings.companyName}
        {settings.reraNumber ? ` - RERA ${settings.reraNumber}` : ""}
        {settings.companyAddress ? ` - ${settings.companyAddress}` : ""}
      </footer>
    </div>
  );

  if (!portal.unlocked) {
    return (
      <Shell>
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <PinForm token={token} color={color} />
        </div>
      </Shell>
    );
  }

  const lead = await db.lead.findUnique({
    where: { id: portal.access.leadId },
    include: {
      assignedTo: { select: { name: true, phone: true, email: true } },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { bookingDate: "desc" },
        include: {
          property: { select: { title: true, images: true, locality: true, city: true, code: true } },
          installments: { orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }] },
        },
      },
      documents: { where: { visibleToCustomer: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound();
  await db.portalAccess.update({ where: { id: portal.access.id }, data: { lastViewedAt: new Date() } });

  const now = new Date();
  const first = lead.name.split(" ")[0];
  const rm = lead.assignedTo;
  const rmPhone = rm?.phone || settings.companyPhone;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hello {first},</h1>
        <p className="mt-1 text-sm text-slate-500">Here is everything about your home purchase in one place. This page is updated as soon as we record a payment.</p>
      </div>

      {lead.bookings.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          Your booking details will appear here once your booking is confirmed.
        </div>
      )}

      <div className="space-y-6">
        {lead.bookings.map((b) => {
          const s = summarizeInstallments(b.installments, now);
          const img = b.property ? parseImages(b.property.images)[0] : undefined;
          const next = s.nextDue;
          const nextOverdue = next ? effectiveStatus(next, now) === "OVERDUE" : false;
          return (
            <section key={b.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex gap-4 p-5">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="size-20 shrink-0 rounded-xl object-cover sm:size-24" />
                ) : null}
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Booking {b.bookingNo}</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{b.property?.title ?? "Your property"}</h2>
                  {b.property && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="size-3.5" /> {[b.property.locality, b.property.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {b.unitNumber ? `Unit ${b.unitNumber} - ` : ""}Booked on {formatDate(b.bookingDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 bg-slate-50/60 text-center">
                <Tile label="Total value" value={formatCurrency(s.total)} />
                <Tile label="Paid" value={formatCurrency(s.paid)} tone="text-emerald-700" />
                <Tile label="Balance" value={formatCurrency(s.outstanding)} />
              </div>

              <div className="px-5 pt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{s.progress}% paid</span>
                  {b.status === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <CircleCheck className="size-3.5" /> Fully paid
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: color }} />
                </div>
              </div>

              {next && (
                <div className={cn("mx-5 mt-4 flex items-center gap-3 rounded-xl px-4 py-3", nextOverdue ? "bg-rose-50" : "bg-amber-50")}>
                  <CalendarClock className={cn("size-5 shrink-0", nextOverdue ? "text-rose-600" : "text-amber-600")} />
                  <div className="text-sm">
                    <p className={cn("font-semibold", nextOverdue ? "text-rose-700" : "text-amber-800")}>
                      {formatCurrency(next.amount - next.paidAmount)} {nextOverdue ? "was due" : "due"} on {formatDate(next.dueDate)}
                    </p>
                    <p className={nextOverdue ? "text-rose-600" : "text-amber-700"}>{next.label}</p>
                  </div>
                </div>
              )}

              <div className="p-5">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Payment schedule</h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {b.installments.map((i) => {
                    const st = STATUS_STYLE[effectiveStatus(i, now)] ?? STATUS_STYLE.PENDING;
                    return (
                      <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{i.label}</p>
                          <p className="text-xs text-slate-500">
                            Due {formatDate(i.dueDate)}
                            {i.paidAmount > 0 && i.status !== "PAID" ? ` - paid ${formatCurrency(i.paidAmount)}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(i.amount)}</p>
                          <span className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", st.cls)}>{st.label}</span>
                        </div>
                        {i.receiptNo ? (
                          <a
                            href={`/api/public/portal/${token}/receipt/${i.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`Receipt ${i.receiptNo}`}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Download className="size-4" />
                          </a>
                        ) : (
                          <span className="w-8" />
                        )}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href={`/api/public/portal/${token}/statement/${b.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileText className="size-4" /> Download account statement
                </a>
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Documents shared with you</h2>
            <p className="text-[13px] text-slate-500">Agreements, allotment letters and other papers</p>
          </div>
          {lead.documents.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No documents shared yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lead.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/public/portal/${token}/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{d.name}</span>
                      <span className="block text-xs text-slate-500">
                        {labelOf(DOCUMENT_CATEGORIES, d.category)} - {formatSize(d.size)} - {formatDate(d.createdAt)}
                      </span>
                    </span>
                    <Download className="size-4 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Your relationship manager</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{rm?.name ?? settings.companyName}</p>
          <p className="text-sm text-slate-500">Questions about payments, documents or possession? We are happy to help.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {rmPhone && (
              <>
                <a href={`tel:${rmPhone}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Phone className="size-4" /> Call
                </a>
                <a
                  href={waLink(rmPhone, `Hi, this is ${lead.name}. I have a question about my booking.`, settings.defaultCountryCode)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              </>
            )}
            {(rm?.email || settings.companyEmail) && (
              <a href={`mailto:${rm?.email || settings.companyEmail}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Mail className="size-4" /> Email
              </a>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-2 py-3">
      <p className={cn("text-sm font-semibold text-slate-900 sm:text-base", tone)}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
