"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, LoaderCircle, LogIn, LogOut, MapPin, Navigation } from "lucide-react";
import { checkIn, checkOut, saveOfficeLocation } from "@/actions/attendance";
import { useLocation } from "@/components/site-visits/use-location";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function CheckInOutButton({ mode }: { mode: "in" | "out" | "done" }) {
  const router = useRouter();
  const { get, loading } = useLocation();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = loading || pending;

  if (mode === "done") return null;

  const run = async () => {
    setError(null);
    let pos;
    try {
      pos = await get();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not get your location.";
      setError(msg);
      toast.error(msg);
      return;
    }
    start(async () => {
      const res = mode === "in" ? await checkIn(pos) : await checkOut(pos);
      if (res.error) {
        setError(res.error);
        return void toast.error(res.error);
      }
      toast.success(res.data?.message ?? "Done");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={cn(
          "inline-flex h-12 items-center gap-2.5 rounded-xl px-6 text-[15px] font-semibold text-white shadow-sm transition focus-visible:ring-4 disabled:opacity-70",
          mode === "in" ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30" : "bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-500/30",
        )}
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : mode === "in" ? <LogIn className="size-5" /> : <LogOut className="size-5" />}
        {loading ? "Getting your location..." : pending ? "Saving..." : mode === "in" ? "Check in" : "Check out"}
      </button>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin className="size-3.5" /> Your current location is recorded with the time.
      </p>
      {error && <p className="max-w-md text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function OfficeLocationForm({ lat, lng, radius }: { lat: number | null; lng: number | null; radius: number }) {
  const router = useRouter();
  const { get, loading } = useLocation();
  const [pending, start] = useTransition();
  const [la, setLa] = useState(lat?.toString() ?? "");
  const [ln, setLn] = useState(lng?.toString() ?? "");
  const [r, setR] = useState(String(radius));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Latitude">
          <Input value={la} onChange={(e) => setLa(e.target.value)} inputMode="decimal" placeholder="19.0660" />
        </Field>
        <Field label="Longitude">
          <Input value={ln} onChange={(e) => setLn(e.target.value)} inputMode="decimal" placeholder="72.8686" />
        </Field>
        <Field label="Radius (m)">
          <Input value={r} onChange={(e) => setR(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          loading={loading}
          onClick={async () => {
            try {
              const p = await get();
              setLa(p.lat.toFixed(6));
              setLn(p.lng.toFixed(6));
              toast.success(`Location captured (accuracy about ${Math.round(p.accuracy)} m). Click Save to apply.`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not get your location.");
            }
          }}
        >
          <Crosshair /> Use my current location
        </Button>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
              const res = await saveOfficeLocation({ lat: toNum(la), lng: toNum(ln), radius: Number(r) || 300 });
              if (res.error) return void toast.error(res.error);
              toast.success("Office location saved");
              router.refresh();
            })
          }
        >
          <Navigation /> Save office location
        </Button>
      </div>
    </div>
  );
}
