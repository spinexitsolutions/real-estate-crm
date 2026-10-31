import { ShieldOff } from "lucide-react";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <ShieldOff className="size-5" />
        </span>
        <h1 className="text-lg font-semibold text-slate-900">This link is not valid</h1>
        <p className="mt-1 text-sm text-slate-500">The link may have expired or been replaced. Please ask your relationship manager for a new link.</p>
      </div>
    </div>
  );
}
