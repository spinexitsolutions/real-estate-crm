import "server-only";
import { rawDb } from "./db";

export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxLeads: number;
  maxProperties: number;
  storageGb: number;
  features: string[];
  highlighted: boolean;
};

/** Active plans for the pricing page (platform-level data, so read with the unscoped client). */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await rawDb.plan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] });
    return plans.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      maxUsers: p.maxUsers,
      maxLeads: p.maxLeads,
      maxProperties: p.maxProperties,
      storageGb: p.storageGb,
      features: p.features.split(",").map((s) => s.trim()).filter(Boolean),
      highlighted: p.highlighted,
    }));
  } catch (e) {
    console.error("Could not load plans", e);
    return [];
  }
}
