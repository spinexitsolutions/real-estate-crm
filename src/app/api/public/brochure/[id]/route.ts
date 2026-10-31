import { rawDb, runAsTenant } from "@/lib/db";
import { getBrochureData, pdfResponse, renderBrochure } from "@/lib/brochure";
import { originFrom, verifyBrochureSig } from "@/lib/brochure-link";

export const runtime = "nodejs";

/**
 * Public brochure link (no login) used when sharing on WhatsApp.
 * Allowed when the property is published on the website, or when the link carries a valid signature.
 */
async function GETInOrg(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const data = await getBrochureData(id);
  if (!data) return new Response("Brochure not found", { status: 404 });
  const allowed = (data.property.published && data.property.status !== "OFF_MARKET") || verifyBrochureSig(id, url.searchParams.get("sig"));
  if (!allowed) return new Response("Brochure not found", { status: 404 });
  try {
    const { buffer, filename } = await renderBrochure(data, originFrom(req.headers));
    return pdfResponse(buffer, filename, url.searchParams.get("download") === "1");
  } catch (e) {
    console.error("Public brochure render failed", e);
    return new Response("Could not generate the brochure. Please try again.", { status: 500 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await rawDb.property.findUnique({ where: { id }, select: { organizationId: true } });
  if (!owner) return new Response("Brochure not found", { status: 404 });
  return runAsTenant(owner.organizationId, () => GETInOrg(req, ctx));
}
