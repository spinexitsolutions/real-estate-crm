import { Ban, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";

export function SuspendedScreen({ supportEmail, supportPhone }: { supportEmail?: string | null; supportPhone?: string | null }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Ban className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">This account is suspended</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Access to this workspace has been paused. Your data has not been deleted. Please contact support to restore access.
        </p>
        {(supportEmail || supportPhone) && (
          <p className="mt-4 text-sm text-slate-700">
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="font-medium text-brand-600 hover:underline">
                {supportEmail}
              </a>
            )}
            {supportEmail && supportPhone && <span className="mx-2 text-slate-300">|</span>}
            {supportPhone && (
              <a href={`tel:${supportPhone}`} className="font-medium text-brand-600 hover:underline">
                {supportPhone}
              </a>
            )}
          </p>
        )}
        <form action={logout} className="mt-6">
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
