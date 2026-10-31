import { headers } from "next/headers";
import { Settings } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { SettingsForms } from "./settings-forms";
import { NotificationsStatusCard } from "@/components/settings/notifications-status-card";
import { BackupCard } from "@/components/settings/backup-card";
import { BrandingCard } from "@/components/settings/branding-card";
import { WebsiteCard } from "@/components/settings/website-card";
import { TelephonyCard } from "@/components/settings/telephony-card";
import { PaymentSettingsCard } from "@/components/settings/payment-settings-card";
import { db } from "@/lib/db";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const s = await getSettings();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const publishedCount = await db.property.count({ where: { published: true, status: { in: ["AVAILABLE", "RESERVED"] } } });

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
      <div className="mt-6 grid gap-6">
        <BrandingCard logoUrl={s.logoUrl} brandColor={s.brandColor} reraNumber={s.reraNumber} />
        <WebsiteCard origin={origin} enabled={s.websiteEnabled} tagline={s.websiteTagline} about={s.websiteAbout} publishedCount={publishedCount} />
        <PaymentSettingsCard receiptPrefix={s.receiptPrefix} nextReceiptNo={s.nextReceiptNo} waPaymentTemplate={s.waPaymentTemplate} />
        <TelephonyCard
          origin={origin}
          settings={{
            telephonyProvider: s.telephonyProvider,
            exotelSid: s.exotelSid,
            exotelSubdomain: s.exotelSubdomain,
            exotelCallerId: s.exotelCallerId,
            hasExotelKey: !!s.exotelApiKey,
            hasExotelToken: !!s.exotelApiToken,
            knowlaritySrNumber: s.knowlaritySrNumber,
            knowlarityCallerId: s.knowlarityCallerId,
            hasKnowlarityKey: !!s.knowlarityApiKey,
            hasKnowlarityAuth: !!s.knowlarityAuthToken,
            telephonyWebhookKey: s.telephonyWebhookKey,
          }}
        />
        <NotificationsStatusCard />
        <BackupCard />
      </div>
    </div>
  );
}
