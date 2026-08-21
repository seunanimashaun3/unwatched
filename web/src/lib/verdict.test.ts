import { describe, expect, it } from "vitest";
import { detourLabel, summarizeRoutes } from "./verdict";
import type { RouteResult } from "./types";

const route = (timeS: number, cams: number[]): RouteResult => ({
  path: [
    [0, 0],
    [1, 1],
  ],
  distanceM: 1000,
  timeS,
  cameras: cams,
  alprCameras: cams,
});

describe("summarizeRoutes", () => {
  it("flags a real privacy win", () => {
    const v = summarizeRoutes(route(360, [1, 2, 3, 4]), route(600, [4]));
    expect(v.kind).toBe("win");
    expect(v.savedCameras).toBe(3);
    expect(v.extraTimeS).toBe(240);
  });

  it("flags identical routes when nothing is saved and time is equal", () => {
    const v = summarizeRoutes(route(300, [1]), route(300, [1]));
    expect(v.kind).toBe("identical");
  });

  it("treats a tiny time delta with no camera savings as identical", () => {
    const v = summarizeRoutes(route(300, []), route(320, []));
    expect(v.kind).toBe("identical"); // <30s delta
  });

  it("does not claim a win when the private route saves no cameras", () => {
    const v = summarizeRoutes(route(300, [1, 2]), route(500, [1, 2]));
    expect(v.kind).toBe("no-benefit");
    expect(v.savedCameras).toBe(0);
  });
});

describe("detourLabel", () => {
  it("maps the slider value to escalating labels", () => {
    expect(detourLabel(0)).toBe("Barely detour");
    expect(detourLabel(90)).toBe("Balanced");
    expect(detourLabel(180)).toBe("Prefer privacy");
    expect(detourLabel(300)).toBe("Avoid at all costs");
  });
});
