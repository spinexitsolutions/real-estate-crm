import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { PropertyForm } from "@/components/properties/property-form";

export const metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const user = await requireUser();
  const [users, settings] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title="Add property" description="List a new property in your inventory." icon={Building2} />
      <PropertyForm users={users} currentUserId={user.id} currency={settings.currency} />
    </>
  );
}
