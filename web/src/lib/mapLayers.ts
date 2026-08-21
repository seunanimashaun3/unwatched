import type maplibregl from "maplibre-gl";
import type { Camera, LngLat } from "./types";
import { COLORS } from "./mapStyle";

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

/**
 * Register every source + layer the map uses, in draw order:
 * routes (under) → camera glow/dots → passed-camera highlights (over).
 */
export function initMapLayers(m: maplibregl.Map, cameras: Camera[]) {
  m.addSource("cameras", { type: "geojson", data: cameraFC(cameras) });
  m.addSource("passed", { type: "geojson", data: emptyFC() });
  m.addSource("route-fast", { type: "geojson", data: emptyFC() });
  m.addSource("route-private", { type: "geojson", data: emptyFC() });

  m.addLayer({
    id: "route-fast",
    type: "line",
    source: "route-fast",
    paint: {
      "line-color": COLORS.fast,
      "line-width": 5,
      "line-opacity": 0.55,
      "line-dasharray": [1.5, 1.5],
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  m.addLayer({
    id: "route-private",
    type: "line",
    source: "route-private",
    paint: {
      "line-color": COLORS.safe,
      "line-width": 6,
      "line-opacity": 0.95,
      "line-blur": 0.3,
    },
    layout: { "line-cap": "round", "line-join": "round" },
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
