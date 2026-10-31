import Link from "next/link";
import { requireFeature } from "@/lib/plans";
import { UpgradeRequired } from "@/components/billing/upgrade-required";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { inAppTz } from "@/lib/timezone";
import { PageHeader } from "@/components/ui/card";
import { BookingForm } from "@/components/bookings/booking-form";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ dealId?: string; leadId?: string; propertyId?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const lock = await requireFeature("bookings");
  if (lock) return <UpgradeRequired {...lock} />;
  const agent = user.role === "AGENT";

  const deal = sp.dealId ? await db.deal.findUnique({ where: { id: sp.dealId }, include: { lead: true, booking: { select: { id: true } } } }) : null;
  const scopedDeal = deal && (!agent || deal.lead.assignedToId === user.id) ? deal : null;
  const leadId = scopedDeal?.leadId ?? sp.leadId;
  const shortlist = leadId ? await db.leadProperty.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" }, select: { propertyId: true } }) : null;

  const [leads, properties] = await Promise.all([
    db.lead.findMany({
      where: { ...(agent ? { assignedToId: user.id } : {}), OR: [{ status: { not: "LOST" } }, ...(leadId ? [{ id: leadId }] : [])] },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
    db.property.findMany({
      where: { OR: [{ status: { in: ["AVAILABLE", "RESERVED"] } }, ...(scopedDeal?.propertyId ? [{ id: scopedDeal.propertyId }] : [])] },
      select: { id: true, title: true, code: true, price: true, status: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <>
      <Link href={scopedDeal ? "/deals" : "/bookings"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <PageHeader icon={ReceiptText} title="New booking" description="Record the booking and set up the customer's payment schedule." />
      {scopedDeal?.booking ? (
        <div className="card p-6 text-sm text-slate-600">
          This deal already has a booking.{" "}
          <Link href={`/bookings/${scopedDeal.booking.id}`} className="font-medium text-brand-600 hover:underline">
            Open booking
          </Link>
        </div>
      ) : (
        <BookingForm
          leads={leads}
          properties={properties}
          defaults={{
            leadId,
            dealId: scopedDeal?.id,
            dealTitle: scopedDeal?.title,
            propertyId: scopedDeal?.propertyId ?? sp.propertyId ?? shortlist?.propertyId ?? undefined,
            totalAmount: scopedDeal?.value,
            bookingDate: format(inAppTz(new Date()), "yyyy-MM-dd"),
          }}
        />
      )}
    </>
  );
}
