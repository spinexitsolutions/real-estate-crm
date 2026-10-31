"use client";

import { useState } from "react";
import { Crosshair, ExternalLink, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Field, Input } from "@/components/ui/field";

/** Latitude / longitude inputs with a "Use my current location" helper (used for site check-ins and the map on the website). */
export function LocationFields({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [lat, setLat] = useState(latitude !== null ? String(latitude) : "");
  const [lng, setLng] = useState(longitude !== null ? String(longitude) : "");
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) return void toast.error("Location is not supported on this device.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Location captured");
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const valid = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  return (
    <div className="sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" hint="Used for site visit check-ins and the map on your website">
          <Input name="latitude" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="19.1176" />
        </Field>
        <Field label="Longitude">
          <Input name="longitude" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="72.9060" />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={locate} disabled={locating} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60">
          {locating ? <LoaderCircle className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
          Use my current location
        </button>
        {valid && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-800">
            <ExternalLink className="size-3.5" /> View on map
          </a>
        )}
      </div>
    </div>
  );
}
