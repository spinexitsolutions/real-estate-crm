/** Human labels for plan feature keys (Plan.features is a comma separated list of these keys). */
export const FEATURES: { key: string; label: string; group: "Core" | "Growth" | "Advanced" }[] = [
  { key: "leads", label: "Lead management", group: "Core" },
  { key: "pipeline", label: "Sales pipeline (Kanban)", group: "Core" },
  { key: "followups", label: "Follow-up reminders", group: "Core" },
  { key: "properties", label: "Property inventory", group: "Core" },
  { key: "whatsapp_link", label: "WhatsApp click-to-chat & templates", group: "Core" },
  { key: "reports", label: "Reports & analytics", group: "Core" },
  { key: "brochure", label: "Property brochure PDF", group: "Core" },
  { key: "mobile", label: "Mobile app (PWA)", group: "Core" },
  { key: "whatsapp_api", label: "WhatsApp Business API & inbox", group: "Growth" },
  { key: "portal_integrations", label: "99acres, MagicBricks, Housing, Facebook leads", group: "Growth" },
  { key: "website", label: "Property listing website", group: "Growth" },
  { key: "bookings", label: "Bookings, payment plans & receipts", group: "Growth" },
  { key: "customer_portal", label: "Customer portal", group: "Growth" },
  { key: "documents", label: "Documents & KYC", group: "Growth" },
  { key: "attendance", label: "Attendance & site visit check-in", group: "Growth" },
  { key: "click_to_call", label: "Click-to-call with recordings (Exotel / Knowlarity)", group: "Advanced" },
  { key: "api_access", label: "API access", group: "Advanced" },
  { key: "priority_support", label: "Priority support", group: "Advanced" },
];

export function featureLabel(key: string) {
  return FEATURES.find((f) => f.key === key)?.label ?? key;
}

export function planFeatures(features: string | null | undefined) {
  return new Set((features ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export function limitLabel(n: number, unit = "") {
  return n === 0 ? "Unlimited" : `${n.toLocaleString("en-IN")}${unit}`;
}
