/** Scores how well a property matches a lead's requirement (0-100). */
export function matchScore(
  lead: { purpose: string; propertyType: string | null; bedrooms: number | null; budgetMin: number | null; budgetMax: number | null; preferredLocation: string | null },
  p: { listingType: string; type: string; bedrooms: number | null; price: number; city: string; locality: string | null },
) {
  const wantRent = lead.purpose === "RENT";
  if ((p.listingType === "RENT") !== wantRent) return 0;
  let score = 20;
  if (lead.budgetMax) {
    const min = (lead.budgetMin ?? 0) * 0.85;
    const max = lead.budgetMax * 1.1;
    if (p.price >= min && p.price <= max) score += 35;
    else if (p.price <= lead.budgetMax * 1.25) score += 10;
    else return 0;
  } else score += 15;
  if (lead.propertyType) {
    if (lead.propertyType === p.type) score += 20;
    else score -= 10;
  } else score += 10;
  if (lead.bedrooms && p.bedrooms) score += lead.bedrooms === p.bedrooms ? 15 : Math.abs(lead.bedrooms - p.bedrooms) === 1 ? 5 : 0;
  if (lead.preferredLocation) {
    const loc = lead.preferredLocation.toLowerCase();
    if (p.locality && loc.includes(p.locality.toLowerCase())) score += 15;
    else if (loc.includes(p.city.toLowerCase())) score += 8;
  }
  return Math.max(0, Math.min(100, score));
}
