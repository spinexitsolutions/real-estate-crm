import { describe, expect, it } from "vitest";
import { isWindowOpen } from "../whatsapp-window";

const now = new Date("2026-10-31T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);

describe("isWindowOpen (WhatsApp 24h customer service window)", () => {
  it("is closed when the lead never messaged", () => {
    expect(isWindowOpen(null, now)).toBe(false);
  });
  it("is open within 24 hours of the last inbound message", () => {
    expect(isWindowOpen(hoursAgo(1), now)).toBe(true);
    expect(isWindowOpen(hoursAgo(23.9), now)).toBe(true);
  });
  it("closes after 24 hours", () => {
    expect(isWindowOpen(hoursAgo(24.1), now)).toBe(false);
    expect(isWindowOpen(hoursAgo(72), now)).toBe(false);
  });
  it("accepts ISO strings", () => {
    expect(isWindowOpen(hoursAgo(2).toISOString(), now)).toBe(true);
  });
});
