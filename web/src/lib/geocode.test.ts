import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "./geocode";
import type { LngLat } from "./types";

const NEAR: LngLat = [-122.43, 37.77]; // bias point (San Francisco)

function mockPhoton(features: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ features }) })),
  );
}

afterEach(() => vi.unstubAllGlobals());

const feature = (lon: number, lat: number, props: Record<string, string>) => ({
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
});

describe("geocode", () => {
  it("returns nothing for queries shorter than 3 chars (no request)", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await geocode("ab", NEAR)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("parses Photon features into labelled points", async () => {
    mockPhoton([
      feature(-122.42, 37.77, { name: "Ferry Building", city: "San Francisco", state: "California" }),
    ]);
    const r = await geocode("ferry", NEAR);
    expect(r).toHaveLength(1);
    expect(r[0].point).toEqual([-122.42, 37.77]);
    expect(r[0].label).toMatch(/Ferry Building/);
  });

  it("builds an address label from housenumber + street", async () => {
    mockPhoton([
      feature(-122.41, 37.76, { housenumber: "1", street: "Dolores St", city: "San Francisco" }),
    ]);
    const r = await geocode("1 dolores", NEAR);
    expect(r[0].label).toMatch(/1 Dolores St/);
  });

  it("searches globally — results far from the bias point are kept", async () => {
    mockPhoton([
      feature(-122.42, 37.77, { name: "In town" }),
      feature(-73.99, 40.73, { name: "New York place" }),
    ]);
    const r = await geocode("place", NEAR);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.label)).toContain("New York place");
  });

  it("returns [] on network error rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(geocode("anything", NEAR)).resolves.toEqual([]);
  });
});
