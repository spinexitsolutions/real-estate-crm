import { withPortal } from "@/lib/portal-access";
import { getPortalAccess } from "@/lib/portal-access";
import { loadPaymentForReceipt, pdfResponse, renderReceiptPdf } from "@/lib/receipt-pdf";

async function GETInPortal(req: Request, { params }: { params: Promise<{ token: string; paymentId: string }> }) {
  const { token, paymentId } = await params;
  const portal = await getPortalAccess(token);
  if (!portal) return new Response("This link is no longer valid", { status: 404 });
  if (!portal.unlocked) return new Response("Enter your PIN on the portal first", { status: 403 });
  const p = await loadPaymentForReceipt(paymentId);
  // Customers only see their own, active receipts on non-cancelled bookings
  if (!p || p.booking.leadId !== portal.access.leadId || p.booking.status === "CANCELLED" || p.status !== "ACTIVE") {
    return new Response("Not found", { status: 404 });
  }
  const pdf = await renderReceiptPdf(paymentId);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string; paymentId: string }> }) {
  const { token } = await ctx.params;
  return withPortal(token, () => GETInPortal(req, ctx), () => new Response("This link is no longer valid", { status: 404 }));
}
