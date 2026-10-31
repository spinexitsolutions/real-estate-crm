import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { DOC_MAX_BYTES, sniffDocumentType } from "@/lib/doc-sniff";
import { uploadDocument } from "@/lib/doc-storage";
import { resolveDocLinks } from "@/lib/doc-access";
import { DOCUMENT_CATEGORIES, labelOf } from "@/lib/constants";

export const runtime = "nodejs";

function field(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > DOC_MAX_BYTES) return NextResponse.json({ error: "File is larger than 15 MB." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffDocumentType(bytes);
  if (!mime) return NextResponse.json({ error: "Only PDF, JPG, PNG or WebP files are allowed." }, { status: 415 });

  const links = await resolveDocLinks(user, {
    leadId: field(fd, "leadId") || null,
    dealId: field(fd, "dealId") || null,
    bookingId: field(fd, "bookingId") || null,
    propertyId: field(fd, "propertyId") || null,
  });
  if (!links.ok) return NextResponse.json({ error: links.error }, { status: 403 });

  const rawCategory = field(fd, "category");
  const category = DOCUMENT_CATEGORIES.some((c) => c.value === rawCategory) ? rawCategory : "OTHER";
  const name = (field(fd, "name") || file.name || "Document").slice(0, 160);
  const visibleToCustomer = ["1", "true", "on"].includes(field(fd, "visibleToCustomer"));

  const up = await uploadDocument(bytes, mime, links.leadId ? `leads/${links.leadId}` : `properties/${links.propertyId}`);
  if ("error" in up) return NextResponse.json({ error: up.error }, { status: 500 });

  const doc = await db.document.create({
    data: {
      name,
      category,
      storagePath: up.storagePath,
      mimeType: mime,
      size: bytes.length,
      visibleToCustomer,
      leadId: links.leadId,
      dealId: links.dealId,
      bookingId: links.bookingId,
      propertyId: links.propertyId,
      uploadedById: user.id,
    },
  });
  if (links.leadId) {
    await logActivity({ type: "DOCUMENT", content: `Uploaded document: ${name} (${labelOf(DOCUMENT_CATEGORIES, category)})${visibleToCustomer ? ", shared with customer" : ""}`, leadId: links.leadId, userId: user.id });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, id: doc.id });
}
