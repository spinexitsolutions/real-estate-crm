"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UserCog,
  Users,
  Handshake,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { buttonClass } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";
import { formatDueLabel } from "@/lib/format";
import { labelOf, FOLLOWUP_TYPES, ROLES } from "@/lib/constants";
import { MobileSidebar, SidebarContent } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { PushPrompt } from "@/components/notifications/push-toggle";
import { ReminderPoller } from "@/components/notifications/reminder-poller";

export type ShellNotification = {
  id: string;
  title: string;
  type: string;
  dueAt: string;
  leadId: string;
  leadName: string;
  overdue: boolean;
};

export function AppShell({
  user,
  company,
  notifications,
  followupCount,
  whatsappUnread = 0,
  children,
}: {
  user: { name: string; email: string; role: string };
  company: string;
  notifications: ShellNotification[];
  followupCount: number;
  whatsappUnread?: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Suspense>
          <SidebarContent role={user.role} company={company} followupCount={followupCount} whatsappUnread={whatsappUnread} />
        </Suspense>
      </aside>
      <Suspense>
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} role={user.role} company={company} followupCount={followupCount} whatsappUnread={whatsappUnread} />
      </Suspense>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left"><span className="sm:hidden">Search...</span><span className="hidden sm:inline">Search leads, properties, deals...</span></span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500 sm:inline">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Dropdown
              trigger={({ toggle }) => (
                <button onClick={toggle} className={buttonClass("primary", "md", "px-2.5 sm:px-3.5")}>
                  <Plus /> <span className="hidden sm:inline">Quick add</span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <QuickLink href="/leads?new=1" icon={Users} label="New lead" onClick={close} />
                  <QuickLink href="/properties/new" icon={Building2} label="New property" onClick={close} />
                  <QuickLink href="/follow-ups?new=1" icon={CalendarClock} label="New follow-up" onClick={close} />
                  <QuickLink href="/deals?new=1" icon={Handshake} label="New deal" onClick={close} />
                </>
              )}
            </Dropdown>

            <Dropdown
              className="w-[22rem] p-0"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Notifications">
                  <Bell className="size-5" />
                  {followupCount > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
                </button>
              )}
            >
              {(close) => (
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Reminders</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{followupCount} due</span>
                  </div>
                  <PushPrompt />
                  <div className="max-h-80 overflow-y-auto p-1">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-500">You are all caught up.</p>
                    ) : (
                      notifications.map((n) => (
                        <Link key={n.id} href={`/leads/${n.leadId}`} onClick={close} className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.overdue ? "bg-rose-500" : "bg-amber-500")} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                            <p className="truncate text-xs text-slate-500">
                              {labelOf(FOLLOWUP_TYPES, n.type)} with {n.leadName}
                            </p>
                            <p className={cn("mt-0.5 text-xs font-medium", n.overdue ? "text-rose-600" : "text-amber-600")}>
                              {n.overdue ? "Overdue - " : ""}
                              {formatDueLabel(n.dueAt)}
                            </p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link href="/follow-ups" onClick={close} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50">
                    View all follow-ups
                  </Link>
                </div>
              )}
            </Dropdown>

            <Dropdown
              trigger={({ toggle }) => (
                <button onClick={toggle} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100">
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden text-left md:block">
                    <span className="block text-[13px] font-medium leading-tight text-slate-800">{user.name}</span>
                    <span className="block text-[11px] leading-tight text-slate-500">{labelOf(ROLES, user.role)}</span>
                  </span>
                  <ChevronDown className="hidden size-4 text-slate-400 md:block" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <QuickLink href="/profile" icon={UserCog} label="My profile" onClick={close} />
                    {user.role === "ADMIN" && <QuickLink href="/settings" icon={Settings} label="Settings" onClick={close} />}
                  </div>
                  <form action={logout} className="border-t border-slate-100 pt-1">
                    <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 hover:bg-rose-50">
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </form>
                </>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
      <ReminderPoller />
    </div>
  );
}

function QuickLink({ href, icon, label, onClick }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  const Icon = icon;
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100">
      <Icon className="size-4 text-slate-500" />
      {label}
    </Link>
  );
}

