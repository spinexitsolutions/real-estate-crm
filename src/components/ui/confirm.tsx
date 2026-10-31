"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { Modal } from "./modal";
import { getGlobalReadOnlyReason } from "@/components/billing/read-only-context";

type ConfirmProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  action: () => Promise<unknown>;
  successMessage?: string;
  variant?: "danger" | "primary";
};

function isRedirect(e: unknown) {
  return !!e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT");
}

/** Controlled confirmation dialog. Render it OUTSIDE dropdowns/menus so it survives them closing. */
export function ConfirmDialog({ open, onClose, title, description, confirmLabel = "Delete", action, successMessage, variant = "danger" }: ConfirmProps & { open: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <TriangleAlert className={variant === "danger" ? "size-5 text-rose-500" : "size-5 text-amber-500"} />
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={variant}
            loading={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = (await action()) as { error?: string } | undefined;
                  if (res && typeof res === "object" && "error" in res && res.error) {
                    toast.error(res.error);
                    return;
                  }
                  if (successMessage) toast.success(successMessage);
                  onClose();
                } catch (e) {
                  if (isRedirect(e)) throw e;
                  // Server errors are masked in production; show the real reason when the account is read-only.
                  toast.error(getGlobalReadOnlyReason() ?? "Something went wrong. Please try again.");
                }
              })
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{description ?? "This action cannot be undone."}</p>
    </Modal>
  );
}

/** Wraps a trigger and asks for confirmation before running a server action. Do not place inside a Dropdown (use ConfirmDialog there). */
export function ConfirmAction({ children, ...props }: ConfirmProps & { children: (open: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
