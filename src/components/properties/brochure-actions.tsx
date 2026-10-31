"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Download, Eye, FileText, Globe, GlobeLock, Link2 } from "lucide-react";
import { publishProperty } from "@/actions/properties";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { WhatsAppIcon } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

/** Text used when sharing a brochure on WhatsApp: property summary followed by the brochure link. */
export function brochureShareText(summary: string, url: string) {
  return `${summary.trim()}\n\nDownload brochure (PDF):\n${url}`;
}

/**
 * Brochure menu for the property page: view, download, share on WhatsApp (pre-filled message with a
 * public, signed brochure link) and copy the link.
 */
export function BrochureActions({ propertyId, title, publicUrl, shareText }: { propertyId: string; title: string; publicUrl: string; shareText?: string }) {
  const text = brochureShareText(shareText || title, publicUrl);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Brochure link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };
  return (
    <Dropdown
      className="w-60"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className={buttonClass("secondary")}>
          <FileText /> Brochure <ChevronDown className="opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <>
          <DropdownItem icon={Eye} href={`/api/properties/${propertyId}/brochure`} target="_blank" onClick={close}>
            View PDF
          </DropdownItem>
          <DropdownItem icon={Download} href={`/api/properties/${propertyId}/brochure?download=1`} onClick={close}>
            Download PDF
          </DropdownItem>
          <DropdownItem icon={WhatsAppIcon} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" onClick={close}>
            Share on WhatsApp
          </DropdownItem>
          <DropdownItem
            icon={Link2}
            onClick={() => {
              close();
              void copy();
            }}
          >
            Copy brochure link
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}

/** Publish / unpublish a property on the public website. */
export function PublishToggle({ id, published, siteUrl }: { id: string; published: boolean; siteUrl: string }) {
  const router = useRouter();
  const [on, setOn] = useState(published);
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const next = !on;
            setOn(next);
            const res = await publishProperty(id, next);
            if (res.error) {
              setOn(!next);
              return void toast.error(res.error);
            }
            toast.success(next ? "Published on your website" : "Removed from your website");
            router.refresh();
          })
        }
        className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium transition disabled:opacity-60", on ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-600 hover:bg-slate-50")}
        title={on ? "Click to remove from the public website" : "Click to show on the public website"}
      >
        {on ? <Globe className="size-4" /> : <GlobeLock className="size-4" />}
        {on ? "On website" : "Not on website"}
      </button>
      {on && (
        <a href={siteUrl} target="_blank" rel="noreferrer" className="flex h-9 items-center border-l border-slate-200 px-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700" title="Open public page">
          <Eye className="size-4" />
        </a>
      )}
    </div>
  );
}
