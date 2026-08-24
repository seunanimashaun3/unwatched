import { describe, expect, it } from "vitest";
import { availableOverlays, OVERLAYS, type OverlayVar } from "./demographics";
import { demoFillColor } from "./mapLayers";

type FC = GeoJSON.FeatureCollection;

const fc = (features: unknown[]): FC => ({ type: "FeatureCollection", features: features as never });
const tract = (props: Record<string, unknown>) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [] },
  properties: props,
});

describe("availableOverlays", () => {
  it("offers the ACS layers when a tract has income data", () => {
    const withAcs = fc([tract({ income: 60000 }), tract({ income: null })]);
    expect(availableOverlays(withAcs)).toEqual(["income", "povertyRate", "homeValue", "density"]);
  });

  it("omits layers when tracts have geometry but no ACS values", () => {
    expect(availableOverlays(fc([tract({ income: null })]))).toEqual([]);
  });

  it("does not surface redlining yet (still extracted, intentionally hidden)", () => {
    expect(availableOverlays(fc([tract({ income: 60000 })]))).not.toContain("redlining");
  });

  it("is empty when a city has no demographic data at all", () => {
    expect(availableOverlays(null)).toEqual([]);
  });
});

describe("demoFillColor ↔ legend consistency", () => {
  // flatten a maplibre expression to the set of hex colors it references
  const hexes = (expr: unknown): string[] => {
    const out: string[] = [];
    const walk = (x: unknown) => {
      if (typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x)) out.push(x.toLowerCase());
      else if (Array.isArray(x)) x.forEach(walk);
    };
    walk(expr);
    return out;
  };

  it("every legend swatch color appears in the corresponding map paint ramp", () => {
    (Object.keys(OVERLAYS) as OverlayVar[]).forEach((v) => {
      const paintColors = new Set(hexes(demoFillColor(v)));
      for (const stop of OVERLAYS[v].legend) {
        expect(paintColors.has(stop.color.toLowerCase()), `${v} legend color ${stop.color} missing from paint`).toBe(
          true,
        );
      }
    });
  });
});
