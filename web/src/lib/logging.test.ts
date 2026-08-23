import { describe, expect, it } from "vitest";
import { commuteExposure } from "./logging";
import type { Camera, RouteResult } from "./types";

// [lon, lat, isAlpr, isFlock, operator]
const cams: Camera[] = [
  [0, 0, 1, 0, "SFPD"],
  [0, 0, 1, 0, "SFPD"],
  [0, 0, 1, 0, "Daly City PD"],
  [0, 0, 1, 0, ""], // unknown operator
  [0, 0, 0, 0, "Caltrans"], // non-ALPR — not counted
];

const route = (alprCameras: number[]): RouteResult => ({
  path: [],
  distanceM: 0,
  timeS: 0,
  cameras: alprCameras,
  alprCameras,
});

describe("commuteExposure", () => {
  it("projects per-trip logs to a yearly number (×2 round trip × workdays)", () => {
    const x = commuteExposure(route([0, 1, 2]), cams, 250);
    expect(x.perTrip).toBe(3);
    expect(x.perYear).toBe(3 * 2 * 250);
  });

  it("counts distinct named agencies and flags unknown operators", () => {
    const x = commuteExposure(route([0, 1, 2, 3]), cams);
    expect(x.agencies).toEqual(["Daly City PD", "SFPD"]); // deduped + sorted
    expect(x.hasUnknown).toBe(true);
  });

  it("is zero-safe for a camera-free route", () => {
    const x = commuteExposure(route([]), cams);
    expect(x.perTrip).toBe(0);
    expect(x.perYear).toBe(0);
    expect(x.agencies).toEqual([]);
    expect(x.hasUnknown).toBe(false);
  });
});
