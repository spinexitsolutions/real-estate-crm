"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, MapPinCheck } from "lucide-react";
import { checkInAtSite } from "@/actions/site-visits";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { mapsLink } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useLocation, type Position } from "./use-location";

export function SiteCheckInButton({
  leadId,
  propertyId,
  followUpId,
  propertyTitle,
  size = "sm",
}: {
  leadId: string;
  propertyId?: string | null;
  followUpId?: string | null;
  propertyTitle?: string | null;
  size?: "sm" | "md" | "icon";
}) {
  const router = useRouter();
  const { get, loading } = useLocation();
  const [pending, start] = useTransition();
  const [pos, setPos] = useState<Position | null>(null);
  const [notes, setNotes] = useState("");

  const begin = async () => {
    try {
      const p = await get();
      setNotes("");
      setPos(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get your location.");
    }
  };

  const confirm = () =>
    start(async () => {
      if (!pos) return;
      const res = await checkInAtSite({ leadId, propertyId, followUpId, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, notes });
      if (res.error) return void toast.error(res.error);
      toast.success(res.data?.message ?? "Checked in");
      setPos(null);
      router.refresh();
    });

  return (
    <>
      {size === "icon" ? (
        <button
          type="button"
          onClick={begin}
          disabled={loading}
          title="Check in at site"
          aria-label="Check in at site"
          className={cn("flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50", loading && "animate-pulse")}
        >
          <MapPinCheck className="size-4" />
        </button>
      ) : (
        <Button variant="outline" size={size} onClick={begin} loading={loading}>
          <MapPinCheck /> {loading ? "Locating..." : "Check in at site"}
        </Button>
      )}
      <Modal
        open={!!pos}
        onClose={() => !pending && setPos(null)}
        size="sm"
        title="Confirm site visit check-in"
        description={propertyTitle ? `At ${propertyTitle}` : "Your location will be saved on this lead's timeline."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPos(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="success" onClick={confirm} loading={pending}>
              <MapPinCheck /> Check in
            </Button>
          </>
        }
      >
        {pos && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <Crosshair className="mt-0.5 size-4 text-emerald-600" />
              <div className="text-sm">
                <p className="font-medium text-slate-800">
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                </p>
                <p className="text-xs text-slate-500">Accuracy about {Math.round(pos.accuracy)} m</p>
                <a href={mapsLink(pos.lat, pos.lng)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                  View on map
                </a>
              </div>
            </div>
            <Field label="Visit notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who came, feedback on the unit, next steps..." />
            </Field>
            {followUpId && <p className="text-xs text-slate-500">This site visit follow-up will be marked as completed.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
