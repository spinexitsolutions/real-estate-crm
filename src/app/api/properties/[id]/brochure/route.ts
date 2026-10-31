import { getCurrentUser } from "@/lib/auth";
import { getBrochureData, pdfResponse, renderBrochure } from "@/lib/brochure";
import { originFrom } from "@/lib/brochure-link";

export const runtime = "nodejs";

/** Brochure PDF for signed-in team members. Add ?download=1 to download instead of viewing. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const data = await getBrochureData(id);
  if (!data) return new Response("Property not found", { status: 404 });
  try {
    const { buffer, filename } = await renderBrochure(data, originFrom(req.headers));
    return pdfResponse(buffer, filename, new URL(req.url).searchParams.get("download") === "1");
  } catch (e) {
    console.error("Brochure render failed", e);
    return new Response("Could not generate the brochure. Please try again.", { status: 500 });
  }
}
