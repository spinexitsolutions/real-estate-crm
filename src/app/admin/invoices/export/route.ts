import { getSuperAdmin } from "@/lib/admin";
import { loadInvoices } from "@/lib/admin-invoices";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  if (!(await getSuperAdmin())) return new Response("Not found", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const rows = await loadInvoices(sp);
  const csv = toCsv(
    ["Invoice", "Date", "Company", "Slug", "Description", "Period start", "Period end", "Status", "Amount", "Currency", "Razorpay payment id"],
    rows.map((i) => [
      i.number,
      i.createdAt.toISOString().slice(0, 10),
      i.organization.name,
      i.organization.slug,
      i.description,
      i.periodStart?.toISOString().slice(0, 10) ?? "",
      i.periodEnd?.toISOString().slice(0, 10) ?? "",
      i.status,
      i.amount,
      i.currency,
      i.razorpayPaymentId,
    ]),
  );
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
