"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/icons";
import { NAV_SECTIONS } from "./nav";

export function SidebarContent({
  role,
  company,
  followupCount,
  whatsappUnread = 0,
  logoUrl,
  onNavigate,
}: {
  role: string;
  company: string;
  followupCount: number;
  whatsappUnread?: number;
  logoUrl?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <div className="flex h-full flex-col bg-[#0b1020] text-slate-300">
      <div className="flex h-16 items-center gap-2.5 px-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        ) : (
          <LogoMark className="size-8" />
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-white">EstateDesk</p>
          <p className="truncate text-[11px] text-slate-400">{company}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.roles || i.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">{section.title}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = item.match
                    ? item.match(pathname, search)
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
                        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                      )}
                    >
                      <Icon className={cn("size-[18px]", active ? "text-brand-200" : "text-slate-500 group-hover:text-slate-300")} />
                      <span className="flex-1">{item.label}</span>
                      {item.badgeKey === "whatsapp" && whatsappUnread > 0 && (
                        <span className="rounded-full bg-emerald-500 px-1.5 py-px text-[11px] font-semibold text-white">{whatsappUnread > 99 ? "99+" : whatsappUnread}</span>
                      )}
                      {item.badgeKey === "followups" && followupCount > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-px text-[11px] font-semibold text-white">{followupCount > 99 ? "99+" : followupCount}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileSidebar(props: React.ComponentProps<typeof SidebarContent> & { open: boolean; onClose: () => void }) {
  const { open, onClose, ...rest } = props;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative h-full w-72 shadow-pop">
        <button onClick={onClose} className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="Close menu">
          <X className="size-5" />
        </button>
        <SidebarContent {...rest} onNavigate={onClose} />
      </div>
    </div>
  );
}
