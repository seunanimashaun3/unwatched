import type { LngLat } from "./types";

export interface GeoResult {
  label: string;
  point: LngLat;
}

export type Bbox = [number, number, number, number]; // [W, S, E, N]

/**
 * Geocode a free-text query to places using Photon (Komoot) — keyless,
 * CORS-friendly, autocomplete-oriented. Searches globally, biased toward
 * `near` [lon, lat] so nearby results rank first (but anywhere is reachable, so
 * you can find your real location even if the app is showing another city).
 * Errors resolve to [] so the UI degrades gracefully.
 */
export async function geocode(
  query: string,
  near: LngLat,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const [lon, lat] = near;
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=6&lang=en&lat=${lat}&lon=${lon}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.features || [])
      .map(toResult)
      .filter((res: GeoResult | null): res is GeoResult => res !== null);
  } catch {
    return []; // aborted or network error — caller shows "no results"
  }
}

function labelFromProps(p: any): string {
  const bits = [
    p.name,
    [p.housenumber, p.street].filter(Boolean).join(" "),
    p.city || p.district,
    p.state,
  ].filter(Boolean);
  // de-dupe consecutive equal parts (e.g. name === street)
  return bits.filter((b: string, i: number) => b && b !== bits[i - 1]).join(", ");
}

function toResult(f: any): GeoResult | null {
  const c = f?.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  return { label: labelFromProps(f.properties || {}) || "Unnamed place", point: [c[0], c[1]] };
}

/** Reverse-geocode a point to the nearest street address (Photon). null on failure. */
export async function reverseGeocode(
  lon: number,
  lat: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`, { signal });
    if (!r.ok) return null;
    const data = await r.json();
    const label = labelFromProps(data.features?.[0]?.properties || {});
    return label || null;
  } catch {
    return null;
  }
}
