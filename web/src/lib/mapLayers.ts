import type maplibregl from "maplibre-gl";
import type { Camera, LngLat } from "./types";
import { COLORS } from "./mapStyle";
import { NO_DATA, type OverlayVar } from "./demographics";

// ALPR = alert color, everything else = neutral. Shared by both camera layers.
const alprColor = [
  "case",
  ["==", ["get", "alpr"], 1],
  COLORS.alert,
  COLORS.camera,
] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;

const zoomRadius = (min: number, max: number) =>
  ["interpolate", ["linear"], ["zoom"], 11, min, 16, max] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>;

export function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function lineFC(path: LngLat[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: path }, properties: {} },
    ],
  };
}

export function cameraFC(cameras: Camera[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cameras.map((c, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [c[0], c[1]] },
      properties: { alpr: c[2], flock: c[3] },
    })),
  };
}

export function pointsFC(
  indices: number[],
  cameras: Camera[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: indices.map((ci) => ({
      type: "Feature",
      id: ci, // so a tap on a highlighted camera can look it up
      geometry: { type: "Point", coordinates: [cameras[ci][0], cameras[ci][1]] },
      properties: {},
    })),
  };
}

/** Show all cameras, or only ALPRs. */
export function setCamVisibility(m: maplibregl.Map, alprOnly: boolean) {
  const filter = alprOnly ? (["==", ["get", "alpr"], 1] as unknown as maplibregl.FilterSpecification) : null;
  ["cam-glow", "cam-dot"].forEach((id) => {
    if (m.getLayer(id)) m.setFilter(id, filter);
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Map paint ramps for the demographic overlay — colors match OVERLAYS legends. */
export function demoFillColor(v: OverlayVar): any {
  if (v === "redlining")
    return ["match", ["get", "grade"], "A", "#5aa469", "B", "#5b8fc4", "C", "#e2c044", "D", "#d1495b", NO_DATA];
  if (v === "income")
    return ["case", ["==", ["get", "income"], null], NO_DATA,
      ["interpolate", ["linear"], ["to-number", ["get", "income"]],
        30000, "#440154", 60000, "#3b528b", 90000, "#21918c", 120000, "#5ec962", 160000, "#fde725"]];
  if (v === "homeValue")
    return ["case", ["==", ["get", "homeValue"], null], NO_DATA,
      ["interpolate", ["linear"], ["to-number", ["get", "homeValue"]],
        100000, "#edf8fb", 300000, "#b2e2e2", 500000, "#66c2a4", 800000, "#2ca25f", 1200000, "#006d2c"]];
  if (v === "density")
    return ["case", ["==", ["get", "density"], null], NO_DATA,
      ["interpolate", ["linear"], ["to-number", ["get", "density"]],
        0, "#f2f0f7", 3000, "#cbc9e2", 8000, "#9e9ac8", 15000, "#756bb1", 25000, "#54278f"]];
  return ["case", ["==", ["get", "povertyRate"], null], NO_DATA,
    ["interpolate", ["linear"], ["to-number", ["get", "povertyRate"]],
      0, "#fff5eb", 0.1, "#fdae6b", 0.2, "#f16913", 0.35, "#a63603"]];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Show/update/hide the demographic choropleth (a background context layer). */
export function setDemographics(
  m: maplibregl.Map,
  overlay: OverlayVar | null,
  tracts: GeoJSON.FeatureCollection | null,
  redlining: GeoJSON.FeatureCollection | null,
) {
  if (!m.getLayer("demo-fill")) return;
  if (!overlay) {
    m.setPaintProperty("demo-fill", "fill-opacity", 0);
    m.setPaintProperty("demo-line", "line-opacity", 0);
    return;
  }
  const data = overlay === "redlining" ? redlining : tracts;
  (m.getSource("demo") as maplibregl.GeoJSONSource | undefined)?.setData(data ?? emptyFC());
  m.setPaintProperty("demo-fill", "fill-color", demoFillColor(overlay));
  m.setPaintProperty("demo-fill", "fill-opacity", 0.6);
  m.setPaintProperty("demo-line", "line-opacity", overlay === "redlining" ? 0.5 : 0.22);
}

/**
 * Register every source + layer the map uses, in draw order:
 * demographic choropleth (bottom) → routes → camera glow/dots → highlights (top).
 */
export function initMapLayers(m: maplibregl.Map, cameras: Camera[]) {
  // demographic context sits at the very bottom, above only the basemap
  m.addSource("demo", { type: "geojson", data: emptyFC() });
  m.addLayer({ id: "demo-fill", type: "fill", source: "demo", paint: { "fill-color": NO_DATA, "fill-opacity": 0 } });
  m.addLayer({
    id: "demo-line",
    type: "line",
    source: "demo",
    paint: { "line-color": "rgba(255,255,255,0.4)", "line-width": 0.4, "line-opacity": 0 },
  });

  m.addSource("cameras", { type: "geojson", data: cameraFC(cameras) });
  m.addSource("passed", { type: "geojson", data: emptyFC() });
  m.addSource("route-fast", { type: "geojson", data: emptyFC() });
  m.addSource("route-private", { type: "geojson", data: emptyFC() });

  const casing = { "line-color": "#ffffff", "line-opacity": 0.9 } as const;
  const cap = { "line-cap": "round", "line-join": "round" } as const;
  // fastest route: white casing + indigo line (drawn under the private route)
  m.addLayer({ id: "route-fast-casing", type: "line", source: "route-fast", paint: { ...casing, "line-width": 8 }, layout: cap });
  m.addLayer({
    id: "route-fast",
    type: "line",
    source: "route-fast",
    paint: { "line-color": COLORS.fast, "line-width": 4.5, "line-opacity": 0.85 },
    layout: cap,
  });
  // least-watched route: white casing + emerald line, on top
  m.addLayer({ id: "route-private-casing", type: "line", source: "route-private", paint: { ...casing, "line-width": 9 }, layout: cap });
  m.addLayer({
    id: "route-private",
    type: "line",
    source: "route-private",
    paint: { "line-color": COLORS.safe, "line-width": 5.5, "line-opacity": 0.98 },
    layout: cap,
  });
  m.addLayer({
    id: "cam-glow",
    type: "circle",
    source: "cameras",
    paint: {
      "circle-radius": zoomRadius(3, 9),
      "circle-color": alprColor,
      "circle-blur": 1,
      "circle-opacity": 0.5,
    },
  });
  m.addLayer({
    id: "cam-dot",
    type: "circle",
    source: "cameras",
    paint: {
      "circle-radius": zoomRadius(1.6, 4.5),
      "circle-color": alprColor,
      "circle-stroke-width": 0.5,
      "circle-stroke-color": "rgba(0,0,0,0.5)",
    },
  });
  // soft halo behind highlighted cameras so they read as "big & bright"
  m.addLayer({
    id: "passed-glow",
    type: "circle",
    source: "passed",
    paint: {
      "circle-radius": zoomRadius(10, 20),
      "circle-color": COLORS.alert,
      "circle-blur": 1,
      "circle-opacity": 0.45,
    },
  });
  m.addLayer({
    id: "passed",
    type: "circle",
    source: "passed",
    paint: {
      "circle-radius": zoomRadius(6, 12),
      "circle-color": COLORS.alert,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#fff",
    },
  });
}
