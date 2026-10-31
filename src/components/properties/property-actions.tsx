"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Copy, Ellipsis, Pencil, Share2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProperty, toggleFeatured, updatePropertyStatus } from "@/actions/properties";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { WhatsAppIcon } from "@/components/ui/icons";
import { PROPERTY_STATUSES, optionOf } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PropertyStatusMenu({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const current = optionOf(PROPERTY_STATUSES, status);
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition", current?.color)}
        >
          <span className={cn("size-1.5 rounded-full", current?.dot)} />
          {current?.label ?? status}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      )}
    >
      {(close) =>
        PROPERTY_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              close();
              if (s.value === status) return;
              start(async () => {
                const res = await updatePropertyStatus(id, s.value);
                if (res.error) toast.error(res.error);
                else toast.success(`Marked as ${s.label}`);
              });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <span className={cn("size-2 rounded-full", s.dot)} />
            <span className="flex-1">{s.label}</span>
            {s.value === status && <Check className="size-4 text-brand-600" />}
          </button>
        ))
      }
    </Dropdown>
  );
}

export function PropertyShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#25D366] px-3.5 text-sm font-medium text-white shadow-xs transition hover:bg-[#1ebe5a]"
      >
        <WhatsAppIcon className="size-4" /> Share
      </a>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Property details copied");
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Could not copy to clipboard");
          }
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy details"}
      </Button>
    </>
  );
}

export function PropertyMoreMenu({ id, featured, canDelete }: { id: string; featured: boolean; canDelete: boolean }) {
  const [, start] = useTransition();
  return (
    <ConfirmAction
      title="Delete property?"
      description="This permanently removes the property, its shortlist entries and activity. Deals linked to it will be kept without a property."
      action={() => deleteProperty(id)}
      successMessage="Property deleted"
    >
      {(openConfirm) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/properties/${id}/edit`} variant="secondary">
            <Pencil /> Edit
          </LinkButton>
          <Dropdown
            trigger={({ toggle }) => (
              <Button variant="secondary" size="icon" onClick={toggle} aria-label="More actions">
                <Ellipsis />
              </Button>
            )}
          >
            {(close) => (
              <>
                <DropdownItem
                  icon={Star}
                  onClick={() => {
                    close();
                    start(async () => {
                      const res = await toggleFeatured(id);
                      if (res.error) toast.error(res.error);
                      else toast.success(featured ? "Removed from featured" : "Marked as featured");
                    });
                  }}
                >
                  {featured ? "Remove from featured" : "Mark as featured"}
                </DropdownItem>
                <DropdownItem
                  icon={Share2}
                  onClick={async () => {
                    close();
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied");
                    } catch {
                      toast.error("Could not copy link");
                    }
                  }}
                >
                  Copy CRM link
                </DropdownItem>
                {canDelete && (
                  <DropdownItem
                    icon={Trash2}
                    danger
                    onClick={() => {
                      close();
                      openConfirm();
                    }}
                  >
                    Delete property
                  </DropdownItem>
                )}
              </>
            )}
          </Dropdown>
        </div>
      )}
    </ConfirmAction>
  );
}

export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  if (images.length === 0) return null;
  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-slate-100">
        {broken[active] ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Image unavailable</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[active]} alt={title} className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [active]: true }))} />
        )}
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-md bg-slate-900/70 px-2 py-0.5 text-xs font-medium text-white">
            {active + 1} / {images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === active ? "border-brand-500" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
