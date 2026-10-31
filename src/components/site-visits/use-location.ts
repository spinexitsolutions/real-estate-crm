"use client";

import { useCallback, useState } from "react";

export type Position = { lat: number; lng: number; accuracy: number };

export function geoErrorMessage(err: GeolocationPositionError | Error | null) {
  if (!err) return "Could not get your location.";
  if ("code" in err) {
    if (err.code === 1) return "Location permission is blocked. Allow location for this site in your browser settings, then try again.";
    if (err.code === 2) return "Your location is unavailable. Turn on GPS / location services and try again.";
    if (err.code === 3) return "Getting your location took too long. Move to an open area and try again.";
  }
  return err.message || "Could not get your location.";
}

/** Wraps navigator.geolocation with high accuracy and friendly errors. */
export function useLocation() {
  const [loading, setLoading] = useState(false);
  const get = useCallback(
    () =>
      new Promise<Position>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(new Error("This browser does not support location. Use a modern browser on your phone."));
          return;
        }
        if (typeof window !== "undefined" && !window.isSecureContext) {
          reject(new Error("Location needs a secure (https) connection."));
          return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            setLoading(false);
            resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
          },
          (e) => {
            setLoading(false);
            reject(new Error(geoErrorMessage(e)));
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
      }),
    [],
  );
  return { get, loading };
}
