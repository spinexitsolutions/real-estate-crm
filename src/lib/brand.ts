/** Product branding for the SaaS. Configure with NEXT_PUBLIC_* env vars (safe on client and server). */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "EstateDesk",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "The real estate CRM that helps you follow up faster and close more deals",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@estatedesk.in",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "",
  website: process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "",
  gstin: process.env.NEXT_PUBLIC_GSTIN || "",
};

/** Legal entity name for legal pages; falls back to the product name. */
export const legalEntity = () => BRAND.legalName || `${BRAND.name} (operator name to be added)`;
export const isLegalTemplate = () => !process.env.NEXT_PUBLIC_LEGAL_NAME;
