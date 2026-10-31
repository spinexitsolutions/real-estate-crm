import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="text-[17px] font-semibold tracking-tight text-slate-900">{BRAND.name}</span>
          </span>
          <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Skip setup for now
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
