import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { documentScope } from "@/lib/doc-access";
import { DocumentsClient, type DocItem } from "./documents-client";

/**
 * Documents for a lead / deal / booking / property: KYC checklist, upload, preview, share with customer.
 * Server component - drop it into any page.
 */
export async function DocumentsPanel({
  leadId,
  dealId,
  bookingId,
  propertyId,
  title = "Documents",
  canShareWithCustomer = true,
  showKycChecklist,
}: {
  leadId?: string;
  dealId?: string;
  bookingId?: string;
  propertyId?: string;
  title?: string;
  canShareWithCustomer?: boolean;
  showKycChecklist?: boolean;
}) {
  const user = await requireUser();
  const or: Prisma.DocumentWhereInput[] = [];
  if (leadId) or.push({ leadId });
  if (dealId) or.push({ dealId });
  if (bookingId) or.push({ bookingId });
  if (propertyId) or.push({ propertyId });
  if (!or.length) return null;

  const docs = await db.document.findMany({
    where: { AND: [{ OR: or }, documentScope(user)] },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  const items: DocItem[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    mimeType: d.mimeType,
    size: d.size,
    visibleToCustomer: d.visibleToCustomer,
    createdAt: d.createdAt.toISOString(),
    uploadedBy: d.uploadedBy?.name ?? null,
    canDelete: user.role !== "AGENT" || d.uploadedById === user.id,
  }));

  return (
    <DocumentsClient
      title={title}
      items={items}
      links={{ leadId, dealId, bookingId, propertyId }}
      canShareWithCustomer={canShareWithCustomer && !!(leadId || dealId || bookingId)}
      showKycChecklist={showKycChecklist ?? !!(leadId || bookingId)}
    />
  );
}
