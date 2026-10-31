/**
 * Payment plan helpers (pure, safe on server and client).
 * Amounts are whole rupees; the last row absorbs rounding so the plan always adds up to the total.
 */
import { addDays, addMonths, startOfDay } from "date-fns";

export type PlanPreset = "CONSTRUCTION_LINKED" | "DOWN_PAYMENT" | "EQUAL_MONTHLY" | "CUSTOM";

export const PLAN_PRESETS: { value: PlanPreset; label: string; description: string }[] = [
  { value: "CONSTRUCTION_LINKED", label: "Construction linked", description: "Token, booking, agreement and slab-wise payments up to possession" },
  { value: "DOWN_PAYMENT", label: "Down payment 20 / 80", description: "20% upfront, 80% on possession or loan disbursement" },
  { value: "EQUAL_MONTHLY", label: "Equal monthly installments", description: "Token followed by equal monthly payments" },
  { value: "CUSTOM", label: "Custom", description: "Build your own schedule" },
];

export type PlanRow = { label: string; dueDate: Date; amount: number; percent: number | null };

export type PlanOptions = { tokenAmount?: number; months?: number; possessionMonths?: number };

const round = (n: number) => Math.round(n);

/** Fix rounding so the rows add up to total exactly (difference goes to the last row). */
function balance(rows: PlanRow[], total: number) {
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length) rows[rows.length - 1].amount += round(total) - sum;
  return rows;
}

export function buildPlan(preset: PlanPreset, total: number, startDate: Date, options: PlanOptions = {}): PlanRow[] {
  const t = round(Math.max(0, total));
  const start = startOfDay(startDate);
  if (!t) return [];
  const token = Math.min(round(options.tokenAmount ?? Math.min(100000, t * 0.05)), t);

  if (preset === "CONSTRUCTION_LINKED") {
    const stages: [string, number, number][] = [
      // label, percent of total, days after booking
      ["Booking amount (10% less token)", 10, 15],
      ["On agreement", 10, 30],
      ["On plinth completion", 15, 90],
      ["On 1st slab", 10, 150],
      ["On 3rd slab", 10, 210],
      ["On 6th slab", 10, 270],
      ["On top slab", 10, 330],
      ["On brickwork and plaster", 10, 420],
      ["On flooring and finishing", 10, 510],
      ["On possession", 5, 600],
    ];
    const rows: PlanRow[] = [{ label: "Token amount", dueDate: start, amount: token, percent: null }];
    for (const [label, pct, days] of stages) {
      let amount = round((t * pct) / 100);
      if (rows.length === 1) amount = Math.max(0, amount - token);
      rows.push({ label, dueDate: addDays(start, days), amount, percent: pct });
    }
    return balance(rows, t);
  }

  if (preset === "DOWN_PAYMENT") {
    const down = round(t * 0.2);
    return balance(
      [
        { label: "Token amount", dueDate: start, amount: token, percent: null },
        { label: "Down payment (20% less token)", dueDate: addDays(start, 30), amount: Math.max(0, down - token), percent: 20 },
        { label: "On possession / loan disbursement (80%)", dueDate: addMonths(start, options.possessionMonths ?? 12), amount: t - down, percent: 80 },
      ],
      t,
    );
  }

  if (preset === "EQUAL_MONTHLY") {
    const months = Math.max(1, Math.min(120, Math.round(options.months ?? 12)));
    const rest = t - token;
    const each = Math.floor(rest / months);
    const rows: PlanRow[] = [{ label: "Token amount", dueDate: start, amount: token, percent: null }];
    for (let i = 1; i <= months; i++) rows.push({ label: `Installment ${i} of ${months}`, dueDate: addMonths(start, i), amount: each, percent: null });
    return balance(rows, t);
  }

  return [{ label: "Full payment", dueDate: addDays(start, 30), amount: t, percent: 100 }];
}

export type InstallmentLike = { amount: number; paidAmount: number; status: string; dueDate: Date | string };

/** Display status: PENDING/PARTIAL past their due date become OVERDUE. */
export function effectiveStatus(i: InstallmentLike, now: Date = new Date()) {
  if ((i.status === "PENDING" || i.status === "PARTIAL") && new Date(i.dueDate) < startOfDay(now)) return "OVERDUE";
  return i.status;
}

export function isSettled(i: { status: string }) {
  return i.status === "PAID" || i.status === "WAIVED";
}

export function summarizeInstallments<T extends InstallmentLike>(list: T[], now: Date = new Date()) {
  let total = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  let waived = 0;
  let nextDue: T | null = null;
  for (const i of list) {
    total += i.amount;
    paid += i.paidAmount;
    if (i.status === "WAIVED") {
      waived += Math.max(0, i.amount - i.paidAmount);
      continue;
    }
    const due = Math.max(0, i.amount - i.paidAmount);
    if (i.status === "PAID" || due === 0) continue;
    outstanding += due;
    if (effectiveStatus(i, now) === "OVERDUE") {
      overdue += due;
      overdueCount++;
    }
    if (!nextDue || new Date(i.dueDate) < new Date(nextDue.dueDate)) nextDue = i;
  }
  const payable = total - waived;
  return {
    total,
    paid,
    outstanding,
    overdue,
    overdueCount,
    waived,
    nextDue,
    progress: payable > 0 ? Math.min(100, Math.round((paid / payable) * 100)) : 0,
    complete: list.length > 0 && list.every((i) => isSettled(i) || i.paidAmount >= i.amount),
  };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering system words, e.g. 1250000 -> "Twelve Lakh Fifty Thousand". */
export function numberToWordsIN(num: number): string {
  let n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${crore > 99 ? numberToWordsIN(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
}

/** "Rupees Twelve Lakh Fifty Thousand Only", with paise when present. */
export function amountInWordsINR(amount: number) {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let s = `Rupees ${numberToWordsIN(rupees)}`;
  if (paise) s += ` and ${twoDigits(paise)} Paise`;
  return `${s} Only`;
}
