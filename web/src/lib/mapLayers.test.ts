import { describe, expect, it } from "vitest";
import { cameraFC, lineFC, pointsFC, emptyFC, setDemographics } from "./mapLayers";
import type { Camera } from "./types";

const cams: Camera[] = [
  [-84.4, 33.7, 1, 1, "APD"], // ALPR + flock
  [-84.3, 33.8, 0, 0, ""], // plain camera
];

describe("GeoJSON builders", () => {
  it("cameraFC carries alpr/flock flags and coordinates", () => {
    const fc = cameraFC(cams);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [-84.4, 33.7] });
    expect(fc.features[0].properties).toEqual({ alpr: 1, flock: 1 });
    expect(fc.features[1].properties).toEqual({ alpr: 0, flock: 0 });
  });

  it("pointsFC keeps the camera index as the feature id (for tap-to-lookup)", () => {
    const fc = pointsFC([1], cams);
    expect(fc.features[0].id).toBe(1);
    expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [-84.3, 33.8] });
  });

  it("lineFC wraps a path as a LineString; emptyFC is empty", () => {
    expect(lineFC([[0, 0], [1, 1]]).features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [[0, 0], [1, 1]],
    });
    expect(emptyFC().features).toEqual([]);
  });
});

// minimal MapLibre stand-in: records paint props + the source data set
function mockMap(hasLayer = true) {
  const paint: Record<string, unknown> = {};
  let sourceData: unknown = "UNSET";
  return {
    paint,
    getSourceData: () => sourceData,
    getLayer: (id: string) => (hasLayer && (id === "demo-fill" || id === "demo-line") ? {} : undefined),
    setPaintProperty: (layer: string, prop: string, val: unknown) => {
      paint[`${layer}.${prop}`] = val;
    },
    getSource: (id: string) =>
      id === "demo" ? { setData: (d: unknown) => (sourceData = d) } : undefined,
  };
}

const tracts = { type: "FeatureCollection", features: [{ id: "t" }] } as never;
const redlining = { type: "FeatureCollection", features: [{ id: "r" }] } as never;

describe("setDemographics", () => {
  it("hides the layer when overlay is null", () => {
    const m = mockMap();
    setDemographics(m as never, null, tracts, redlining);
    expect(m.paint["demo-fill.fill-opacity"]).toBe(0);
    expect(m.paint["demo-line.line-opacity"]).toBe(0);
    expect(m.getSourceData()).toBe("UNSET"); // didn't touch the source
  });

  it("shows tract data + a fill ramp for an ACS variable", () => {
    const m = mockMap();
    setDemographics(m as never, "income", tracts, redlining);
    expect(m.getSourceData()).toBe(tracts);
    expect(m.paint["demo-fill.fill-opacity"]).toBe(0.6);
    expect(m.paint["demo-fill.fill-color"]).toBeDefined();
  });

  it("uses the redlining geometry (not tracts) for the redlining overlay", () => {
    const m = mockMap();
    setDemographics(m as never, "redlining", tracts, redlining);
    expect(m.getSourceData()).toBe(redlining);
    expect(m.paint["demo-line.line-opacity"]).toBe(0.5);
  });

  it("is a no-op when the demo layer isn't on the map yet", () => {
    const m = mockMap(false);
    setDemographics(m as never, "income", tracts, redlining);
    expect(m.paint["demo-fill.fill-opacity"]).toBeUndefined();
  });
});
