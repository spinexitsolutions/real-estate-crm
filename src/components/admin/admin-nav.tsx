"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, LayoutDashboard, Layers, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/companies", label: "Companies", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/invoices", label: "Invoices", icon: CreditCard },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
            )}
          >
            <i.icon className={cn("size-[18px]", active ? "text-amber-300" : "text-zinc-500")} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
