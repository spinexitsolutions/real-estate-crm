import { getCurrentUser } from "@/lib/auth";
import { loadPaymentForReceipt, pdfResponse, renderReceiptPdf } from "@/lib/receipt-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { paymentId } = await params;
  const p = await loadPaymentForReceipt(paymentId);
  if (!p || (user.role === "AGENT" && p.booking.lead.assignedToId !== user.id)) return new Response("Not found", { status: 404 });
  const pdf = await renderReceiptPdf(paymentId);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}
