import { headers } from "next/headers";
import { Settings } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { SettingsForms } from "./settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const s = await getSettings();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your workspace, preferences and integrations" icon={Settings} />
      <SettingsForms
        origin={origin}
        settings={{
          companyName: s.companyName,
          companyPhone: s.companyPhone ?? "",
          companyEmail: s.companyEmail ?? "",
          companyAddress: s.companyAddress ?? "",
          currency: s.currency,
          defaultCountryCode: s.defaultCountryCode,
          defaultCommission: s.defaultCommission,
          waApiEnabled: s.waApiEnabled,
          waPhoneNumberId: s.waPhoneNumberId ?? "",
          hasToken: !!s.waAccessToken,
          leadWebhookKey: s.leadWebhookKey ?? "",
          waVerifyToken: s.waVerifyToken ?? "",
          hasAppSecret: !!s.waAppSecret,
          waDigestTemplate: s.waDigestTemplate ?? "",
        }}
      />
    </div>
  );
}
