import type { Theme } from "@/components/ThemeProvider";

/**
 * Keyless vector basemap from OpenFreeMap (openfreemap.org) — no API key, no
 * usage limits, OpenStreetMap data. "liberty" is colorful (parks, water, roads);
 * "dark" is the night style. Replaced CARTO, which now requires an API key.
 */
export function buildMapStyle(theme: Theme): string {
  return theme === "dark"
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/liberty";
}

/** Data credits for the attribution control (OSM/OpenFreeMap come from the
 *  style's own sources; this adds our data layers). */
export const DATA_ATTRIBUTION =
  'Roads: <a href="https://overturemaps.org" target="_blank" rel="noreferrer">Overture</a> · ' +
  'Cameras: <a href="https://deflock.me" target="_blank" rel="noreferrer">DeFlock</a>';

// route + marker colors — theme-independent, tuned to pop on the colorful map.
// red = surveillance, emerald = least-watched route, indigo = fastest route.
export const COLORS = {
  alert: "#f5333f",
  camera: "#8b95a7",
  safe: "#10b981",
  fast: "#5b53ff",
} as const;
