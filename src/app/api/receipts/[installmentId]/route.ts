import { getCurrentUser } from "@/lib/auth";
import { loadInstallmentForReceipt, pdfResponse, renderReceiptPdf } from "@/lib/receipt-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ installmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { installmentId } = await params;
  const i = await loadInstallmentForReceipt(installmentId);
  if (!i || (user.role === "AGENT" && i.booking.lead.assignedToId !== user.id)) return new Response("Not found", { status: 404 });
  const pdf = await renderReceiptPdf(installmentId);
  if (!pdf) return new Response("No payment recorded for this installment yet", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}
