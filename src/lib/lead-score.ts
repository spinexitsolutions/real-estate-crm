import { differenceInDays } from "date-fns";

/**
 * Simple explainable lead score (0-100). Higher means more likely to convert.
 * Combines intent (priority), pipeline stage, recency of contact, budget clarity
 * and completeness of requirement.
 */
export function leadScore(lead: {
  priority: string;
  status: string;
  lastContactedAt: Date | string | null;
  createdAt: Date | string;
  budgetMax: number | null;
  email: string | null;
  propertyType: string | null;
  preferredLocation: string | null;
}) {
  if (lead.status === "WON") return 100;
  if (lead.status === "LOST") return 0;
  let s = 0;
  s += { HOT: 30, WARM: 18, COLD: 6 }[lead.priority] ?? 10;
  s += { NEW: 5, CONTACTED: 12, QUALIFIED: 20, SITE_VISIT: 28, NEGOTIATION: 35 }[lead.status] ?? 0;
  const ref = lead.lastContactedAt ?? lead.createdAt;
  const days = differenceInDays(new Date(), new Date(ref));
  s += days <= 2 ? 15 : days <= 7 ? 10 : days <= 21 ? 5 : 0;
  if (lead.budgetMax) s += 8;
  if (lead.email) s += 4;
  if (lead.propertyType) s += 4;
  if (lead.preferredLocation) s += 4;
  return Math.max(0, Math.min(99, s));
}

export function scoreTone(score: number) {
  if (score >= 70) return { label: "High", bar: "bg-emerald-500", text: "text-emerald-700" };
  if (score >= 40) return { label: "Medium", bar: "bg-amber-500", text: "text-amber-700" };
  return { label: "Low", bar: "bg-slate-400", text: "text-slate-600" };
}
