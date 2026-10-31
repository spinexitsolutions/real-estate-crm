"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Ellipsis, FileDown, RotateCcw, SquarePen, Trash2 } from "lucide-react";
import { cancelBooking, deleteBooking, reactivateBooking, updateBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { toDateInput } from "@/lib/format";

export function BookingActions({
  booking,
  canManage,
  isAdmin,
}: {
  booking: { id: string; bookingNo: string; status: string; unitNumber: string | null; bookingDate: string; agreementDate: string | null; totalAmount: number; notes: string | null };
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <a href={`/api/bookings/${booking.id}/statement`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
        <FileDown /> Statement
      </a>
      <Button variant="secondary" onClick={() => setModal("edit")} disabled={booking.status === "CANCELLED"}>
        <SquarePen /> Edit
      </Button>
      {canManage && (
        <Dropdown
          trigger={({ toggle }) => (
            <Button variant="secondary" size="icon" onClick={toggle} aria-label="More">
              <Ellipsis />
            </Button>
          )}
        >
          {(close) => (
            <>
              {booking.status === "CANCELLED" ? (
                <DropdownItem
                  icon={RotateCcw}
                  onClick={() => {
                    close();
                    start(async () => {
                      const r = await reactivateBooking(booking.id);
                      if (r.error) return void toast.error(r.error);
                      toast.success("Booking reactivated");
                      router.refresh();
                    });
                  }}
                >
                  Reactivate booking
                </DropdownItem>
              ) : (
                <DropdownItem
                  icon={Ban}
                  danger
                  onClick={() => {
                    close();
                    setReason("");
                    setModal("cancel");
                  }}
                >
                  Cancel booking
                </DropdownItem>
              )}
              {isAdmin && (
                <DropdownItem
                  icon={Trash2}
                  danger
                  onClick={() => {
                    close();
                    setModal("delete");
                  }}
                >
                  Delete booking
                </DropdownItem>
              )}
            </>
          )}
        </Dropdown>
      )}

      <Modal
        open={modal === "edit"}
        onClose={() => !pending && setModal(null)}
        title={`Edit ${booking.bookingNo}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                const fd = new FormData(document.getElementById("booking-edit") as HTMLFormElement);
                start(async () => {
                  const r = await updateBooking(booking.id, fd);
                  if (r.error) return void toast.error(r.error);
                  toast.success("Booking updated");
                  setModal(null);
                  router.refresh();
                });
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="booking-edit" onSubmit={(e) => e.preventDefault()} className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit / flat number">
            <Input name="unitNumber" defaultValue={booking.unitNumber ?? ""} />
          </Field>
          <Field label="Total agreement value" hint="The installment schedule is not changed automatically.">
            <Input name="totalAmount" inputMode="numeric" defaultValue={String(Math.round(booking.totalAmount))} />
          </Field>
          <Field label="Booking date">
            <Input name="bookingDate" type="date" defaultValue={toDateInput(booking.bookingDate)} />
          </Field>
          <Field label="Agreement date">
            <Input name="agreementDate" type="date" defaultValue={toDateInput(booking.agreementDate)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={booking.notes ?? ""} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={modal === "cancel"}
        size="sm"
        onClose={() => !pending && setModal(null)}
        title="Cancel this booking?"
        description="The property is released back to Available if no other booking holds it. Recorded payments stay on record."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={pending}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelBooking(booking.id, reason);
                  if (r.error) return void toast.error(r.error);
                  toast.success("Booking cancelled");
                  setModal(null);
                  router.refresh();
                })
              }
            >
              Cancel booking
            </Button>
          </>
        }
      >
        <Field label="Reason">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Loan not sanctioned" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title={`Delete ${booking.bookingNo}?`}
        description="The booking, its payment schedule and payment records will be permanently deleted. Consider cancelling instead to keep the history."
        action={() => deleteBooking(booking.id)}
      />
    </>
  );
}
