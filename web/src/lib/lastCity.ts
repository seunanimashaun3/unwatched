import type { CityIndexEntry } from "./types";

const KEY = "unwatched:lastCity";

/** Remember the city the user is in, so a refresh / return trip stays put. */
export function loadLastCity(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function saveLastCity(slug: string): void {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* storage may be unavailable (private mode, etc.) */
  }
}

export function clearLastCity(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Keep a persisted slug only if it's still a supported city (else Overview). */
export function validCity(slug: string, cities: CityIndexEntry[]): string {
  return slug && cities.some((c) => c.slug === slug) ? slug : "";
}
