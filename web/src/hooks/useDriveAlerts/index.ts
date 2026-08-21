import { useEffect, useRef, useState } from "react";
import type { Camera, LngLat } from "@/lib/types";
import { camerasWithin, nearestCamera } from "@/lib/proximity";
import { beep, vibrate } from "@/lib/alerts";

export interface ActiveAlert {
  cameraIndex: number;
  distanceM: number;
}

export interface DriveAlertOptions {
  enabled: boolean;
  alprOnly: boolean;
  /** warn when a camera is within this distance ahead (m). */
  alertRadiusM?: number;
  /** count as "logged" when within this distance (m). */
  loggedRadiusM?: number;
}

/**
 * Turns a stream of GPS fixes into camera proximity alerts + a "logged N×"
 * counter. Each camera warns once until you move well past it (so it doesn't
 * spam), and re-arms if you loop back. Fires a beep + vibration on each alert.
 */
export function useDriveAlerts(
  fix: LngLat | null,
  cameras: Camera[],
  { enabled, alprOnly, alertRadiusM = 200, loggedRadiusM = 35 }: DriveAlertOptions,
) {
  const [alert, setAlert] = useState<ActiveAlert | null>(null);
  const [loggedCount, setLoggedCount] = useState(0);
  const alerted = useRef<Set<number>>(new Set());
  const logged = useRef<Set<number>>(new Set());
  const dismissTimer = useRef<number | undefined>(undefined);

  // reset all counters when a new drive starts
  useEffect(() => {
    if (enabled) {
      alerted.current.clear();
      logged.current.clear();
      setLoggedCount(0);
      setAlert(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !fix || cameras.length === 0) return;

    // count newly-logged cameras (passed within the "seen" radius)
    for (const ci of camerasWithin(fix, cameras, loggedRadiusM, alprOnly)) {
      if (!logged.current.has(ci)) {
        logged.current.add(ci);
        setLoggedCount((n) => n + 1);
      }
    }

    // re-arm cameras we've moved well past
    const clearR = alertRadiusM * 2;
    for (const ci of [...alerted.current]) {
      const c = cameras[ci];
      if (dist(fix, c) > clearR) alerted.current.delete(ci);
    }

    // warn about the nearest un-alerted camera within range
    const near = nearestCamera(fix, cameras, alprOnly);
    if (near && near.distanceM <= alertRadiusM && !alerted.current.has(near.index)) {
      alerted.current.add(near.index);
      setAlert({ cameraIndex: near.index, distanceM: near.distanceM });
      beep();
      vibrate();
      clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => setAlert(null), 8000);
    }
  }, [fix, cameras, enabled, alprOnly, alertRadiusM, loggedRadiusM]);

  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  return { alert, loggedCount, dismiss: () => setAlert(null) };
}

function dist(a: LngLat, c: Camera): number {
  // inline haversine to avoid importing for one call site
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (c[1] - a[1]) * toRad;
  const dLon = (c[0] - a[0]) * toRad;
  const la1 = a[1] * toRad;
  const la2 = c[1] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
