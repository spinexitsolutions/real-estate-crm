import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, legalEntity } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Cancellation & Refund Policy", description: `Cancellation and refund terms for ${BRAND.name} subscriptions.` };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Cancellation & Refund Policy" updated="1 November 2026">
      <p>
        This policy applies to subscriptions to {BRAND.name} purchased from {legalEntity()}. We want you to be confident before you pay, which is why
        every new workspace starts with a {TRIAL_DAYS}-day free trial with no payment details required.
      </p>

      <h2>1. Cancelling your subscription</h2>
      <ul>
        <li>You can cancel any time from Billing in the app, or by emailing <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> from your registered email.</li>
        <li>Cancellation stops future renewals and any UPI AutoPay or card mandate. You keep full access until the end of the period you have already paid for.</li>
        <li>After that your workspace becomes read-only. You can still sign in and export your data.</li>
      </ul>

      <h2>2. Refunds</h2>
      <ul>
        <li>
          <strong>First payment:</strong> if you are not satisfied, request a refund within 7 days of your first paid subscription payment and we will
          refund it in full.
        </li>
        <li>
          <strong>Yearly plans:</strong> if you cancel a yearly plan within 30 days of payment, we refund the unused months on a pro-rata basis, less
          the value of any discount you received for paying yearly.
        </li>
        <li><strong>Monthly renewals</strong> are non-refundable, but you can cancel any time to avoid the next charge.</li>
        <li><strong>Duplicate or erroneous charges</strong> are always refunded in full once verified.</li>
        <li>Fees paid to third parties you connect (for example WhatsApp conversation charges or telephony usage) are billed by those providers and are not refundable by us.</li>
      </ul>

      <h2>3. How refunds are paid</h2>
      <p>
        Approved refunds are processed within 5-7 business days to the original payment method through Razorpay. Your bank may take a few additional
        days to credit the amount. GST is refunded with a credit note where applicable.
      </p>

      <h2>4. Plan changes</h2>
      <p>
        Upgrades take effect immediately and are charged pro-rata. Downgrades take effect from the next billing period. If your usage exceeds the
        limits of a lower plan, you may need to remove users or records before downgrading.
      </p>

      <h2>5. Contact</h2>
      <p>
        For cancellations, refunds or billing questions write to <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        {BRAND.supportPhone ? ` or call ${BRAND.supportPhone}` : ""}. Please include your registered email and company name.
      </p>
    </LegalPage>
  );
}
