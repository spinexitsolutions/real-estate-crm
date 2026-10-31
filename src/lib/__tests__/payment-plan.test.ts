import { describe, expect, it } from "vitest";
import { amountInWordsINR, buildPlan, effectiveStatus, numberToWordsIN, summarizeInstallments } from "../payment-plan";

const start = new Date(2026, 0, 1);
const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);

describe("buildPlan", () => {
  it("construction linked plan adds up to total and starts with token", () => {
    const rows = buildPlan("CONSTRUCTION_LINKED", 12500000, start, { tokenAmount: 100000 });
    expect(rows[0]).toMatchObject({ label: "Token amount", amount: 100000 });
    expect(rows[1].amount).toBe(1250000 - 100000);
    expect(sum(rows)).toBe(12500000);
    expect(rows.length).toBe(11);
    for (let i = 1; i < rows.length; i++) expect(rows[i].dueDate.getTime()).toBeGreaterThanOrEqual(rows[i - 1].dueDate.getTime());
  });

  it("down payment plan is 20/80", () => {
    const rows = buildPlan("DOWN_PAYMENT", 10000000, start, { tokenAmount: 200000 });
    expect(sum(rows)).toBe(10000000);
    expect(rows[0].amount + rows[1].amount).toBe(2000000);
    expect(rows[2].amount).toBe(8000000);
  });

  it("equal monthly plan absorbs rounding in the last row", () => {
    const rows = buildPlan("EQUAL_MONTHLY", 1000001, start, { tokenAmount: 1, months: 3 });
    expect(rows.length).toBe(4);
    expect(sum(rows)).toBe(1000001);
    expect(rows[1].amount).toBe(333333);
    expect(rows[3].amount).toBe(333334);
  });

  it("custom plan is one row and empty for zero total", () => {
    expect(buildPlan("CUSTOM", 500000, start)).toHaveLength(1);
    expect(buildPlan("CUSTOM", 0, start)).toHaveLength(0);
  });

  it("token never exceeds total", () => {
    const rows = buildPlan("DOWN_PAYMENT", 50000, start, { tokenAmount: 100000 });
    expect(rows[0].amount).toBe(50000);
    expect(sum(rows)).toBe(50000);
  });
});

describe("summarizeInstallments", () => {
  const now = new Date(2026, 5, 15);
  const list = [
    { amount: 100000, paidAmount: 100000, status: "PAID", dueDate: new Date(2026, 0, 1) },
    { amount: 400000, paidAmount: 150000, status: "PARTIAL", dueDate: new Date(2026, 4, 1) },
    { amount: 500000, paidAmount: 0, status: "PENDING", dueDate: new Date(2026, 6, 1) },
    { amount: 50000, paidAmount: 0, status: "WAIVED", dueDate: new Date(2026, 1, 1) },
  ];

  it("computes paid, outstanding, overdue and next due", () => {
    const s = summarizeInstallments(list, now);
    expect(s.total).toBe(1050000);
    expect(s.paid).toBe(250000);
    expect(s.outstanding).toBe(750000);
    expect(s.overdue).toBe(250000);
    expect(s.overdueCount).toBe(1);
    expect(s.nextDue?.amount).toBe(400000);
    expect(s.complete).toBe(false);
    expect(s.progress).toBe(25);
  });

  it("flags overdue only for unpaid rows past due date", () => {
    expect(effectiveStatus(list[1], now)).toBe("OVERDUE");
    expect(effectiveStatus(list[2], now)).toBe("PENDING");
    expect(effectiveStatus(list[0], now)).toBe("PAID");
    expect(effectiveStatus({ amount: 1, paidAmount: 0, status: "PENDING", dueDate: now }, now)).toBe("PENDING");
  });

  it("is complete when everything is paid or waived", () => {
    expect(summarizeInstallments([list[0], list[3]], now).complete).toBe(true);
  });
});

describe("amountInWordsINR", () => {
  it("uses the Indian numbering system", () => {
    expect(amountInWordsINR(1250000)).toBe("Rupees Twelve Lakh Fifty Thousand Only");
    expect(amountInWordsINR(42500000)).toBe("Rupees Four Crore Twenty Five Lakh Only");
    expect(amountInWordsINR(100000)).toBe("Rupees One Lakh Only");
    expect(amountInWordsINR(1001)).toBe("Rupees One Thousand One Only");
    expect(amountInWordsINR(999)).toBe("Rupees Nine Hundred Ninety Nine Only");
    expect(amountInWordsINR(0)).toBe("Rupees Zero Only");
  });

  it("handles paise and very large amounts", () => {
    expect(amountInWordsINR(1500.5)).toBe("Rupees One Thousand Five Hundred and Fifty Paise Only");
    expect(numberToWordsIN(1234567890)).toBe("One Hundred Twenty Three Crore Forty Five Lakh Sixty Seven Thousand Eight Hundred Ninety");
  });
});
