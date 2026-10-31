"use client";

import { useTransition } from "react";
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { toggleShortlist } from "@/actions/properties";
import { cn } from "@/lib/utils";

export function ShortlistButton({ leadId, propertyId, shortlisted }: { leadId: string; propertyId: string; shortlisted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={shortlisted ? "Remove from shortlist" : "Add to lead's shortlist"}
      onClick={() =>
        start(async () => {
          const res = await toggleShortlist(leadId, propertyId);
          if (res.error) toast.error(res.error);
          else toast.success(res.data?.shortlisted ? "Added to shortlist" : "Removed from shortlist");
        })
      }
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition disabled:opacity-60",
        shortlisted ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : shortlisted ? <BookmarkCheck className="size-4" /> : <BookmarkPlus className="size-4" />}
      {shortlisted ? "Shortlisted" : "Shortlist"}
    </button>
  );
}
