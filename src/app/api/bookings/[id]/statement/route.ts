import { getCurrentUser } from "@/lib/auth";
import { loadBookingForStatement, pdfResponse, renderStatementPdf } from "@/lib/receipt-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const b = await loadBookingForStatement(id);
  if (!b || (user.role === "AGENT" && b.lead.assignedToId !== user.id)) return new Response("Not found", { status: 404 });
  const pdf = await renderStatementPdf(id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, pdf.filename, new URL(req.url).searchParams.get("download") !== "1");
}
