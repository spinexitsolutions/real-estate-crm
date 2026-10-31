import "server-only";
import type { Prisma } from "@prisma/client";
import { rawDb } from "./db";

export type InvoiceFilters = { month?: string; status?: string; q?: string };

export function invoiceWhere(f: InvoiceFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.month && /^\d{4}-\d{2}$/.test(f.month)) {
    const [y, m] = f.month.split("-").map(Number);
    where.createdAt = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (f.q) {
    where.OR = [
      { number: { contains: f.q, mode: "insensitive" } },
      { organization: { name: { contains: f.q, mode: "insensitive" } } },
      { razorpayPaymentId: { contains: f.q } },
    ];
  }
  return where;
}

export async function loadInvoices(f: InvoiceFilters, take?: number, skip?: number) {
  return rawDb.invoice.findMany({
    where: invoiceWhere(f),
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
}
