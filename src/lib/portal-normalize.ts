/**
 * Normalises lead payloads pushed by property portals (99acres, MagicBricks, Housing.com),
 * aggregators, Zapier and lead-notification emails into one shape. Pure - no server imports.
 */

export type PortalKey = "99acres" | "magicbricks" | "housing" | "generic";

export type NormalizedLead = {
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  city: string | null;
  locality: string | null;
  budget: string | null;
  propertyRef: string | null; // portal listing id / our property code
  projectName: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  purpose: string | null;
};

export const PORTAL_SOURCE: Record<PortalKey, string> = {
  "99acres": "PORTAL_99ACRES",
  magicbricks: "PORTAL_MAGICBRICKS",
  housing: "PORTAL_HOUSING",
  generic: "WEBSITE",
};

export const PORTAL_LABEL: Record<PortalKey, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing.com",
  generic: "Website / forms",
};

export function isPortalKey(v: string): v is PortalKey {
  return v === "99acres" || v === "magicbricks" || v === "housing" || v === "generic";
}

const ALIASES: Record<keyof Omit<NormalizedLead, "bedrooms">, string[]> = {
  name: ["name", "full_name", "fullname", "sender_name", "sendername", "lead_name", "leadname", "customer_name", "contact_name", "buyer_name", "client_name", "username", "user_name"],
  phone: ["phone", "mobile", "mobile_no", "mobileno", "mobile_number", "phone_number", "phonenumber", "contact_number", "contact_no", "contact", "sender_mobile", "sender_phone", "isd_mobile", "cell", "telephone", "phone_no", "primary_phone"],
  email: ["email", "email_id", "emailid", "sender_email", "email_address", "mail"],
  message: ["message", "query_info", "queryinfo", "query", "comment", "comments", "remarks", "enquiry", "inquiry", "requirement", "msg", "description", "notes", "lead_message"],
  city: ["city", "city_name", "sender_city", "project_city", "property_city"],
  locality: ["locality", "location", "area", "locality_name", "sub_locality", "preferred_location"],
  budget: ["budget", "price", "min_budget", "max_budget", "budget_max", "budget_range", "price_range", "expected_price"],
  propertyRef: ["property_id", "propertyid", "prop_id", "propid", "listing_id", "listingid", "listing", "property_code", "res_com_id", "ad_id", "inventory_id", "sub_id"],
  projectName: ["project_name", "projectname", "project", "property_name", "propertyname", "property_title", "listing_title", "society", "building_name"],
  propertyType: ["property_type", "propertytype", "prop_type", "type", "unit_type"],
  purpose: ["purpose", "transaction_type", "listing_type", "intent", "for"],
};

const BEDROOM_KEYS = ["bhk", "bedrooms", "bedroom", "beds", "configuration", "bhk_type"];

function normKey(k: string) {
  return k
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    // e.g. Facebook-style [{name, values: [...]}] or simple arrays
    for (const item of obj) {
      if (item && typeof item === "object" && "name" in item && ("values" in item || "value" in item)) {
        const it = item as { name: string; values?: unknown[]; value?: unknown };
        out[normKey(it.name)] = String(it.values ? it.values.join(", ") : it.value ?? "");
      }
    }
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = normKey(k);
    if (v && typeof v === "object") flatten(v, key, out);
    else if (v !== null && v !== undefined && String(v).trim() !== "") {
      // nested keys are stored both as "parent_child" and plain "child" (first wins)
      out[prefix ? `${prefix}_${key}` : key] = String(v).trim();
      if (prefix && !(key in out)) out[key] = String(v).trim();
    }
  }
  return out;
}

function pick(flat: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = flat[k];
    if (v && v.trim() && !/^(null|undefined|na|n\/a|-)$/i.test(v.trim())) return v.trim();
  }
  return null;
}

/** Cleans an Indian/intl phone: keeps digits, strips +91 / 0091 / leading 0 noise, returns 10 digits for Indian mobiles. */
export function cleanPhone(raw: string | null | undefined) {
  if (!raw) return "";
  // multiple numbers -> take the first
  const first = String(raw).split(/[,/;|]| or /i)[0];
  let d = first.replace(/\D/g, "");
  if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function parseBedrooms(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(?:\.\d)?)\s*(?:bhk|bed|br|rk)?/i);
  if (!m) return null;
  const n = Math.round(parseFloat(m[1]));
  return n > 0 && n < 20 ? n : null;
}

export function normalizePortalLead(payload: unknown): NormalizedLead {
  const flat = flatten(payload);
  const first = pick(flat, ["first_name", "firstname", "fname"]);
  const last = pick(flat, ["last_name", "lastname", "lname"]);
  const name = pick(flat, ALIASES.name) ?? ([first, last].filter(Boolean).join(" ") || "");
  const phone = cleanPhone(pick(flat, ALIASES.phone));
  const purposeRaw = pick(flat, ALIASES.purpose);
  const purpose = purposeRaw ? (/rent|lease/i.test(purposeRaw) ? "RENT" : /invest/i.test(purposeRaw) ? "INVEST" : /buy|sale|sell|purchase/i.test(purposeRaw) ? "BUY" : null) : null;
  return {
    name: name.replace(/\s+/g, " ").trim(),
    phone,
    email: pick(flat, ALIASES.email),
    message: pick(flat, ALIASES.message),
    city: pick(flat, ALIASES.city),
    locality: pick(flat, ALIASES.locality),
    budget: pick(flat, ALIASES.budget),
    propertyRef: pick(flat, ALIASES.propertyRef),
    projectName: pick(flat, ALIASES.projectName),
    propertyType: pick(flat, ALIASES.propertyType),
    bedrooms: parseBedrooms(pick(flat, BEDROOM_KEYS)),
    purpose,
  };
}

/** Accepts one lead, an array of leads, or wrapper objects like {leads:[...]}, {data:[...]}, {Results:[...]}. */
export function extractLeadList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    for (const k of ["leads", "data", "results", "Results", "Leads", "records", "items", "enquiries"]) {
      const v = (body as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [body];
}

/* ------------------------------------------------------------------ */
/* Email parsing (lead notification emails forwarded to the CRM)       */
/* ------------------------------------------------------------------ */

const INDIAN_MOBILE = /(?:\+?91[\s-]?|0)?([6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function labeled(text: string, labels: string[]) {
  for (const l of labels) {
    const re = new RegExp(`(?:^|\\n)\\s*${l}\\s*[:\\-]\\s*(.+)`, "i");
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

export function detectPortalFromEmail(from: string, subject: string, text: string): PortalKey {
  const hay = `${from} ${subject} ${text.slice(0, 500)}`.toLowerCase();
  if (hay.includes("99acres")) return "99acres";
  if (hay.includes("magicbricks")) return "magicbricks";
  if (hay.includes("housing.com") || /\bhousing\b/.test(hay)) return "housing";
  return "generic";
}

/** Extracts a lead from a portal lead-notification email body. */
export function parseLeadEmail(input: { from?: string; subject?: string; text?: string; html?: string }): NormalizedLead & { portal: PortalKey } {
  const text = (input.text || (input.html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ") || "").replace(/\r/g, "");
  const subject = input.subject || "";
  const portal = detectPortalFromEmail(input.from || "", subject, text);

  const name =
    labeled(text, ["name", "full name", "sender name", "buyer name", "customer name", "contact name", "client name"]) ??
    (subject.match(/(?:from|by)\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/)?.[1] ?? "");
  const phoneLabeled = labeled(text, ["mobile", "phone", "mobile no", "mobile number", "phone number", "contact", "contact number", "contact no"]);
  const phoneMatch = (phoneLabeled && phoneLabeled.match(INDIAN_MOBILE)) || text.match(INDIAN_MOBILE);
  const phone = phoneMatch ? cleanPhone(phoneMatch[1]) : cleanPhone(phoneLabeled);
  const emailLabeled = labeled(text, ["email", "email id", "e-mail", "email address"]);
  const fromAddr = (input.from || "").match(EMAIL_RE)?.[0] ?? null;
  const portalDomains = /99acres|magicbricks|housing|noreply|no-reply|alerts?@|notification/i;
  const bodyEmails = (text.match(new RegExp(EMAIL_RE.source, "gi")) || []).filter((e) => !portalDomains.test(e));
  const email = emailLabeled?.match(EMAIL_RE)?.[0] ?? bodyEmails[0] ?? (fromAddr && !portalDomains.test(fromAddr) ? fromAddr : null);

  return {
    portal,
    name: (name || "").replace(/\s+/g, " ").replace(/[,.]$/, "").trim(),
    phone,
    email,
    message: labeled(text, ["message", "query", "requirement", "comments", "remarks", "enquiry", "details"]),
    city: labeled(text, ["city"]),
    locality: labeled(text, ["locality", "location", "area"]),
    budget: labeled(text, ["budget", "price"]),
    propertyRef: labeled(text, ["property id", "listing id", "prop id", "property code"]),
    projectName: labeled(text, ["project", "project name", "property", "property name", "property title"]),
    propertyType: labeled(text, ["property type"]),
    bedrooms: parseBedrooms(labeled(text, ["bhk", "bedrooms", "configuration"])),
    purpose: null,
  };
}

/* ------------------------------------------------------------------ */
/* Facebook / Instagram Lead Ads field_data                            */
/* ------------------------------------------------------------------ */

export type FbField = { name: string; values?: string[] };

const FB_KNOWN: Record<string, (keyof NormalizedLead | "first" | "last")> = {
  full_name: "name",
  name: "name",
  first_name: "first",
  last_name: "last",
  phone_number: "phone",
  phone: "phone",
  mobile_number: "phone",
  email: "email",
  city: "city",
  locality: "locality",
  preferred_location: "locality",
  location: "locality",
  budget: "budget",
  what_is_your_budget: "budget",
  bhk: "bedrooms",
  property_type: "propertyType",
};

/** Maps Facebook lead `field_data` into a lead; unknown questions are collected as "Question: answer" lines. */
export function mapFacebookFields(fields: FbField[]): NormalizedLead & { extras: string[] } {
  const out: NormalizedLead & { extras: string[] } = {
    name: "",
    phone: "",
    email: null,
    message: null,
    city: null,
    locality: null,
    budget: null,
    propertyRef: null,
    projectName: null,
    propertyType: null,
    bedrooms: null,
    purpose: null,
    extras: [],
  };
  let first = "";
  let last = "";
  for (const f of fields || []) {
    const key = normKey(f.name || "");
    const value = (f.values || []).join(", ").trim();
    if (!value) continue;
    let target = FB_KNOWN[key];
    if (!target) {
      if (/budget/.test(key)) target = "budget";
      else if (/bhk|bedroom|configuration/.test(key)) target = "bedrooms";
      else if (/location|locality|area/.test(key)) target = "locality";
      else if (/phone|mobile/.test(key)) target = "phone";
      else if (/property_type|type_of_property/.test(key)) target = "propertyType";
    }
    switch (target) {
      case "first":
        first = value;
        break;
      case "last":
        last = value;
        break;
      case "name":
        out.name = value;
        break;
      case "phone":
        out.phone = cleanPhone(value);
        break;
      case "bedrooms":
        out.bedrooms = parseBedrooms(value);
        out.extras.push(`${prettyQuestion(f.name)}: ${value}`);
        break;
      case "email":
      case "city":
      case "locality":
      case "budget":
      case "propertyType":
        out[target] = value;
        if (target === "budget") out.extras.push(`Budget: ${value}`);
        break;
      default:
        out.extras.push(`${prettyQuestion(f.name)}: ${value}`);
    }
  }
  if (!out.name) out.name = [first, last].filter(Boolean).join(" ");
  if (/rent|lease/i.test(out.extras.join(" "))) out.purpose = "RENT";
  return out;
}

function prettyQuestion(name: string) {
  const s = (name || "").replace(/[_?]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Answer";
}
