import { describe, expect, it } from "vitest";
import { matchScore } from "../matching";

const lead = { purpose: "BUY", propertyType: "APARTMENT", bedrooms: 2, budgetMin: 8000000, budgetMax: 10000000, preferredLocation: "Baner, Pune" };
const prop = { listingType: "SALE", type: "APARTMENT", bedrooms: 2, price: 9500000, city: "Pune", locality: "Baner" };

describe("matchScore", () => {
  it("gives a perfect fit a high score", () => {
    expect(matchScore(lead, prop)).toBeGreaterThanOrEqual(90);
  });
  it("rejects rent listings for buyers and vice versa", () => {
    expect(matchScore(lead, { ...prop, listingType: "RENT" })).toBe(0);
    expect(matchScore({ ...lead, purpose: "RENT" }, prop)).toBe(0);
  });
  it("rejects properties far above budget", () => {
    expect(matchScore(lead, { ...prop, price: 20000000 })).toBe(0);
  });
  it("penalises type and location mismatches", () => {
    const exact = matchScore(lead, prop);
    expect(matchScore(lead, { ...prop, type: "VILLA" })).toBeLessThan(exact);
    expect(matchScore(lead, { ...prop, city: "Mumbai", locality: "Powai" })).toBeLessThan(exact);
  });
  it("stays within 0-100 for open requirements", () => {
    const s = matchScore({ purpose: "BUY", propertyType: null, bedrooms: null, budgetMin: null, budgetMax: null, preferredLocation: null }, prop);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
