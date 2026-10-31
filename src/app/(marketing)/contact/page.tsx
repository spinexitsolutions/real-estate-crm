import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { isEmailConfigured } from "@/lib/email";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact us", description: `Talk to the ${BRAND.name} team about demos, pricing, support or billing.` };

export default function ContactPage() {
  const formEnabled = isEmailConfigured();
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:px-8 lg:py-20">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Talk to us</h1>
        <p className="mt-4 text-lg text-slate-600">Want a demo, help moving from Excel, or have a billing question? We are happy to help.</p>
        <ul className="mt-10 space-y-5">
          <li className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Mail className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">Email</p>
              <a href={`mailto:${BRAND.supportEmail}`} className="text-sm text-brand-600 hover:underline">
                {BRAND.supportEmail}
              </a>
            </div>
          </li>
          {BRAND.supportPhone && (
            <li className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Phone className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">Phone / WhatsApp</p>
                <a href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`} className="text-sm text-brand-600 hover:underline">
                  {BRAND.supportPhone}
                </a>
              </div>
            </li>
          )}
          {BRAND.address && (
            <li className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">Office</p>
                <p className="text-sm text-slate-600">{BRAND.address}</p>
              </div>
            </li>
          )}
          <li className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">Hours</p>
              <p className="text-sm text-slate-600">Monday to Saturday, 10 AM - 7 PM IST</p>
            </div>
          </li>
        </ul>
      </div>
      {formEnabled ? (
        <ContactForm />
      ) : (
        <div className="flex flex-col items-start justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-lg font-semibold text-slate-900">Write to us</h2>
          <p className="mt-2 text-sm text-slate-600">Email us and we will reply within one business day.</p>
          <a
            href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`Enquiry about ${BRAND.name}`)}`}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Mail className="size-4" /> {BRAND.supportEmail}
          </a>
        </div>
      )}
    </div>
  );
}
