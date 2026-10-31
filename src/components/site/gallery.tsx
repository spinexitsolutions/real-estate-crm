"use client";

import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteGallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  if (!images.length)
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
        <Building2 className="size-14" />
      </div>
    );
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={`${title} photo ${i + 1}`} className="size-full object-cover" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-md bg-slate-900/70 px-2 py-1 text-xs font-medium text-white">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, k) => (
            <button key={src + k} type="button" onClick={() => setI(k)} className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-1 transition", k === i ? "ring-[var(--brand)]" : "ring-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
