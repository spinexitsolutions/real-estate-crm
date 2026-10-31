import Link from "next/link";
import { format, subMonths } from "date-fns";
import { CreditCard, Download } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { invoiceWhere, loadInvoices, type InvoiceFilters } from "@/lib/admin-invoices";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button-styles";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const STATUS = [
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];
const TONE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  REFUNDED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<InvoiceFilters & { page?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = invoiceWhere(sp);
  const [rows, total, sums] = await Promise.all([
    loadInvoices(sp, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    rawDb.invoice.count({ where }),
    rawDb.invoice.groupBy({ by: ["status"], where, _sum: { amount: true }, _count: true }),
  ]);
  const sum = (s: string) => sums.find((x) => x.status === s)?._sum.amount ?? 0;
  const months = Array.from({ length: 18 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <>
      <PageHeader
        icon={CreditCard}
        title="Invoices"
        description="Subscription payments from all companies"
        actions={
          <a href={`/admin/invoices/export${qs ? `?${qs}` : ""}`} className={buttonClass("secondary")}>
            <Download /> Export CSV
          </a>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={formatCurrency(sum("PAID"))} icon={CreditCard} tone="emerald" sub={<span>{sums.find((x) => x.status === "PAID")?._count ?? 0} paid invoices</span>} />
        <StatCard label="Failed" value={formatCurrency(sum("FAILED"))} icon={CreditCard} tone="rose" sub={<span>{sums.find((x) => x.status === "FAILED")?._count ?? 0} failed</span>} />
        <StatCard label="Refunded" value={formatCurrency(sum("REFUNDED"))} icon={CreditCard} tone="amber" sub={<span>{sums.find((x) => x.status === "REFUNDED")?._count ?? 0} refunded</span>} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 lg:flex-row lg:items-center">
          <SearchInput placeholder="Invoice no., company, payment id..." className="w-full lg:max-w-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect param="month" options={months} placeholder="All months" />
            <FilterSelect param="status" options={STATUS} placeholder="All statuses" />
            <ClearFilters keys={["q", "month", "status"]} />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No invoices" description="Payments appear here when companies subscribe or you record an offline payment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50/80">
                <tr>
                  <th className="table-th">Invoice</th>
                  <th className="table-th">Company</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Period</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="table-td">
                      <p className="font-medium text-zinc-900">{i.number}</p>
                      <p className="text-xs text-zinc-500">{formatDate(i.createdAt)}{i.razorpayPaymentId ? ` - ${i.razorpayPaymentId}` : ""}</p>
                    </td>
                    <td className="table-td">
                      <Link href={`/admin/companies/${i.organization.id}`} className="text-zinc-800 hover:underline">
                        {i.organization.name}
                      </Link>
                    </td>
                    <td className="table-td max-w-xs truncate text-zinc-600">{i.description ?? "-"}</td>
                    <td className="table-td text-zinc-600">{i.periodStart || i.periodEnd ? `${formatDate(i.periodStart)} - ${formatDate(i.periodEnd)}` : "-"}</td>
                    <td className="table-td">
                      <Badge className={TONE[i.status]}>{STATUS.find((s) => s.value === i.status)?.label ?? i.status}</Badge>
                    </td>
                    <td className="table-td text-right font-medium text-zinc-900">{formatCurrency(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/invoices" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
