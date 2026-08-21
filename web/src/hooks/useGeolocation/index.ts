import { useCallback, useEffect, useRef, useState } from "react";
import type { LngLat } from "@/lib/types";

export interface GeoFix {
  point: LngLat;
  headingDeg: number | null;
  speedMps: number | null;
  accuracyM: number;
}

function toFix(p: GeolocationPosition): GeoFix {
  return {
    point: [p.coords.longitude, p.coords.latitude],
    headingDeg: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
    speedMps: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
    accuracyM: p.coords.accuracy,
  };
}

function message(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return "Location permission denied.";
  if (e.code === e.POSITION_UNAVAILABLE) return "Location unavailable.";
  return "Couldn't get your location.";
}

const OPTS: PositionOptions = { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 };

/**
 * Wraps the Geolocation API. `locateOnce()` for a one-shot fix ("use my
 * location"); `start()/stop()` to continuously watch while driving. The
 * geolocation source is injectable so the hook is unit-testable.
 */
export function useGeolocation(geo: Geolocation | undefined = typeof navigator !== "undefined" ? navigator.geolocation : undefined) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!geo) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setError(null);
    watchId.current = geo.watchPosition(
      (p) => setFix(toFix(p)),
      (e) => setError(message(e)),
      OPTS,
    );
    setWatching(true);
  }, [geo]);

  const stop = useCallback(() => {
    if (geo && watchId.current !== null) geo.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
  }, [geo]);

  const locateOnce = useCallback(
    () =>
      new Promise<GeoFix>((resolve, reject) => {
        if (!geo) {
          setError("Geolocation isn't supported on this device.");
          reject(new Error("no geolocation"));
          return;
        }
        setError(null);
        geo.getCurrentPosition(
          (p) => {
            const f = toFix(p);
            setFix(f);
            resolve(f);
          },
          (e) => {
            setError(message(e));
            reject(e);
          },
          OPTS,
        );
      }),
    [geo],
  );

  useEffect(() => {
    return () => {
      if (geo && watchId.current !== null) geo.clearWatch(watchId.current);
    };
  }, [geo]);

  return { fix, error, watching, start, stop, locateOnce };
}
