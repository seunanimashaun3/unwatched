import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode, type Bbox } from "./geocode";

const SF: Bbox = [-122.52, 37.7, -122.35, 37.83];

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
    expect(await geocode("ab", SF)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("parses Photon features into labelled points", async () => {
    mockPhoton([
      feature(-122.42, 37.77, { name: "Ferry Building", city: "San Francisco", state: "California" }),
    ]);
    const r = await geocode("ferry", SF);
    expect(r).toHaveLength(1);
    expect(r[0].point).toEqual([-122.42, 37.77]);
    expect(r[0].label).toMatch(/Ferry Building/);
  });

  it("builds an address label from housenumber + street", async () => {
    mockPhoton([
      feature(-122.41, 37.76, { housenumber: "1", street: "Dolores St", city: "San Francisco" }),
    ]);
    const r = await geocode("1 dolores", SF);
    expect(r[0].label).toMatch(/1 Dolores St/);
  });

  it("drops results outside the city bbox", async () => {
    mockPhoton([
      feature(-122.42, 37.77, { name: "In town" }),
      feature(-100.0, 40.0, { name: "Far away" }),
    ]);
    const r = await geocode("place", SF);
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe("In town");
  });

  it("returns [] on network error rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(geocode("anything", SF)).resolves.toEqual([]);
  });
});
