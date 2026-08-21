import type maplibregl from "maplibre-gl";

export const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · Roads: <a href="https://overturemaps.org">Overture</a> · Cameras: <a href="https://deflock.me">DeFlock</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

export const COLORS = {
  alert: "#ff4d5e",
  camera: "#8b95a7",
  safe: "#35e0a1",
  fast: "#9aa4b6",
} as const;
