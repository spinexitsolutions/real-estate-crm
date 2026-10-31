"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDueLabel } from "@/lib/format";

type DueItem = { id: string; title: string; type: string; dueAt: string; leadId: string; leadName: string };
const KEY = "ed_shown_reminders";

function shownIds(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function remember(ids: Set<string>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

/** Polls for follow-ups due around now and shows an in-app reminder once per follow-up. */
export function ReminderPoller() {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/notifications/due", { cache: "no-store" });
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: DueItem[] };
        const seen = shownIds();
        for (const it of items) {
          if (seen.has(it.id) || stopped) continue;
          seen.add(it.id);
          const overdue = new Date(it.dueAt) < new Date();
          toast(overdue ? `Follow-up due now: ${it.title}` : `Upcoming follow-up: ${it.title}`, {
            description: `${it.leadName} - ${formatDueLabel(it.dueAt)}`,
            duration: 15000,
            action: { label: "Open", onClick: () => router.push(`/leads/${it.leadId}`) },
          });
        }
        remember(seen);
      } catch {
        /* offline */
      }
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 60000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [router]);
  return null;
}
