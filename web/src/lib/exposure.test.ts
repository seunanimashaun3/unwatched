import { describe, expect, it } from "vitest";
import { computeExposure, exposureBand } from "./exposure";
import type { Camera } from "./types";

// [lon, lat, isAlpr, isFlock, operator]
const at = (lon: number, lat: number, alpr = 1, flock = 0): Camera => [
  lon,
  lat,
  alpr,
  flock,
  "",
];

describe("computeExposure", () => {
  const origin: [number, number] = [-122.42, 37.77];

  it("counts only cameras within the radius", () => {
    const cams: Camera[] = [
      at(-122.42, 37.7701), // ~11 m away — inside
      at(-122.5, 37.77), // far — outside
    ];
    const e = computeExposure(origin, cams, 400);
    expect(e.alpr).toBe(1);
    expect(e.total).toBe(1);
  });

  it("separates ALPR, Flock, and total", () => {
    const cams: Camera[] = [
      at(-122.42, 37.7701, 1, 1), // ALPR + Flock
      at(-122.4201, 37.7701, 1, 0), // ALPR only
      at(-122.4202, 37.7701, 0, 0), // plain camera
    ];
    const e = computeExposure(origin, cams, 400);
    expect(e.alpr).toBe(2);
    expect(e.flock).toBe(1);
    expect(e.total).toBe(3);
  });

  it("reports nearest ALPR distance even when it is outside the radius", () => {
    const cams: Camera[] = [at(-122.43, 37.77)]; // ~880 m away, outside 400 m
    const e = computeExposure(origin, cams, 400);
    expect(e.alpr).toBe(0); // not within radius
    expect(e.nearest).not.toBeNull();
    expect(e.nearest!).toBeGreaterThan(700);
  });

  it("returns null nearest when there are no ALPRs at all", () => {
    const cams: Camera[] = [at(-122.42, 37.7701, 0, 0)];
    const e = computeExposure(origin, cams, 400);
    expect(e.nearest).toBeNull();
  });

  it("handles an empty camera list", () => {
    const e = computeExposure(origin, [], 400);
    expect(e).toEqual({ alpr: 0, total: 0, flock: 0, nearest: null });
  });
});

describe("exposureBand", () => {
  it("bands ALPR counts into low/med/high", () => {
    expect(exposureBand(0).cls).toBe("low");
    expect(exposureBand(2).cls).toBe("low");
    expect(exposureBand(3).cls).toBe("med");
    expect(exposureBand(5).cls).toBe("med");
    expect(exposureBand(6).cls).toBe("high");
    expect(exposureBand(20).cls).toBe("high");
  });

  it("gives a distinct 'no cameras' message at zero", () => {
    expect(exposureBand(0).label).toMatch(/no known/i);
  });
});
