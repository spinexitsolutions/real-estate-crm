import Link from "next/link";
import { Building2, Download } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin, ORG_STATUSES, BUSINESS_TYPES } from "@/lib/admin";
import { loadCompanies, type CompanyFilters } from "@/lib/admin-companies";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { OptionBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button-styles";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";

export const metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<CompanyFilters & { page?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, plans] = await Promise.all([loadCompanies(sp), rawDb.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const now = new Date();
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Companies"
        description={`${rows.length} ${rows.length === 1 ? "company" : "companies"}`}
        actions={
          <a href={`/admin/companies/export${qs ? `?${qs}` : ""}`} className={buttonClass("secondary")}>
            <Download /> Export CSV
          </a>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 lg:flex-row lg:items-center">
          <SearchInput placeholder="Search company, slug, owner email or phone..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="status" options={ORG_STATUSES} placeholder="All statuses" />
            <FilterSelect param="plan" options={[{ value: "none", label: "No plan" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]} placeholder="All plans" />
            <FilterSelect param="type" options={BUSINESS_TYPES} placeholder="All business types" />
            <FilterSelect
              param="sort"
              options={[
                { value: "mrr", label: "Highest MRR" },
                { value: "active", label: "Recently active" },
                { value: "oldest", label: "Oldest first" },
                { value: "name", label: "Name A-Z" },
              ]}
              placeholder="Newest first"
            />
            <ClearFilters keys={["q", "status", "plan", "type", "sort"]} />
          </div>
        </div>
        {pageRows.length === 0 ? (
          <EmptyState icon={Building2} title="No companies found" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="table-th">Company</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th">Plan</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Trial ends / renews</th>
                  <th className="table-th text-right">Users</th>
                  <th className="table-th text-right">Leads</th>
                  <th className="table-th text-right">MRR</th>
                  <th className="table-th">Last activity</th>
                  <th className="table-th">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {pageRows.map((o) => {
                  const due = o.status === "TRIAL" ? o.trialEndsAt : o.currentPeriodEnd;
                  const late = due && due < now && ["TRIAL", "PAST_DUE"].includes(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50/70">
                      <td className="table-td">
                        <Link href={`/admin/companies/${o.id}`} className="font-medium text-zinc-900 hover:underline">
                          {o.name}
                        </Link>
                        <p className="text-xs text-zinc-500">/{o.slug}{o.city ? ` - ${o.city}` : ""}</p>
                      </td>
                      <td className="table-td">
                        <p className="text-zinc-800">{o.ownerName ?? "-"}</p>
                        <p className="text-xs text-zinc-500">{[o.ownerEmail, o.ownerPhone].filter(Boolean).join(" - ")}</p>
                      </td>
                      <td className="table-td">
                        {o.plan?.name ?? <span className="text-zinc-400">None</span>}
                        <p className="text-xs text-zinc-500">{o.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}</p>
                      </td>
                      <td className="table-td">
                        <OptionBadge list={ORG_STATUSES} value={o.status} withDot />
                      </td>
                      <td className={cn("table-td", late && "font-medium text-rose-600")}>
                        {due ? formatDate(due) : "-"}
                        {o.status === "TRIAL" && due && <p className="text-xs font-normal text-zinc-500">{formatRelative(due)}</p>}
                      </td>
                      <td className="table-td text-right">{o._count.users}</td>
                      <td className="table-td text-right">{o._count.leads}</td>
                      <td className="table-td text-right font-medium text-zinc-900">{o.mrr ? formatCurrency(Math.round(o.mrr)) : "-"}</td>
                      <td className="table-td text-zinc-600">{o.lastActivity ? formatRelative(o.lastActivity) : "Never"}</td>
                      <td className="table-td text-zinc-600">{formatDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} basePath="/admin/companies" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
