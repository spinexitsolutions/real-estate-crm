import Link from "next/link";
import { ScrollText } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin, AUDIT_LABELS } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { FilterSelect, Pagination } from "@/components/ui/filters";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.action ? { action: sp.action } : {};
  const [rows, total] = await Promise.all([
    rawDb.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    rawDb.adminAuditLog.count({ where }),
  ]);
  const orgIds = [...new Set(rows.map((r) => r.organizationId).filter(Boolean))] as string[];
  const orgs = orgIds.length ? await rawDb.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <>
      <PageHeader icon={ScrollText} title="Audit log" description="Every change made by platform admins, including support logins" />
      <Card className="overflow-hidden">
        <div className="border-b border-zinc-100 p-4">
          <FilterSelect param="action" options={Object.entries(AUDIT_LABELS).map(([value, label]) => ({ value, label }))} placeholder="All actions" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="table-th">When</th>
                  <th className="table-th">Action</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">By</th>
                  <th className="table-th">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {rows.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="table-td text-zinc-600">{formatDateTime(a.createdAt)}</td>
                    <td className="table-td font-medium text-zinc-900">{AUDIT_LABELS[a.action] ?? a.action}</td>
                    <td className="table-td">
                      {a.organizationId ? (
                        orgName.has(a.organizationId) ? (
                          <Link href={`/admin/companies/${a.organizationId}`} className="hover:underline">
                            {orgName.get(a.organizationId)}
                          </Link>
                        ) : (
                          <span className="text-zinc-400">Deleted company</span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-td text-zinc-600">
                      {a.actorEmail}
                      {a.ip && <p className="text-xs text-zinc-400">{a.ip}</p>}
                    </td>
                    <td className="table-td max-w-md whitespace-normal break-all font-mono text-[11px] text-zinc-500">{a.details ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/audit" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
