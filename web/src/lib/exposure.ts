import type { Camera, LngLat } from "./types";
import { haversine } from "./geo";

export interface Exposure {
  /** ALPR cameras within the radius. */
  alpr: number;
  /** all surveillance cameras within the radius. */
  total: number;
  /** Flock-branded cameras within the radius. */
  flock: number;
  /** distance (m) to the single nearest ALPR anywhere, or null if none exist. */
  nearest: number | null;
}

export const EXPOSURE_RADIUS_M = 400; // ~5 minute walk

/** How surveilled a single spot is, within a short walk. Pure + testable. */
export function computeExposure(
  point: LngLat,
  cameras: Camera[],
  radiusM = EXPOSURE_RADIUS_M,
): Exposure {
  let alpr = 0;
  let total = 0;
  let flock = 0;
  let nearest: number | null = null;
  for (const c of cameras) {
    const d = haversine(point, [c[0], c[1]]);
    if (d <= radiusM) {
      total++;
      if (c[2]) alpr++;
      if (c[3]) flock++;
    }
    if (c[2] && (nearest === null || d < nearest)) nearest = d;
  }
  return { alpr, total, flock, nearest };
}

export interface ExposureBand {
  cls: "low" | "med" | "high";
  label: string;
}

/** Qualitative band for an ALPR count — drives the score color + caption. */
export function exposureBand(alprCount: number): ExposureBand {
  if (alprCount === 0) return { cls: "low", label: "No known plate readers nearby" };
  if (alprCount <= 2) return { cls: "low", label: "Light plate-reader coverage" };
  if (alprCount <= 5) return { cls: "med", label: "Moderate plate-reader coverage" };
  return { cls: "high", label: "Heavy plate-reader coverage" };
}
