import type maplibregl from "maplibre-gl";
import type { Theme } from "@/components/ThemeProvider";

const ATTRIBUTION =
  '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · Roads: <a href="https://overturemaps.org">Overture</a> · Cameras: <a href="https://deflock.me">DeFlock</a>';

/** CARTO raster tiles for the theme. Light uses the colorful "Voyager" style
 *  (green parks, blue water, colored roads) so the map really pops; dark uses
 *  the moody dark-matter style. */
export function cartoTiles(theme: Theme): string[] {
  const set = theme === "dark" ? "dark_all" : "rastertiles/voyager";
  return ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${set}/{z}/{x}/{y}@2x.png`,
  );
}

export function buildMapStyle(theme: Theme): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      carto: { type: "raster", tiles: cartoTiles(theme), tileSize: 256, attribution: ATTRIBUTION },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}

// route + marker colors — theme-independent, tuned to pop on the colorful map.
// red = surveillance, emerald = least-watched route, indigo = fastest route.
export const COLORS = {
  alert: "#f5333f",
  camera: "#8b95a7",
  safe: "#10b981",
  fast: "#5b53ff",
} as const;
