import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  cheapestPlanWith,
  formatInvoiceNumber,
  hasFeature,
  limitMessage,
  limitOf,
  nextInvoiceSeq,
  planFeatures,
  priceWithGst,
  remainingCapacity,
  splitGstInclusive,
  statusForSubscriptionEvent,
  usagePercent,
  verifyRazorpayWebhook,
  verifySubscriptionPayment,
  yearlySavingPercent,
} from "../billing-core";

const starter = { code: "STARTER", name: "Starter", priceMonthly: 999, priceYearly: 9990, maxUsers: 3, maxLeads: 2000, maxProperties: 200, features: "leads,pipeline,reports" };
const growth = { code: "GROWTH", name: "Growth", priceMonthly: 2499, priceYearly: 24990, maxUsers: 10, maxLeads: 0, maxProperties: 0, features: "leads,pipeline,reports,bookings,website" };
const pro = { code: "PRO", name: "Pro", priceMonthly: 5999, priceYearly: 59990, maxUsers: 30, maxLeads: 0, maxProperties: 0, features: "leads,bookings,website,click_to_call" };

describe("features", () => {
  it("checks plan features", () => {
    expect(hasFeature(starter, "leads")).toBe(true);
    expect(hasFeature(starter, "bookings")).toBe(false);
    expect(hasFeature(growth, "bookings")).toBe(true);
  });
  it("gives every feature when there is no plan", () => {
    expect(hasFeature(null, "click_to_call")).toBe(true);
    expect(planFeatures(undefined).length).toBeGreaterThan(10);
  });
  it("ignores unknown keys and whitespace", () => {
    expect(planFeatures({ features: " leads , nonsense,website" })).toEqual(["leads", "website"]);
  });
  it("finds the cheapest plan with a feature", () => {
    expect(cheapestPlanWith([pro, starter, growth], "bookings")?.code).toBe("GROWTH");
    expect(cheapestPlanWith([pro, starter, growth], "click_to_call")?.code).toBe("PRO");
    expect(cheapestPlanWith([starter], "click_to_call")).toBeNull();
    expect(cheapestPlanWith([{ ...growth, active: false }, pro], "bookings")?.code).toBe("PRO");
  });
});

describe("limits", () => {
  it("reads limits per kind", () => {
    expect(limitOf(starter, "users")).toBe(3);
    expect(limitOf(starter, "leads")).toBe(2000);
    expect(limitOf(growth, "properties")).toBe(0);
    expect(limitOf(null, "users")).toBe(0);
  });
  it("computes remaining capacity (0 = unlimited)", () => {
    expect(remainingCapacity(3, 1)).toBe(2);
    expect(remainingCapacity(3, 5)).toBe(0);
    expect(remainingCapacity(0, 999)).toBe(Infinity);
  });
  it("formats the limit message", () => {
    expect(limitMessage("Starter", "users", 3)).toBe("Your Starter plan allows 3 users. Upgrade your plan to add more.");
    expect(limitMessage("Starter", "users", 1)).toContain("1 user.");
    expect(limitMessage("Starter", "leads", 2000)).toContain("2,000 leads");
  });
  it("computes usage percent", () => {
    expect(usagePercent(1, 4)).toBe(25);
    expect(usagePercent(10, 4)).toBe(100);
    expect(usagePercent(10, 0)).toBe(0);
  });
});

describe("GST", () => {
  it("splits inter-state / unknown as IGST", () => {
    const g = splitGstInclusive(1178.82, "Maharashtra", null);
    expect(g.intraState).toBe(false);
    expect(g.taxable).toBe(999);
    expect(g.igst).toBe(179.82);
    expect(g.cgst + g.sgst).toBe(0);
  });
  it("splits intra-state as CGST + SGST", () => {
    const g = splitGstInclusive(2949, "Maharashtra", "maharashtra ");
    expect(g.intraState).toBe(true);
    expect(g.igst).toBe(0);
    expect(Math.round((g.taxable + g.cgst + g.sgst) * 100) / 100).toBe(2949);
    expect(Math.abs(g.cgst - g.sgst)).toBeLessThan(0.011);
  });
  it("adds GST to plan prices and computes yearly saving", () => {
    expect(priceWithGst(999)).toBe(1179);
    expect(yearlySavingPercent(999, 9990)).toBe(17);
    expect(yearlySavingPercent(0, 100)).toBe(0);
  });
});

describe("invoice numbers", () => {
  it("formats and increments within the year", () => {
    expect(formatInvoiceNumber(2026, 7)).toBe("INV-2026-00007");
    expect(nextInvoiceSeq("INV-2026-00012", 2026)).toBe(13);
    expect(nextInvoiceSeq("INV-2025-00500", 2026)).toBe(1);
    expect(nextInvoiceSeq(null, 2026)).toBe(1);
    expect(nextInvoiceSeq("garbage", 2026)).toBe(1);
  });
});

describe("Razorpay signatures", () => {
  it("verifies webhook signatures", () => {
    const body = JSON.stringify({ event: "subscription.charged" });
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(verifyRazorpayWebhook(body, sig, "whsec")).toBe(true);
    expect(verifyRazorpayWebhook(body + " ", sig, "whsec")).toBe(false);
    expect(verifyRazorpayWebhook(body, sig, "other")).toBe(false);
    expect(verifyRazorpayWebhook(body, null, "whsec")).toBe(false);
  });
  it("verifies checkout payment signatures", () => {
    const sig = createHmac("sha256", "keysecret").update("pay_1|sub_1").digest("hex");
    expect(verifySubscriptionPayment("pay_1", "sub_1", sig, "keysecret")).toBe(true);
    expect(verifySubscriptionPayment("pay_2", "sub_1", sig, "keysecret")).toBe(false);
    expect(verifySubscriptionPayment("pay_1", "sub_1", "", "keysecret")).toBe(false);
  });
  it("maps subscription events to statuses", () => {
    expect(statusForSubscriptionEvent("subscription.charged")).toBe("ACTIVE");
    expect(statusForSubscriptionEvent("subscription.halted")).toBe("PAST_DUE");
    expect(statusForSubscriptionEvent("subscription.cancelled")).toBe("CANCELLED");
    expect(statusForSubscriptionEvent("payment.failed")).toBeNull();
  });
});
