import { describe, expect, it } from "vitest";
import { cleanPhone, extractLeadList, mapFacebookFields, normalizePortalLead, parseBedrooms, parseLeadEmail } from "../portal-normalize";

describe("cleanPhone", () => {
  it("strips Indian country code variants", () => {
    expect(cleanPhone("+91 98765 43210")).toBe("9876543210");
    expect(cleanPhone("919876543210")).toBe("9876543210");
    expect(cleanPhone("0091-9876543210")).toBe("9876543210");
    expect(cleanPhone("09876543210")).toBe("9876543210");
    expect(cleanPhone("9876543210, 9123456789")).toBe("9876543210");
  });
  it("keeps other international numbers", () => {
    expect(cleanPhone("+971 50 123 4567")).toBe("971501234567");
  });
});

describe("normalizePortalLead", () => {
  it("maps a 99acres style payload (upper case keys)", () => {
    const l = normalizePortalLead({ SENDER_NAME: "Rahul Verma", MOBILE: "+91-9876543210", EMAIL: "rahul@x.com", QUERY_INFO: "Need 2 BHK", PROJECT_NAME: "Palm Heights", CITY: "Pune", BUDGET: "80 Lac", PROPERTY_ID: "R12345" });
    expect(l).toMatchObject({ name: "Rahul Verma", phone: "9876543210", email: "rahul@x.com", message: "Need 2 BHK", projectName: "Palm Heights", city: "Pune", budget: "80 Lac", propertyRef: "R12345" });
  });
  it("maps a MagicBricks style payload", () => {
    const l = normalizePortalLead({ name: "Priya", mobile: "9123456789", comment: "Call after 6", prop_id: "PR-1002", project: "Skyline", city: "Mumbai", budget: "1.2 Cr" });
    expect(l).toMatchObject({ name: "Priya", phone: "9123456789", message: "Call after 6", propertyRef: "PR-1002", projectName: "Skyline" });
  });
  it("maps a Housing.com style nested payload and first/last names", () => {
    const l = normalizePortalLead({ lead: { first_name: "Amit", last_name: "Shah", phone: "09812345678", listing_id: "H-77", locality: "Baner", city: "Pune", bhk: "3 BHK" } });
    expect(l.name).toBe("Amit Shah");
    expect(l.phone).toBe("9812345678");
    expect(l.propertyRef).toBe("H-77");
    expect(l.locality).toBe("Baner");
    expect(l.bedrooms).toBe(3);
  });
  it("ignores placeholder values", () => {
    expect(normalizePortalLead({ name: "A", phone: "9876543210", email: "NA" }).email).toBeNull();
  });
});

describe("extractLeadList", () => {
  it("handles arrays and wrapper keys", () => {
    expect(extractLeadList([{ a: 1 }, { a: 2 }])).toHaveLength(2);
    expect(extractLeadList({ leads: [{ a: 1 }] })).toHaveLength(1);
    expect(extractLeadList({ name: "x" })).toEqual([{ name: "x" }]);
  });
});

describe("parseBedrooms", () => {
  it("reads BHK strings", () => {
    expect(parseBedrooms("2 BHK")).toBe(2);
    expect(parseBedrooms("3bhk")).toBe(3);
    expect(parseBedrooms("Studio")).toBeNull();
  });
});

describe("parseLeadEmail", () => {
  it("parses a 99acres-style lead email", () => {
    const l = parseLeadEmail({
      from: "99acres <leads@99acres.com>",
      subject: "You have received a response on your property",
      text: "Dear Advertiser,\nName: Suresh Iyer\nMobile: +91-98200 12345\nEmail: suresh.iyer@gmail.com\nMessage: Is it still available? Want to visit on Sunday\nProperty ID: PR-1007\n",
    });
    expect(l.portal).toBe("99acres");
    expect(l.name).toBe("Suresh Iyer");
    expect(l.phone).toBe("9820012345");
    expect(l.email).toBe("suresh.iyer@gmail.com");
    expect(l.propertyRef).toBe("PR-1007");
    expect(l.message).toMatch(/still available/);
  });
  it("parses a MagicBricks HTML email and ignores the portal's own address", () => {
    const l = parseLeadEmail({
      from: "MagicBricks <noreply@magicbricks.com>",
      subject: "New enquiry from Kavya Nair",
      html: "<p>Contact Name: Kavya Nair</p><p>Contact Number: 9988776655</p><p>Project: Skyline Residency</p>",
    });
    expect(l.portal).toBe("magicbricks");
    expect(l.name).toBe("Kavya Nair");
    expect(l.phone).toBe("9988776655");
    expect(l.email).toBeNull();
    expect(l.projectName).toBe("Skyline Residency");
  });
  it("finds an unlabeled mobile number in free text", () => {
    const l = parseLeadEmail({ from: "x@housing.com", subject: "Lead from Housing", text: "Buyer Name: Ankit\nPlease call 7012345678 regarding the 2 BHK." });
    expect(l.portal).toBe("housing");
    expect(l.phone).toBe("7012345678");
  });
});

describe("mapFacebookFields", () => {
  it("maps standard and custom questions", () => {
    const l = mapFacebookFields([
      { name: "full_name", values: ["Neha Gupta"] },
      { name: "phone_number", values: ["+919811122233"] },
      { name: "email", values: ["neha@x.com"] },
      { name: "what_is_your_budget?", values: ["50-60 Lakhs"] },
      { name: "preferred_location", values: ["Wakad"] },
      { name: "when_are_you_planning_to_buy?", values: ["Within 3 months"] },
    ]);
    expect(l.name).toBe("Neha Gupta");
    expect(l.phone).toBe("9811122233");
    expect(l.budget).toBe("50-60 Lakhs");
    expect(l.locality).toBe("Wakad");
    expect(l.extras.join("\n")).toMatch(/When are you planning to buy: Within 3 months/);
  });
  it("combines first and last name", () => {
    expect(mapFacebookFields([{ name: "first_name", values: ["Ravi"] }, { name: "last_name", values: ["K"] }]).name).toBe("Ravi K");
  });
});
