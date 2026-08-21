import { describe, expect, it } from "vitest";
import { camerasWithin, fmtCamera, inBbox, nearestCamera, nearestCity } from "./proximity";
import type { Camera, CityIndexEntry } from "./types";

const cam = (lon: number, lat: number, alpr = 1, flock = 0, op = ""): Camera => [lon, lat, alpr, flock, op];

describe("nearestCamera", () => {
  const here: [number, number] = [-121.886, 37.338];

  it("finds the closest camera", () => {
    const cams = [cam(-121.9, 37.34), cam(-121.887, 37.338), cam(-121.8, 37.3)];
    const n = nearestCamera(here, cams, false);
    expect(n?.index).toBe(1);
    expect(n?.distanceM).toBeLessThan(120);
  });

  it("skips non-ALPR cameras when alprOnly", () => {
    const cams = [cam(-121.8865, 37.338, 0), cam(-121.89, 37.34, 1)];
    const n = nearestCamera(here, cams, true);
    expect(n?.index).toBe(1); // the plain camera (0) is ignored
  });

  it("returns null when there are no eligible cameras", () => {
    expect(nearestCamera(here, [cam(-121.9, 37.3, 0)], true)).toBeNull();
    expect(nearestCamera(here, [], false)).toBeNull();
  });
});

describe("camerasWithin", () => {
  const here: [number, number] = [-121.886, 37.338];
  it("returns indices within the radius only", () => {
    const cams = [cam(-121.8861, 37.338), cam(-121.95, 37.4)];
    expect(camerasWithin(here, cams, 100, false)).toEqual([0]);
  });
});

describe("nearestCity", () => {
  const cities: CityIndexEntry[] = [
    { slug: "san-jose-ca", city: "San Jose", state: "CA", center: [-121.886, 37.338], zoom: 11, counts: { alpr: 1, cameras: 1, flock: 0 } },
    { slug: "atlanta-ga", city: "Atlanta", state: "GA", center: [-84.388, 33.749], zoom: 11, counts: { alpr: 1, cameras: 1, flock: 0 } },
  ];
  it("picks the closest city center", () => {
    expect(nearestCity([-121.9, 37.35], cities)?.slug).toBe("san-jose-ca");
    expect(nearestCity([-84.4, 33.7], cities)?.slug).toBe("atlanta-ga");
  });
});

describe("inBbox", () => {
  const bbox: [number, number, number, number] = [-122.02, 37.25, -121.8, 37.44];
  it("is true inside and false far outside", () => {
    expect(inBbox([-121.9, 37.34], bbox)).toBe(true);
    expect(inBbox([-100, 40], bbox)).toBe(false);
  });
});

describe("fmtCamera", () => {
  it("labels ALPR vs camera and includes operator", () => {
    expect(fmtCamera(cam(0, 0, 1, 1, "Flock Safety"))).toBe("Plate reader (Flock Safety)");
    expect(fmtCamera(cam(0, 0, 0, 0, ""))).toBe("Camera");
  });
});
