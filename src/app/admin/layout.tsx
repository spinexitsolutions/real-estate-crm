import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = { title: { default: "Admin", template: "%s | Platform Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-zinc-100">
      <aside className="border-b border-white/10 bg-zinc-950 lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4 lg:h-16">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400 text-zinc-950">
            <ShieldCheck className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight text-white">Platform Admin</p>
            <p className="truncate text-[11px] text-zinc-400">{admin.email}</p>
          </div>
        </div>
        <div className="px-3 pb-3 lg:py-4">
          <AdminNav />
        </div>
        <div className="hidden px-3 lg:absolute lg:inset-x-0 lg:bottom-4 lg:block">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
            <ArrowLeft className="size-4" /> Back to my CRM
          </Link>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:pl-[17rem] lg:pr-8 lg:py-8">{children}</main>
    </div>
  );
}
