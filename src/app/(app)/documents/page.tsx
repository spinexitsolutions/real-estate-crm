import type { Prisma } from "@prisma/client";
import { FolderOpen, FileText, Share2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { documentScope } from "@/lib/doc-access";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { Card, PageHeader, StatCard } from "@/components/ui/card";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { DocumentsLibrary, type LibraryItem } from "@/components/documents/documents-library";

export const metadata = { title: "Documents" };

type SP = { q?: string; category?: string; leadId?: string; bookingId?: string; shared?: string; page?: string };
const PAGE_SIZE = 30;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const scope = documentScope(user);

  const and: Prisma.DocumentWhereInput[] = [scope];
  if (sp.category) and.push({ category: sp.category });
  if (sp.leadId) and.push({ leadId: sp.leadId });
  if (sp.bookingId) and.push({ bookingId: sp.bookingId });
  if (sp.shared === "yes") and.push({ visibleToCustomer: true });
  if (sp.shared === "no") and.push({ visibleToCustomer: false });
  if (sp.q)
    and.push({
      OR: [
        { name: { contains: sp.q, mode: "insensitive" } },
        { lead: { name: { contains: sp.q, mode: "insensitive" } } },
        { lead: { phone: { contains: sp.q } } },
        { property: { title: { contains: sp.q, mode: "insensitive" } } },
        { booking: { bookingNo: { contains: sp.q, mode: "insensitive" } } },
      ],
    });
  const where: Prisma.DocumentWhereInput = { AND: and };

  const [total, docs, totalAll, sharedCount, kycCount] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        uploadedBy: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true } },
        booking: { select: { id: true, bookingNo: true } },
        property: { select: { id: true, title: true, code: true } },
      },
    }),
    db.document.count({ where: scope }),
    db.document.count({ where: { AND: [scope, { visibleToCustomer: true }] } }),
    db.document.count({ where: { AND: [scope, { category: { startsWith: "KYC" } }] } }),
  ]);

  const items: LibraryItem[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    mimeType: d.mimeType,
    size: d.size,
    visibleToCustomer: d.visibleToCustomer,
    createdAt: d.createdAt.toISOString(),
    uploadedBy: d.uploadedBy?.name ?? null,
    canDelete: user.role !== "AGENT" || d.uploadedById === user.id,
    shareable: !!d.leadId,
    context: d.lead
      ? { href: `/leads/${d.lead.id}`, label: d.lead.name, sub: d.booking ? `Booking ${d.booking.bookingNo}` : d.lead.phone }
      : d.property
        ? { href: `/properties/${d.property.id}`, label: d.property.title, sub: d.property.code }
        : null,
  }));

  return (
    <>
      <PageHeader icon={FolderOpen} title="Documents" description="KYC, agreements, sale deeds and receipts for all your clients, stored privately." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total documents" value={totalAll} icon={FileText} tone="brand" />
        <StatCard label="KYC documents" value={kycCount} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Shared with customers" value={sharedCount} icon={Share2} tone="sky" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput placeholder="Search document, client, booking no..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="category" options={DOCUMENT_CATEGORIES} placeholder="All categories" />
            <FilterSelect
              param="shared"
              options={[
                { value: "yes", label: "Shared with customer" },
                { value: "no", label: "Internal only" },
              ]}
              placeholder="Any visibility"
            />
            <ClearFilters keys={["q", "category", "shared", "leadId", "bookingId"]} />
          </div>
        </div>
        <DocumentsLibrary items={items} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/documents" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
