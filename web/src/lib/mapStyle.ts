import type maplibregl from "maplibre-gl";
import type { Theme } from "@/components/ThemeProvider";

const ATTRIBUTION =
  '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · Roads: <a href="https://overturemaps.org">Overture</a> · Cameras: <a href="https://deflock.me">DeFlock</a>';

/** CARTO raster tiles for the given theme (light = positron, dark = dark matter). */
export function cartoTiles(theme: Theme): string[] {
  const set = theme === "dark" ? "dark_all" : "light_all";
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

// route + marker colors — theme-independent (red = surveillance, green = safe)
export const COLORS = {
  alert: "#ff4d5e",
  camera: "#8b95a7",
  safe: "#35e0a1",
  fast: "#9aa4b6",
} as const;
