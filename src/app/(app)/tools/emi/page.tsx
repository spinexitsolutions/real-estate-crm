import { Calculator } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { EmiCalculator } from "./emi-calculator";

export const metadata = { title: "EMI Calculator" };

export default async function EmiPage() {
  await requireUser();
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="EMI Calculator" description="Help clients plan their home loan and check affordability in seconds" icon={Calculator} />
      <EmiCalculator currency={s.currency} company={s.companyName} />
    </div>
  );
}
