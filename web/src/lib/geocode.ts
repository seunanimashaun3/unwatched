import type { LngLat } from "./types";

export interface GeoResult {
  label: string;
  point: LngLat;
}

export type Bbox = [number, number, number, number]; // [W, S, E, N]

/**
 * Geocode a free-text query to places, biased to a city bounding box, using
 * Photon (Komoot) — keyless, CORS-friendly, autocomplete-oriented. Returns a
 * short ranked list. Errors resolve to [] so the UI degrades gracefully.
 */
export async function geocode(
  query: string,
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const [w, s, e, n] = bbox;
  const lat = (s + n) / 2;
  const lon = (w + e) / 2;
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=6&lang=en&lat=${lat}&lon=${lon}&bbox=${w},${s},${e},${n}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.features || [])
      .map(toResult)
      .filter((res: GeoResult | null): res is GeoResult => res !== null)
      .filter((res: GeoResult) => inBox(res.point, bbox));
  } catch {
    return []; // aborted or network error — caller shows "no results"
  }
}

function toResult(f: any): GeoResult | null {
  const c = f?.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const p = f.properties || {};
  const bits = [
    p.name,
    [p.housenumber, p.street].filter(Boolean).join(" "),
    p.city || p.district,
    p.state,
  ].filter(Boolean);
  // de-dupe consecutive equal parts (e.g. name === street)
  const label = bits.filter((b, i) => b && b !== bits[i - 1]).join(", ");
  return { label: label || "Unnamed place", point: [c[0], c[1]] };
}

function inBox(p: LngLat, [w, s, e, n]: Bbox): boolean {
  return p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
}
