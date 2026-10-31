import { describe, expect, it } from "vitest";
import { csvEscape, fillTemplate, normalizePhone, parseCsv, parseImages, splitList, toCsv, waLink } from "../utils";

describe("normalizePhone", () => {
  it("adds country code to 10-digit numbers", () => {
    expect(normalizePhone("9876543210")).toBe("919876543210");
  });
  it("keeps numbers that already have +91", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
  });
  it("strips the trunk 0 prefix", () => {
    expect(normalizePhone("09876543210")).toBe("919876543210");
  });
  it("strips the 00 international prefix", () => {
    expect(normalizePhone("00971501234567")).toBe("971501234567");
  });
  it("uses a custom default country code", () => {
    expect(normalizePhone("5551234567", "1")).toBe("15551234567");
  });
  it("handles empty input", () => {
    expect(normalizePhone("")).toBe("");
  });
});

describe("waLink", () => {
  it("builds a wa.me link with encoded text", () => {
    expect(waLink("98765 43210", "Hi Rahul & family")).toBe("https://wa.me/919876543210?text=Hi%20Rahul%20%26%20family");
  });
  it("omits text when not provided", () => {
    expect(waLink("9876543210")).toBe("https://wa.me/919876543210");
  });
});

describe("fillTemplate", () => {
  it("replaces variables, including spaced ones", () => {
    expect(fillTemplate("Hi {{name}}, from {{ company }}", { name: "Priya", company: "Skyline" })).toBe("Hi Priya, from Skyline");
  });
  it("blanks out missing, null or empty variables", () => {
    expect(fillTemplate("{{a}}|{{b}}|{{c}}|{{d}}", { a: null, b: undefined, c: "" })).toBe("|||");
  });
  it("stringifies numbers", () => {
    expect(fillTemplate("BHK: {{bhk}}", { bhk: 3 })).toBe("BHK: 3");
  });
});

describe("parseCsv", () => {
  it("parses simple rows and skips blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("handles quoted commas, newlines and escaped quotes", () => {
    const csv = 'Name,Notes\r\n"Verma, Rahul","Line 1\nLine 2"\r\n"Say ""hi""",x';
    expect(parseCsv(csv)).toEqual([
      ["Name", "Notes"],
      ["Verma, Rahul", "Line 1\nLine 2"],
      ['Say "hi"', "x"],
    ]);
  });
  it("round-trips with toCsv", () => {
    const rows = [
      ["a, b", 'q"uote', "multi\nline"],
      ["plain", null, 5],
    ];
    const text = toCsv(["h1", "h2", "h3"], rows);
    expect(parseCsv(text)).toEqual([
      ["h1", "h2", "h3"],
      ["a, b", 'q"uote', "multi\nline"],
      ["plain", "", "5"],
    ]);
  });
});

describe("csvEscape", () => {
  it("leaves simple values untouched", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(null)).toBe("");
  });
  it("quotes values containing separators", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
  });
});

describe("splitList / parseImages", () => {
  it("splits and trims comma lists", () => {
    expect(splitList(" NRI, Home Loan ,,Investor ")).toEqual(["NRI", "Home Loan", "Investor"]);
    expect(splitList(null)).toEqual([]);
  });
  it("parses image JSON safely", () => {
    expect(parseImages('["https://a/1.jpg", 3, "", "https://a/2.jpg"]')).toEqual(["https://a/1.jpg", "https://a/2.jpg"]);
    expect(parseImages("not json")).toEqual([]);
    expect(parseImages('{"a":1}')).toEqual([]);
    expect(parseImages(undefined)).toEqual([]);
  });
});
