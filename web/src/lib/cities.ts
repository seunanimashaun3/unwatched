import type { CameraData, CitiesIndex, Meta } from "./types";

const base = () => import.meta.env.BASE_URL || "/";

/** The list of supported cities shown on the home page. */
export async function fetchCitiesIndex(): Promise<CitiesIndex> {
  const r = await fetch(`${base()}data/cities.json`);
  if (!r.ok) throw new Error("Could not load city index");
  return r.json();
}

/** A city's meta (name, center, presets, counts). */
export async function fetchCityMeta(slug: string): Promise<Meta> {
  const r = await fetch(`${base()}data/${slug}/meta.json`);
  if (!r.ok) throw new Error(`Unknown city: ${slug}`);
  return r.json();
}

/** A city's camera points. */
export async function fetchCityCameras(slug: string): Promise<CameraData> {
  const r = await fetch(`${base()}data/${slug}/cameras.json`);
  if (!r.ok) throw new Error(`No camera data for: ${slug}`);
  return r.json();
}

/** "Request a city" link. Set this to a Google Form / Tally URL to collect
 *  requests without exposing a personal email. Empty = hide the affordance. */
export const REQUEST_CITY_URL = "";
