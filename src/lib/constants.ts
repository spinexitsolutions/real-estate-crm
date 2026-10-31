export type Option = { value: string; label: string; color?: string; dot?: string };

const opts = <T extends Option[]>(o: T) => o;

export const ROLES = opts([
  { value: "ADMIN", label: "Admin", color: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  { value: "MANAGER", label: "Manager", color: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  { value: "AGENT", label: "Agent", color: "bg-slate-50 text-slate-700 ring-slate-600/20" },
]);

export const LEAD_STATUSES = opts([
  { value: "NEW", label: "New", color: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  { value: "CONTACTED", label: "Contacted", color: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", dot: "bg-indigo-500" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  { value: "SITE_VISIT", label: "Site Visit", color: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  { value: "NEGOTIATION", label: "Negotiation", color: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  { value: "WON", label: "Won", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  { value: "LOST", label: "Lost", color: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
]);

export const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "NEGOTIATION"];

export const LEAD_SOURCES = opts([
  { value: "WEBSITE", label: "Website" },
  { value: "FACEBOOK", label: "Facebook Ads" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "PORTAL_99ACRES", label: "99acres" },
  { value: "PORTAL_MAGICBRICKS", label: "MagicBricks" },
  { value: "PORTAL_HOUSING", label: "Housing.com" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "COLD_CALL", label: "Cold Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Other" },
]);

export const PRIORITIES = opts([
  { value: "HOT", label: "Hot", color: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
  { value: "WARM", label: "Warm", color: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  { value: "COLD", label: "Cold", color: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
]);

export const PURPOSES = opts([
  { value: "BUY", label: "Buy" },
  { value: "RENT", label: "Rent" },
  { value: "INVEST", label: "Investment" },
]);

export const PROPERTY_TYPES = opts([
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "INDEPENDENT_HOUSE", label: "Independent House" },
  { value: "PLOT", label: "Plot / Land" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "OFFICE", label: "Office Space" },
  { value: "SHOP", label: "Shop / Showroom" },
  { value: "WAREHOUSE", label: "Warehouse" },
]);

export const LISTING_TYPES = opts([
  { value: "SALE", label: "For Sale", color: "bg-indigo-50 text-indigo-700 ring-indigo-600/20" },
  { value: "RENT", label: "For Rent", color: "bg-teal-50 text-teal-700 ring-teal-600/20" },
]);

export const PROPERTY_STATUSES = opts([
  { value: "AVAILABLE", label: "Available", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  { value: "RESERVED", label: "Reserved", color: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  { value: "SOLD", label: "Sold", color: "bg-slate-100 text-slate-700 ring-slate-600/20", dot: "bg-slate-500" },
  { value: "RENTED", label: "Rented", color: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  { value: "OFF_MARKET", label: "Off Market", color: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
]);

export const FURNISHING = opts([
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI", label: "Semi-Furnished" },
  { value: "FULLY", label: "Fully Furnished" },
]);

export const AMENITIES = [
  "Parking",
  "Lift",
  "Power Backup",
  "Gym",
  "Swimming Pool",
  "Security",
  "Club House",
  "Garden",
  "Children Play Area",
  "Gated Community",
  "Intercom",
  "Rain Water Harvesting",
  "Vastu Compliant",
  "Gas Pipeline",
  "Jogging Track",
  "CCTV",
];

export const FOLLOWUP_TYPES = opts([
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
]);

export const FOLLOWUP_PRIORITIES = opts([
  { value: "HIGH", label: "High", color: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  { value: "MEDIUM", label: "Medium", color: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { value: "LOW", label: "Low", color: "bg-slate-50 text-slate-600 ring-slate-500/20" },
]);

export const FOLLOWUP_OUTCOMES = [
  "Interested",
  "Not interested",
  "Call back later",
  "Not reachable",
  "Site visit scheduled",
  "Site visit done",
  "Negotiation started",
  "Documents shared",
  "Booked",
];

export const DEAL_STAGES = opts([
  { value: "NEGOTIATION", label: "Negotiation", color: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  { value: "TOKEN", label: "Token Received", color: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  { value: "AGREEMENT", label: "Agreement", color: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  { value: "WON", label: "Closed Won", color: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  { value: "LOST", label: "Closed Lost", color: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
]);

export const TEMPLATE_CATEGORIES = opts([
  { value: "GREETING", label: "Greeting" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "PROPERTY", label: "Property Share" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "PAYMENT", label: "Payment" },
  { value: "FESTIVE", label: "Festive" },
  { value: "GENERAL", label: "General" },
]);

export const TEMPLATE_VARIABLES = [
  { key: "name", label: "Lead name" },
  { key: "agent", label: "Agent name" },
  { key: "company", label: "Company name" },
  { key: "property", label: "Property title" },
  { key: "price", label: "Property price" },
  { key: "location", label: "Property location" },
  { key: "date", label: "Follow-up date" },
];

export function labelOf(list: Option[], value: string | null | undefined) {
  return list.find((o) => o.value === value)?.label ?? value ?? "-";
}

export function optionOf(list: Option[], value: string | null | undefined) {
  return list.find((o) => o.value === value);
}
