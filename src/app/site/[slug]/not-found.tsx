"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";

export default function SiteNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <SearchX className="size-12 text-slate-300" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This page is no longer available</h1>
      <p className="mt-2 text-slate-500">The property may have been sold or removed. Browse our other listings or tell us what you need.</p>
      <Link href={`/site/${slug}/properties`} className="mt-6 inline-flex h-11 items-center rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:brightness-110">
        View all properties
      </Link>
    </div>
  );
}
