import { afterEach, describe, expect, it } from "vitest";
import { clearLastCity, loadLastCity, saveLastCity, validCity } from "./lastCity";
import type { CityIndexEntry } from "./types";

const cities = [
  { slug: "atlanta-ga", city: "Atlanta", state: "GA", center: [0, 0], zoom: 10, counts: { alpr: 1, cameras: 1, flock: 0 } },
  { slug: "memphis-tn", city: "Memphis", state: "TN", center: [0, 0], zoom: 10, counts: { alpr: 1, cameras: 1, flock: 0 } },
] as unknown as CityIndexEntry[];

afterEach(() => localStorage.clear());

describe("lastCity persistence", () => {
  it("round-trips a saved city and clears it", () => {
    expect(loadLastCity()).toBe("");
    saveLastCity("atlanta-ga");
    expect(loadLastCity()).toBe("atlanta-ga");
    clearLastCity();
    expect(loadLastCity()).toBe("");
  });
});

describe("validCity", () => {
  it("keeps a persisted slug only if it still exists", () => {
    expect(validCity("atlanta-ga", cities)).toBe("atlanta-ga");
  });

  it("drops a removed/unknown slug (falls back to the Overview)", () => {
    expect(validCity("gone-city", cities)).toBe("");
    expect(validCity("", cities)).toBe("");
  });
});
