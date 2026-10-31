"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowUpFormModal } from "@/components/followups/followup-form";

export function NewFollowUpButton({
  autoOpen,
  leads,
  users,
  properties,
}: {
  autoOpen: boolean;
  leads: { id: string; name: string; phone: string }[];
  users: { id: string; name: string }[];
  properties: { id: string; title: string; code: string }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const close = () => {
    setOpen(false);
    if (params.get("new")) {
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New follow-up
      </Button>
      <FollowUpFormModal open={open} onClose={close} leads={leads} users={users} properties={properties} />
    </>
  );
}
