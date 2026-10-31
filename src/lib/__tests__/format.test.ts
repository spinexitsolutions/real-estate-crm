import { describe, expect, it } from "vitest";
import { formatBudget, formatCompact, percent } from "../format";

describe("formatCompact (INR)", () => {
  it("formats crores", () => {
    expect(formatCompact(42500000)).toBe("₹4.25 Cr");
    expect(formatCompact(10000000)).toBe("₹1 Cr");
  });
  it("formats lakhs", () => {
    expect(formatCompact(9800000)).toBe("₹98 L");
    expect(formatCompact(145000)).toBe("₹1.45 L");
  });
  it("formats thousands and small values", () => {
    expect(formatCompact(55000)).toBe("₹55 K");
    expect(formatCompact(999)).toBe("₹999");
  });
  it("handles negatives and missing values", () => {
    expect(formatCompact(-2500000)).toBe("-₹25 L");
    expect(formatCompact(null)).toBe("-");
    expect(formatCompact(Number.NaN)).toBe("-");
  });
});

describe("formatBudget", () => {
  it("shows a range", () => {
    expect(formatBudget(5000000, 8000000)).toBe("₹50 L - ₹80 L");
  });
  it("shows open-ended budgets", () => {
    expect(formatBudget(null, 12000000)).toBe("Up to ₹1.2 Cr");
    expect(formatBudget(3000000, null)).toBe("From ₹30 L");
    expect(formatBudget(null, null)).toBe("Not specified");
  });
});

describe("percent", () => {
  it("rounds to one decimal and guards zero", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBe(0);
  });
});
