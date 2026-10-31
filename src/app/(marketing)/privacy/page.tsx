import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND, legalEntity } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy", description: `How ${BRAND.name} collects, uses and protects personal data.` };

export default function PrivacyPage() {
  const co = legalEntity();
  return (
    <LegalPage title="Privacy Policy" updated="1 November 2026">
      <p>
        This Privacy Policy explains how {co} (&quot;we&quot;, &quot;us&quot;) handles personal data in connection with {BRAND.name} (the &quot;Service&quot;), in line
        with the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;) and the Information Technology Act, 2000 and rules made under it.
      </p>

      <h2>1. Two kinds of data</h2>
      <ul>
        <li>
          <strong>Account data</strong> - information about you and your team that we collect to run your account: names, work email, mobile number,
          company details, billing details and usage information. For this data we are the Data Fiduciary.
        </li>
        <li>
          <strong>Customer Data</strong> - information your business stores in the Service about its leads, buyers, owners and properties. For this
          data your business is the Data Fiduciary and we act as its Data Processor, processing it only on your instructions to provide the Service.
        </li>
      </ul>

      <h2>2. What we collect</h2>
      <ul>
        <li>Information you give us when you sign up, contact us or pay (name, email, phone, company, GSTIN).</li>
        <li>Usage and device data such as log-in times, IP address, browser type and pages used, to keep the Service secure and improve it.</li>
        <li>Location, only when a user chooses to check in for attendance or a site visit.</li>
        <li>Payment information is collected and processed by Razorpay; we do not store full card or bank details.</li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To provide, maintain and secure the Service, including reminders, notifications and support.</li>
        <li>To process payments, issue GST invoices and meet legal and tax obligations.</li>
        <li>To send service and billing emails. Marketing emails are sent only with your consent and you can opt out any time.</li>
        <li>To understand aggregate usage and improve features. We do not sell personal data.</li>
      </ul>

      <h2>4. Sharing</h2>
      <p>We share data only with service providers who help us run the Service, under confidentiality and data protection obligations, such as:</p>
      <ul>
        <li>cloud hosting and database providers (for example Vercel and Supabase);</li>
        <li>payment processing (Razorpay);</li>
        <li>email, push notification and messaging providers, and integrations you choose to connect (WhatsApp Business API, Exotel, Knowlarity, property portals).</li>
      </ul>
      <p>We may disclose data if required by law or to protect rights, safety and the integrity of the Service.</p>

      <h2>5. Security</h2>
      <p>
        Each customer&apos;s workspace is logically isolated. Data is encrypted in transit (HTTPS), passwords are hashed, documents are stored in private
        storage with time-limited links, and access is restricted by role. No system is perfectly secure; we will notify affected customers and
        authorities of personal data breaches as required by law.
      </p>

      <h2>6. Retention</h2>
      <p>
        We keep account data while your account is active and as required for tax and legal purposes. Customer Data is deleted within 90 days after
        an account is closed, unless the law requires us to keep it longer. Backups are overwritten on a rolling basis.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Under the DPDP Act you may request access to, correction or erasure of your personal data, withdraw consent, and nominate another person to
        exercise your rights. If your data is held by one of our customers (for example, you are a property buyer), please contact that business
        directly; we will assist them in responding.
      </p>

      <h2>8. Grievance Officer</h2>
      <p>
        For questions or complaints contact our Grievance Officer at <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        {BRAND.address ? `, ${BRAND.address}` : ""}. We aim to respond within 7 days and resolve within 30 days. You may also approach the Data
        Protection Board of India.
      </p>

      <h2>9. Changes</h2>
      <p>We may update this policy and will notify you of material changes by email or in the app.</p>
    </LegalPage>
  );
}
