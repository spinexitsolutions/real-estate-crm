import { getCurrentUser } from "@/lib/auth";
import { db, rawDb } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

/** GST tax invoice PDF for a subscription payment (admins and managers of the same company). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id } }); // tenant-scoped: other companies' invoices are not found
  if (!inv) return new Response("Not found", { status: 404 });
  const [org, settings] = await Promise.all([rawDb.organization.findUniqueOrThrow({ where: { id: user.organizationId } }), getSettings()]);
  const pdf = await renderInvoicePdf({
    number: inv.number,
    date: inv.createdAt,
    amount: inv.amount,
    status: inv.status,
    description: inv.description,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    paymentRef: inv.razorpayPaymentId,
    buyer: {
      name: settings.companyName || org.name,
      email: settings.companyEmail ?? org.ownerEmail,
      phone: settings.companyPhone ?? org.ownerPhone,
      address: settings.companyAddress,
      state: null,
      gstin: null,
    },
  });
  const inline = new URL(req.url).searchParams.get("download") !== "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
