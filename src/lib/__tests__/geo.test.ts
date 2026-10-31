import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance, isValidCoord, mapsLink } from "../geo";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(19.066, 72.8686, 19.066, 72.8686)).toBe(0);
  });
  it("matches known distance Mumbai BKC to Powai (~9-11 km)", () => {
    const d = distanceMeters(19.066, 72.8686, 19.1176, 72.906);
    expect(d).toBeGreaterThan(6500);
    expect(d).toBeLessThan(7500);
  });
  it("measures ~111 km per degree of latitude", () => {
    const d = distanceMeters(0, 0, 1, 0);
    expect(Math.round(d / 1000)).toBe(111);
  });
  it("is symmetric", () => {
    expect(distanceMeters(10, 20, 11, 21)).toBeCloseTo(distanceMeters(11, 21, 10, 20), 6);
  });
});

describe("formatDistance", () => {
  it("formats meters and kilometers", () => {
    expect(formatDistance(85.4)).toBe("85 m");
    expect(formatDistance(1250)).toBe("1.3 km");
    expect(formatDistance(12000)).toBe("12 km");
    expect(formatDistance(null)).toBe("-");
  });
});

describe("helpers", () => {
  it("validates coordinates", () => {
    expect(isValidCoord(19.06, 72.86)).toBe(true);
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(NaN, 0)).toBe(false);
    expect(isValidCoord("1", 2)).toBe(false);
  });
  it("builds a maps link", () => {
    expect(mapsLink(1.5, 2.5)).toBe("https://www.google.com/maps?q=1.5,2.5");
  });
});
