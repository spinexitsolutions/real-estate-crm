import { getPortalAccess } from "@/lib/portal-access";
import { loadBookingForStatement, pdfResponse, renderStatementPdf } from "@/lib/receipt-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ token: string; bookingId: string }> }) {
  const { token, bookingId } = await params;
  const portal = await getPortalAccess(token);
  if (!portal) return new Response("This link is no longer valid", { status: 404 });
  if (!portal.unlocked) return new Response("Enter your PIN on the portal first", { status: 403 });
  const b = await loadBookingForStatement(bookingId);
  if (!b || b.leadId !== portal.access.leadId || b.status === "CANCELLED") return new Response("Not found", { status: 404 });
  const pdf = await renderStatementPdf(bookingId);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}
