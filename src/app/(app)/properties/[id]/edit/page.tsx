import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseImages, splitList } from "@/lib/utils";
import { PageHeader } from "@/components/ui/card";
import { PropertyForm } from "@/components/properties/property-form";

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [property, users, settings] = await Promise.all([
    db.property.findUnique({ where: { id } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  if (!property) notFound();
  return (
    <>
      <PageHeader title="Edit property" description={`${property.code} - ${property.title}`} icon={Pencil} />
      <PropertyForm
        users={users}
        currentUserId={user.id}
        currency={settings.currency}
        property={{ ...property, amenities: splitList(property.amenities), images: parseImages(property.images) }}
      />
    </>
  );
}
