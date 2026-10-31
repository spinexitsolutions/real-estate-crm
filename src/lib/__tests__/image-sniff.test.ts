import { describe, expect, it } from "vitest";
import { sniffImageType } from "../image-sniff";

const pad = (arr: number[]) => new Uint8Array([...arr, ...new Array(16).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("detects JPEG, PNG, WebP and AVIF by signature", () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toBe("image/webp");
    expect(sniffImageType(pad([0, 0, 0, 0x1c, ...ascii("ftypavif")]))).toBe("image/avif");
  });
  it("rejects other files even if renamed", () => {
    expect(sniffImageType(pad(ascii("<svg xmlns")))).toBeNull();
    expect(sniffImageType(pad(ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
