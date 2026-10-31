import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rawDb } from "@/lib/db";

/** /site?to=/properties/<id> - sends a signed-in user to their own company's public website. */
export default async function SiteRedirect({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const org = await rawDb.organization.findUnique({ where: { id: user.organizationId }, select: { slug: true } });
  if (!org) redirect("/");
  const { to } = await searchParams;
  const path = to && to.startsWith("/") && !to.startsWith("//") ? to : "";
  redirect(`/site/${org.slug}${path}`);
}
