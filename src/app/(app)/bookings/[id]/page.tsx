import Link from "next/link";
import { PaymentHistory } from "@/components/bookings/payment-history";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, CircleAlert, FileText, ReceiptText, UserRound, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BOOKING_STATUSES, PAYMENT_METHODS, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { summarizeInstallments } from "@/lib/payment-plan";
import { cn, parseImages } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { DonutChart } from "@/components/charts";
import { BookingActions } from "@/components/bookings/booking-actions";
import { InstallmentTable } from "@/components/bookings/installment-table";
import { PortalAccessCard } from "@/components/portal/portal-access-card";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.booking.findUnique({ where: { id }, select: { bookingNo: true } });
  return { title: b?.bookingNo ?? "Booking" };
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const settings = await getSettings();
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      lead: { include: { assignedTo: { select: { name: true, phone: true } }, portalAccess: true } },
      property: true,
      deal: { select: { id: true, title: true } },
      createdBy: { select: { name: true } },
      installments: {
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
        include: { payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }], select: { id: true, receiptNo: true, amount: true, paidAt: true, method: true, reference: true, status: true } } },
      },
      payments: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: { installment: { select: { label: true } }, recordedBy: { select: { name: true } } },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!b) notFound();
  if (user.role === "AGENT" && b.lead.assignedToId !== user.id) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = process.env.APP_URL || `${proto}://${host}`;

  const now = new Date();
  const s = summarizeInstallments(b.installments, now);
  const activeReceipts = b.payments.filter((p) => p.status === "ACTIVE").length;
  const access = b.lead.portalAccess;
  const portalUrl = access && !access.revokedAt ? `${origin.replace(/\/$/, "")}/portal/${access.token}` : null;
  const img = b.property ? parseImages(b.property.images)[0] : undefined;
  const cancelled = b.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" /> All bookings
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-brand-600 shadow-card">
              <ReceiptText className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{b.bookingNo}</h1>
                <OptionBadge list={BOOKING_STATUSES} value={b.status} withDot />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                <Link href={`/leads/${b.lead.id}`} className="font-medium text-slate-700 hover:text-brand-700">
                  {b.lead.name}
                </Link>
                {b.property && (
                  <>
                    {" "}
                    -{" "}
                    <Link href={`/properties/${b.property.id}`} className="hover:text-brand-700">
                      {b.property.title}
                    </Link>
                  </>
                )}
                {b.unitNumber ? ` - Unit ${b.unitNumber}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BookingActions
              booking={{
                id: b.id,
                bookingNo: b.bookingNo,
                status: b.status,
                unitNumber: b.unitNumber,
                bookingDate: b.bookingDate.toISOString(),
                agreementDate: b.agreementDate?.toISOString() ?? null,
                totalAmount: b.totalAmount,
                notes: b.notes,
              }}
              canManage={isManager(user)}
              isAdmin={user.role === "ADMIN"}
            />
          </div>
        </div>
      </div>

      {cancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <CircleAlert className="size-4" /> This booking is cancelled. Payments recorded earlier remain on record.
        </div>
      )}
      {Math.abs(s.total - b.totalAmount) > 1 && !cancelled && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <CircleAlert className="size-4" /> The schedule adds up to {formatCurrency(s.total)} but the agreement value is {formatCurrency(b.totalAmount)}. Adjust the installments.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Agreement value" value={formatCurrency(b.totalAmount)} />
        <Stat label="Received" value={formatCurrency(s.paid)} tone="text-emerald-700" sub={`${s.progress}% collected`} />
        <Stat label="Outstanding" value={formatCurrency(s.outstanding)} sub={s.nextDue ? `Next: ${formatDate(s.nextDue.dueDate)}` : "Nothing due"} />
        <Stat label="Overdue" value={formatCurrency(s.overdue)} tone={s.overdue ? "text-rose-600" : undefined} sub={s.overdueCount ? `${s.overdueCount} installment(s)` : "On track"} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-3">
        <div className="min-w-0 space-y-6 2xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader title="Payment schedule" description={`${b.installments.length} installments`} />
            <InstallmentTable
              rows={b.installments.map((i) => ({
                id: i.id,
                label: i.label,
                dueDate: i.dueDate.toISOString(),
                amount: i.amount,
                paidAmount: i.paidAmount,
                status: i.status,
                paidAt: i.paidAt?.toISOString() ?? null,
                receipts: i.payments
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => ({ id: p.id, receiptNo: p.receiptNo, amount: p.amount, paidAt: p.paidAt.toISOString(), method: p.method, reference: p.reference })),
                hasReceipts: i.payments.length > 0,
                reminderSentAt: i.reminderSentAt?.toISOString() ?? null,
              }))}
              ctx={{
                bookingId: b.id,
                bookingNo: b.bookingNo,
                cancelled,
                canManage: isManager(user),
                customer: { name: b.lead.name, phone: b.lead.phone },
                propertyTitle: b.property?.title ?? null,
                company: settings.companyName,
                countryCode: settings.defaultCountryCode,
                portalUrl,
              }}
            />
          </Card>

          <Card>
            <CardHeader
              title="Payment history"
              description={`${activeReceipts} receipt${activeReceipts === 1 ? "" : "s"} issued${b.payments.length > activeReceipts ? `, ${b.payments.length - activeReceipts} cancelled` : ""}`}
            />
            <PaymentHistory
              canManage={isManager(user)}
              payments={b.payments.map((p) => ({
                id: p.id,
                receiptNo: p.receiptNo,
                amount: p.amount,
                paidAt: p.paidAt.toISOString(),
                method: p.method,
                reference: p.reference,
                installmentLabel: p.installment.label,
                status: p.status,
                cancelReason: p.cancelReason,
                cancelledAt: p.cancelledAt?.toISOString() ?? null,
                recordedBy: p.recordedBy?.name ?? null,
              }))}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Collection" />
            <div className="p-5">
              <DonutChart
                data={[
                  { label: "Received", value: s.paid },
                  { label: "Outstanding (not due)", value: Math.max(0, s.outstanding - s.overdue) },
                  { label: "Overdue", value: s.overdue },
                ]}
                colors={["#10b981", "#cbd5e1", "#f43f5e"]}
                currency
                centerLabel="Total"
                height={160}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Booking details" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row icon={UserRound} label="Customer">
                <Link href={`/leads/${b.lead.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                  {b.lead.name}
                </Link>
                <span className="block text-xs text-slate-500">{b.lead.phone}</span>
              </Row>
              <Row icon={Building2} label="Property">
                {b.property ? (
                  <Link href={`/properties/${b.property.id}`} className="flex items-center gap-2 hover:text-brand-700">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-9 rounded-md object-cover" />
                    )}
                    <span className="font-medium text-slate-800">
                      {b.property.title}
                      <span className="block text-xs font-normal text-slate-500">
                        {b.property.code}
                        {b.unitNumber ? ` - Unit ${b.unitNumber}` : ""}
                      </span>
                    </span>
                  </Link>
                ) : (
                  "-"
                )}
              </Row>
              <Row icon={CalendarDays} label="Booked on">
                {formatDate(b.bookingDate)}
                {b.agreementDate && <span className="block text-xs text-slate-500">Agreement {formatDate(b.agreementDate)}</span>}
              </Row>
              <Row icon={UserRound} label="Agent">
                <span className="flex items-center gap-2">
                  <Avatar name={b.lead.assignedTo?.name ?? "?"} size="xs" />
                  {b.lead.assignedTo?.name ?? "Unassigned"}
                </span>
              </Row>
              {b.deal && (
                <Row icon={ReceiptText} label="Deal">
                  <Link href={`/deals?open=${b.deal.id}`} className="font-medium text-brand-700 hover:underline">
                    {b.deal.title}
                  </Link>
                </Row>
              )}
            </dl>
            {b.notes && <p className="whitespace-pre-line border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{b.notes}</p>}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Created by {b.createdBy?.name ?? "System"} on {formatDateTime(b.createdAt)}
            </p>
          </Card>

          <PortalAccessCard
            leadId={b.lead.id}
            leadName={b.lead.name}
            leadPhone={b.lead.phone}
            origin={origin}
            companyName={settings.companyName}
            access={access ? { token: access.token, hasPin: !!access.pin, lastViewedAt: access.lastViewedAt?.toISOString() ?? null, revokedAt: access.revokedAt?.toISOString() ?? null } : null}
          />

        </div>
      </div>

      <DocumentsPanel bookingId={b.id} leadId={b.leadId} title="Booking documents" />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-xl font-semibold tracking-tight text-slate-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children}</dd>
    </div>
  );
}

