"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PushState = "loading" | "unsupported" | "unconfigured" | "denied" | "enabled" | "disabled";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (!VAPID) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "enabled" : "disabled");
    } catch {
      setState("disabled");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "disabled");
        toast.error("Notification permission was not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("Could not save subscription");
      setState("enabled");
      toast.success("Desktop notifications enabled on this device");
    } catch (e) {
      console.error(e);
      toast.error("Could not enable notifications on this browser.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("disabled");
      toast.success("Desktop notifications turned off on this device");
    } finally {
      setBusy(false);
    }
  };

  return { state, busy, enable, disable };
}

const STATUS_TEXT: Record<PushState, string> = {
  loading: "Checking this browser...",
  unsupported: "This browser does not support push notifications.",
  unconfigured: "Push notifications are not configured on the server yet.",
  denied: "Notifications are blocked. Allow them from the browser's site settings.",
  enabled: "Enabled on this device. You will be alerted before every follow-up.",
  disabled: "Get an alert on this device before every follow-up.",
};

/** Full toggle with status text, used on the profile page. */
export function PushToggle({ className }: { className?: string }) {
  const { state, busy, enable, disable } = usePushNotifications();
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", state === "enabled" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
          {state === "enabled" ? <BellRing className="size-[18px]" /> : <BellOff className="size-[18px]" />}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-900">Desktop and mobile push</p>
          <p className="text-[13px] text-slate-500">{STATUS_TEXT[state]}</p>
        </div>
      </div>
      {state === "enabled" ? (
        <Button variant="secondary" size="sm" loading={busy} onClick={disable}>
          Turn off
        </Button>
      ) : state === "disabled" ? (
        <Button size="sm" loading={busy} onClick={enable}>
          Enable
        </Button>
      ) : null}
    </div>
  );
}

/** Compact prompt for the notification bell dropdown. Renders nothing once enabled or unavailable. */
export function PushPrompt() {
  const { state, busy, enable } = usePushNotifications();
  if (state !== "disabled") return null;
  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
      <BellRing className="size-4 shrink-0 text-brand-600" />
      <p className="flex-1 text-xs text-slate-700">Get reminders even when this tab is closed.</p>
      <button onClick={enable} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-60">
        {busy && <LoaderCircle className="size-3 animate-spin" />}
        Enable
      </button>
    </div>
  );
}
