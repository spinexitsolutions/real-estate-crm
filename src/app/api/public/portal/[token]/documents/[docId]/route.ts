import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { documentResponse } from "@/lib/doc-storage";
import { isPortalUnlocked } from "@/lib/portal-session";

export const runtime = "nodejs";

/** Customer portal document access: only documents explicitly shared with the customer. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  if (!token || token.length < 20) return new Response("Not found", { status: 404 });
  const access = await db.portalAccess.findUnique({ where: { token } });
  if (!access || access.revokedAt) return new Response("This link is no longer active", { status: 404 });
  if (access.pin && !isPortalUnlocked(token, await cookies())) return new Response("Please unlock the portal with your PIN", { status: 403 });

  const doc = await db.document.findUnique({ where: { id: docId } });
  if (!doc || !doc.visibleToCustomer) return new Response("Not found", { status: 404 });
  let owned = doc.leadId === access.leadId;
  if (!owned && doc.bookingId) {
    const booking = await db.booking.findUnique({ where: { id: doc.bookingId }, select: { leadId: true } });
    owned = booking?.leadId === access.leadId;
  }
  if (!owned) return new Response("Not found", { status: 404 });

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  try {
    return await documentResponse(doc, inline);
  } catch (e) {
    console.error("Portal document download failed", e);
    return new Response("Could not open the document", { status: 500 });
  }
}
