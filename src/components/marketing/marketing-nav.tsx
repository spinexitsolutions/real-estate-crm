"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LogoMark } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function MarketingNav({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${name} home`}>
          <LogoMark className="size-8" />
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">{name}</span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClass("ghost", "md")}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass("primary", "md")}>
            Start free trial
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <div className={cn("border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden", open ? "block" : "hidden")}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {l.label}
          </Link>
        ))}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/login" className={buttonClass("secondary", "md")}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass("primary", "md")}>
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}
