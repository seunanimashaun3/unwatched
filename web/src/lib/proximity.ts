import type { Camera, CityIndexEntry, LngLat } from "./types";
import { haversine } from "./geo";

/** Nearest camera to a point, respecting the ALPR-only filter. */
export function nearestCamera(
  pos: LngLat,
  cameras: Camera[],
  alprOnly: boolean,
): { index: number; distanceM: number } | null {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < cameras.length; i++) {
    if (alprOnly && !cameras[i][2]) continue;
    const d = haversine(pos, [cameras[i][0], cameras[i][1]]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best < 0 ? null : { index: best, distanceM: bestD };
}

/** Indices of cameras within `radiusM` of a point (ALPR-filtered). */
export function camerasWithin(
  pos: LngLat,
  cameras: Camera[],
  radiusM: number,
  alprOnly: boolean,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < cameras.length; i++) {
    if (alprOnly && !cameras[i][2]) continue;
    if (haversine(pos, [cameras[i][0], cameras[i][1]]) <= radiusM) out.push(i);
  }
  return out;
}

/** The supported city whose center is closest to a point. */
export function nearestCity(pos: LngLat, cities: CityIndexEntry[]): CityIndexEntry | null {
  let best: CityIndexEntry | null = null;
  let bestD = Infinity;
  for (const c of cities) {
    const d = haversine(pos, c.center);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Is a point inside (or near) a city's [W,S,E,N] bbox? */
export function inBbox(pos: LngLat, bbox: [number, number, number, number], marginDeg = 0.02): boolean {
  const [w, s, e, n] = bbox;
  return pos[0] >= w - marginDeg && pos[0] <= e + marginDeg && pos[1] >= s - marginDeg && pos[1] <= n + marginDeg;
}

export function fmtCamera(cam: Camera): string {
  const kind = cam[2] ? "Plate reader" : "Camera";
  const op = cam[4];
  return op ? `${kind} (${op})` : kind;
}
