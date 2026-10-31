import { Eye, Undo2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { stopImpersonation } from "@/actions/admin";

/** Shown at the top of the CRM while a platform super admin is logged in as a customer's user. */
export async function ImpersonationBanner() {
  const user = await getCurrentUser();
  if (!user?.impersonatorId) return null;
  const org = await rawDb.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } });
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <Eye className="size-4" />
        You are viewing <strong>{org?.name ?? "this company"}</strong> as <strong>{user.name}</strong>. Changes you make are saved as this user.
      </span>
      <form action={stopImpersonation}>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900">
          <Undo2 className="size-3.5" /> Return to admin
        </button>
      </form>
    </div>
  );
}
