import "server-only";
import { cache } from "react";
import { currentOrgId, db, rawDb } from "./db";
import { orgAccess } from "./tenancy";
import {
  FEATURES,
  type FeatureKey,
  type LimitKind,
  cheapestPlanWith,
  hasFeature,
  limitMessage,
  limitOf,
  planFeatures,
  remainingCapacity,
} from "./billing-core";

export { FEATURES, type FeatureKey };

/** The current organization with its plan (cached per request). */
export const getOrgPlan = cache(async (orgId?: string) => {
  const id = orgId ?? (await currentOrgId());
  if (!id) return null;
  return rawDb.organization.findUnique({ where: { id }, include: { plan: true } });
});

export const getActivePlans = cache(async () => rawDb.plan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] }));

/** Feature keys available to the current organization. */
export async function orgFeatures(): Promise<FeatureKey[]> {
  const org = await getOrgPlan();
  return planFeatures(org?.plan);
}

export async function orgHasFeature(key: FeatureKey) {
  const org = await getOrgPlan();
  return hasFeature(org?.plan, key);
}

export type FeatureLock = { feature: FeatureKey; featureLabel: string; currentPlan: string | null; upgradePlan: string | null };

/**
 * Page guard. Returns null when allowed, otherwise details for <UpgradeRequired />:
 *   const lock = await requireFeature("bookings"); if (lock) return <UpgradeRequired {...lock} />;
 */
export async function requireFeature(key: FeatureKey): Promise<FeatureLock | null> {
  const org = await getOrgPlan();
  if (hasFeature(org?.plan, key)) return null;
  const up = cheapestPlanWith(await getActivePlans(), key);
  return { feature: key, featureLabel: FEATURES[key], currentPlan: org?.plan?.name ?? null, upgradePlan: up?.name ?? null };
}

/** Current usage counts for the organization. */
export async function orgUsage() {
  const [users, leads, properties] = await Promise.all([db.user.count({ where: { active: true } }), db.lead.count(), db.property.count()]);
  return { users, leads, properties };
}

async function used(kind: LimitKind) {
  if (kind === "users") return db.user.count({ where: { active: true } });
  if (kind === "leads") return db.lead.count();
  return db.property.count();
}

/** How many more `kind` the org can add (Infinity = unlimited). */
export async function capacityLeft(kind: LimitKind) {
  const org = await getOrgPlan();
  const limit = limitOf(org?.plan, kind);
  if (!limit) return Infinity;
  return remainingCapacity(limit, await used(kind));
}

/** Returns an error message when adding `adding` more `kind` would exceed the plan limit, else null. */
export async function assertWithinLimit(kind: LimitKind, adding = 1): Promise<string | null> {
  const org = await getOrgPlan();
  const limit = limitOf(org?.plan, kind);
  if (!limit || !org?.plan) return null;
  const left = remainingCapacity(limit, await used(kind));
  if (left >= adding) return null;
  return limitMessage(org.plan.name, kind, limit);
}

/** Human reason why the organization is read-only right now, or null when writes are allowed. */
export function readOnlyReasonFor(org: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null } | null | undefined): string | null {
  if (!org) return null;
  const a = orgAccess(org);
  if (!a.readOnly) return null;
  switch (a.state) {
    case "suspended":
      return "This account is suspended. Please contact support.";
    case "trial_expired":
      return "Your free trial has ended. Choose a plan to continue making changes.";
    case "past_due":
      return "Your last payment failed. Update your payment to continue making changes.";
    default:
      return "Your subscription has ended. Choose a plan to continue making changes.";
  }
}

/**
 * Call at the top of mutating server actions: returns a readable reason when the org cannot
 * make changes (the database layer enforces the same rule as a backstop).
 */
export async function guardWritable(): Promise<string | null> {
  const org = await getOrgPlan();
  return readOnlyReasonFor(org);
}
