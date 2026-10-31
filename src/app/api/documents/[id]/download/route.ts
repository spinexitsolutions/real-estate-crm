import { getCurrentUser } from "@/lib/auth";
import { getDocumentForUser } from "@/lib/doc-access";
import { documentResponse } from "@/lib/doc-storage";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await getDocumentForUser(user, id);
  if (!doc) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  try {
    return await documentResponse(doc, inline);
  } catch (e) {
    console.error("Document download failed", e);
    return new Response("Could not open the document", { status: 500 });
  }
}
