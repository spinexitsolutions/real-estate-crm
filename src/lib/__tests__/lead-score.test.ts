import { describe, expect, it } from "vitest";
import { leadScore, scoreTone } from "../lead-score";

const base = {
  priority: "WARM",
  status: "CONTACTED",
  lastContactedAt: null as Date | null,
  createdAt: new Date(),
  budgetMax: null as number | null,
  email: null as string | null,
  propertyType: null as string | null,
  preferredLocation: null as string | null,
};

describe("leadScore", () => {
  it("is 100 for won and 0 for lost", () => {
    expect(leadScore({ ...base, status: "WON" })).toBe(100);
    expect(leadScore({ ...base, status: "LOST" })).toBe(0);
  });
  it("ranks hot, advanced, complete leads higher", () => {
    const cold = leadScore({ ...base, priority: "COLD", status: "NEW", createdAt: new Date(Date.now() - 60 * 86400000) });
    const hot = leadScore({
      ...base,
      priority: "HOT",
      status: "NEGOTIATION",
      lastContactedAt: new Date(),
      budgetMax: 9000000,
      email: "a@b.com",
      propertyType: "APARTMENT",
      preferredLocation: "Baner",
    });
    expect(hot).toBeGreaterThan(cold);
    expect(hot).toBeLessThanOrEqual(99);
    expect(cold).toBeGreaterThanOrEqual(0);
  });
  it("decays with time since last contact", () => {
    const recent = leadScore({ ...base, lastContactedAt: new Date() });
    const stale = leadScore({ ...base, lastContactedAt: new Date(Date.now() - 30 * 86400000) });
    expect(recent).toBeGreaterThan(stale);
  });
});

describe("scoreTone", () => {
  it("maps score bands", () => {
    expect(scoreTone(80).label).toBe("High");
    expect(scoreTone(50).label).toBe("Medium");
    expect(scoreTone(10).label).toBe("Low");
  });
});
