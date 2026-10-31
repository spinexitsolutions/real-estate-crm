import { getPortalAccess } from "@/lib/portal-access";
import { loadInstallmentForReceipt, pdfResponse, renderReceiptPdf } from "@/lib/receipt-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ token: string; installmentId: string }> }) {
  const { token, installmentId } = await params;
  const portal = await getPortalAccess(token);
  if (!portal) return new Response("This link is no longer valid", { status: 404 });
  if (!portal.unlocked) return new Response("Enter your PIN on the portal first", { status: 403 });
  const i = await loadInstallmentForReceipt(installmentId);
  if (!i || i.booking.leadId !== portal.access.leadId || i.booking.status === "CANCELLED") return new Response("Not found", { status: 404 });
  const pdf = await renderReceiptPdf(installmentId);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}
