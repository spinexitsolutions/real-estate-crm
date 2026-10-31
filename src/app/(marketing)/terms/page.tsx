import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, legalEntity } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of Service", description: `Terms that govern the use of ${BRAND.name}.` };

export default function TermsPage() {
  const co = legalEntity();
  return (
    <LegalPage title="Terms of Service" updated="1 November 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of {BRAND.name} (the &quot;Service&quot;), a cloud-based customer
        relationship management software for real estate businesses, operated by {co}
        {BRAND.address ? `, ${BRAND.address}` : ""} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account or using the Service you
        agree to these Terms on behalf of yourself and the business you represent (&quot;Customer&quot;, &quot;you&quot;).
      </p>

      <h2>1. Accounts</h2>
      <ul>
        <li>You must provide accurate information and be at least 18 years old and authorised to bind your business.</li>
        <li>You are responsible for all activity under your account and for keeping passwords confidential. Inform us immediately of any unauthorised use.</li>
        <li>The administrator of your workspace controls user access, roles and data within your workspace.</li>
      </ul>

      <h2>2. Free trial</h2>
      <p>
        New workspaces may receive a free trial. At the end of the trial your data is retained, but creating or editing records is paused until you
        subscribe to a paid plan. We may change or end trial offers at any time.
      </p>

      <h2>3. Subscriptions, fees and taxes</h2>
      <ul>
        <li>Paid plans are billed in advance on a monthly or yearly basis at the prices shown on our pricing page at the time of purchase.</li>
        <li>All fees are in Indian Rupees and exclusive of applicable taxes, including GST, which will be added to your invoice.</li>
        <li>Payments are processed by our payment partner Razorpay. By subscribing you authorise recurring charges (for example via UPI AutoPay or card mandate) until you cancel.</li>
        <li>If a payment fails we may retry it and, after a short grace period, restrict your workspace to read-only access until payment is completed.</li>
        <li>We may change prices with at least 30 days&apos; notice; changes apply from your next billing period.</li>
      </ul>

      <h2>4. Cancellation</h2>
      <p>
        You can cancel at any time from the Billing page. Cancellation takes effect at the end of the current billing period. Refunds are governed by
        our <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link>.
      </p>

      <h2>5. Your data</h2>
      <ul>
        <li>You own all data you and your users enter into the Service, including leads, contacts, properties and documents (&quot;Customer Data&quot;).</li>
        <li>You grant us a limited licence to host, process and transmit Customer Data solely to provide and improve the Service and as described in our <Link href="/privacy">Privacy Policy</Link>.</li>
        <li>You are responsible for having a lawful basis, including any consent required under the Digital Personal Data Protection Act, 2023, to collect and process the personal data of your customers and leads, and for complying with telemarketing (TRAI / DND) rules when contacting them.</li>
        <li>You can export your data at any time. After an account is closed we may delete Customer Data after 90 days.</li>
      </ul>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>send spam or unsolicited bulk messages, or messages that violate WhatsApp, Meta, telecom or other third-party policies;</li>
        <li>upload unlawful, infringing or harmful content, or data you have no right to process;</li>
        <li>attempt to access other customers&apos; data, probe or disrupt the Service, or reverse engineer it;</li>
        <li>resell or provide the Service to third parties without our written consent.</li>
      </ul>

      <h2>7. Third-party services</h2>
      <p>
        The Service integrates with third-party services such as WhatsApp Business API, property portals, telephony providers and payment gateways.
        Your use of those services is governed by their own terms, and we are not responsible for their availability or conduct.
      </p>

      <h2>8. Availability and support</h2>
      <p>
        We aim to keep the Service available at all times but do not guarantee uninterrupted access. Planned maintenance will be notified where
        practical. Support is available at <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
      </p>

      <h2>9. Warranties and liability</h2>
      <p>
        The Service is provided &quot;as is&quot;. To the maximum extent permitted by law, we disclaim all implied warranties, and our total liability for any
        claim relating to the Service is limited to the fees you paid us in the 12 months before the claim. We are not liable for indirect or
        consequential losses, including lost profits, lost deals or loss of data caused by your actions.
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        We may suspend or terminate access if you materially breach these Terms, fail to pay, or if required by law. You may close your account at
        any time.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Courts at the city of our registered office shall have exclusive jurisdiction, subject to any
        mandatory consumer protection rules.
      </p>

      <h2>12. Changes and contact</h2>
      <p>
        We may update these Terms. Material changes will be notified by email or in the app at least 15 days in advance. Questions:{" "}
        <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        {BRAND.supportPhone ? `, ${BRAND.supportPhone}` : ""}.
      </p>
    </LegalPage>
  );
}
