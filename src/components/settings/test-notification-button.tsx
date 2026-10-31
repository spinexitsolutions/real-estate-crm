"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendTestNotification } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

export function TestNotificationButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await sendTestNotification();
          if (res.error) return void toast.error(res.error);
          const parts = [];
          if (res.data?.push) parts.push(`push to ${res.data.push} device${res.data.push > 1 ? "s" : ""}`);
          if (res.data?.email) parts.push("email");
          toast.success(parts.length ? `Sent: ${parts.join(" and ")}` : "Sent");
        })
      }
    >
      <Send /> Send test notification to me
    </Button>
  );
}
