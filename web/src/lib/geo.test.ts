import { describe, expect, it } from "vitest";
import { fmtDistance, fmtDuration, haversine } from "./geo";
import type { LngLat } from "./types";

describe("haversine", () => {
  it("is ~0 for identical points", () => {
    expect(haversine([-122.4, 37.77], [-122.4, 37.77])).toBeCloseTo(0, 5);
  });

  it("matches a known distance (1° latitude ≈ 111 km)", () => {
    const d = haversine([0, 0], [0, 1]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("is symmetric", () => {
    const a: LngLat = [-122.42, 37.75];
    const b: LngLat = [-122.4, 37.8];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });

  it("computes a realistic SF distance (Mission→Marina ≈ 5 km straight line)", () => {
    const d = haversine([-122.4194, 37.7599], [-122.4368, 37.803]);
    expect(d).toBeGreaterThan(4_000);
    expect(d).toBeLessThan(6_000);
  });
});

describe("fmtDuration", () => {
  it("formats minutes under an hour", () => {
    expect(fmtDuration(90)).toBe("2 min"); // rounds
    expect(fmtDuration(600)).toBe("10 min");
  });
  it("formats hours and minutes", () => {
    expect(fmtDuration(3660)).toBe("1 h 1 min");
  });
});

describe("fmtDistance", () => {
  it("uses meters under 0.1 mi", () => {
    expect(fmtDistance(50)).toBe("50 m");
  });
  it("uses miles above that", () => {
    expect(fmtDistance(1609.34)).toBe("1.0 mi");
    expect(fmtDistance(8046.7)).toBe("5.0 mi");
  });
});
