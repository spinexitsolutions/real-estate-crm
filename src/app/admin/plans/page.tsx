import { Layers } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin, FEATURE_KEYS } from "@/lib/admin";
import { splitList } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";
import { PlansManager } from "./plans-client";

export const metadata = { title: "Plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireSuperAdmin();
  const plans = await rawDb.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }], include: { _count: { select: { organizations: true } } } });
  return (
    <>
      <PageHeader icon={Layers} title="Plans" description="Pricing, limits and features shown on the pricing page" />
      <PlansManager
        featureKeys={FEATURE_KEYS}
        plans={plans.map(({ _count, features, createdAt: _c, updatedAt: _u, ...p }) => ({ ...p, features: splitList(features), companies: _count.organizations }))}
      />
    </>
  );
}
