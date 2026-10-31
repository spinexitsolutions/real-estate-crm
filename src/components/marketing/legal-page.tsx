import { TriangleAlert } from "lucide-react";
import { isLegalTemplate } from "@/lib/brand";

/** Wrapper for legal documents (Terms, Privacy, Refunds) with readable typography. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      {isLegalTemplate() && (
        <div className="mb-8 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="note">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Template - review with your lawyer before going live.</span> Set NEXT_PUBLIC_LEGAL_NAME,
            NEXT_PUBLIC_LEGAL_ADDRESS and NEXT_PUBLIC_SUPPORT_EMAIL to fill in your company details and hide this note.
          </p>
        </div>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-brand-600 [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </div>
  );
}
