// Integration test: run the real RouteEngine against the actual generated SF
// data (web/public/data). Guards the end-to-end promise of the product —
// "least-watched routes really avoid cameras" — on real Overture + DeFlock data.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RouteEngine } from "./routing";
import type { CameraData, Graph, LngLat } from "./types";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "data", "san-francisco-ca");
const hasData = existsSync(join(DATA, "graph.json"));

const load = () => {
  const g = JSON.parse(readFileSync(join(DATA, "graph.json"), "utf8")) as Graph;
  const c = JSON.parse(readFileSync(join(DATA, "cameras.json"), "utf8")) as CameraData;
  const camIsAlpr = new Uint8Array(c.cameras.length);
  c.cameras.forEach((cam, i) => (camIsAlpr[i] = cam[2] ? 1 : 0));
  const engine = new RouteEngine({
    nodes: g.nodes,
    edges: g.edges,
    edgeGeom: g.edgeGeom,
    edgeCams: g.edgeCams,
    camIsAlpr,
  });
  return { g, c, engine };
};

const TRIPS: { name: string; a: LngLat; b: LngLat }[] = [
  { name: "Mission → Marina", a: [-122.4194, 37.7599], b: [-122.4368, 37.803] },
  { name: "Downtown → Sunset", a: [-122.4058, 37.7887], b: [-122.4944, 37.7558] },
  { name: "Castro → Bayview", a: [-122.435, 37.7609], b: [-122.39, 37.735] },
];

const d = hasData ? describe : describe.skip;

d("real SF data — routing invariants", () => {
  for (const trip of TRIPS) {
    it(`${trip.name}: routes exist and least-watched never exposes more cameras`, () => {
      const { engine } = load();
      const res = engine.route({
        type: "route",
        start: trip.a,
        end: trip.b,
        cameraPenaltyS: 90,
        alprOnly: true,
      });
      expect(res.ok).toBe(true);
      const fast = res.fast!;
      const priv = res.private!;

      // routes are real
      expect(fast.distanceM).toBeGreaterThan(500);
      expect(fast.path.length).toBeGreaterThan(2);

      // core product guarantee: avoiding known cameras never increases exposure
      expect(priv.cameras.length).toBeLessThanOrEqual(fast.cameras.length);

      // fastest is never slower than the private detour
      expect(fast.timeS).toBeLessThanOrEqual(priv.timeS + 1);
    });
  }

  it("a stronger penalty never yields MORE cameras than a weaker one (monotonic)", () => {
    const { engine } = load();
    const trip = TRIPS[0];
    const run = (penalty: number) =>
      engine.route({
        type: "route",
        start: trip.a,
        end: trip.b,
        cameraPenaltyS: penalty,
        alprOnly: true,
      }).private!.cameras.length;
    const low = run(15);
    const high = run(300);
    expect(high).toBeLessThanOrEqual(low);
  });

  it("at least one preset shows a real privacy win (fewer cameras)", () => {
    const { engine } = load();
    const wins = TRIPS.map((t) => {
      const r = engine.route({
        type: "route",
        start: t.a,
        end: t.b,
        cameraPenaltyS: 120,
        alprOnly: true,
      });
      return r.fast!.cameras.length - r.private!.cameras.length;
    });
    expect(Math.max(...wins)).toBeGreaterThan(0);
  });
});

d("real SF data — data contract", () => {
  it("graph is internally consistent", () => {
    const { g } = load();
    const N = g.nodes.length;
    expect(N).toBeGreaterThan(1000);
    expect(g.edges.length).toBeGreaterThan(1000);

    // every node coord is a valid SF lng/lat
    for (const [lon, lat] of g.nodes) {
      expect(lon).toBeGreaterThan(-122.6);
      expect(lon).toBeLessThan(-122.3);
      expect(lat).toBeGreaterThan(37.6);
      expect(lat).toBeLessThan(37.9);
    }

    // every edge references valid nodes and has sane values
    for (const [u, v, dist, t10, , ow] of g.edges) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(N);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(N);
      expect(dist).toBeGreaterThanOrEqual(0);
      expect(t10).toBeGreaterThanOrEqual(0);
      expect([0, 1, 2]).toContain(ow);
    }
  });

  it("every edge→camera reference points to a real camera", () => {
    const { g, c } = load();
    const numCams = c.cameras.length;
    for (const key of Object.keys(g.edgeCams)) {
      const ei = Number(key);
      expect(ei).toBeGreaterThanOrEqual(0);
      expect(ei).toBeLessThan(g.edges.length);
      for (const ci of g.edgeCams[key]) {
        expect(ci).toBeGreaterThanOrEqual(0);
        expect(ci).toBeLessThan(numCams);
      }
    }
  });

  it("camera counts are plausible (ALPR is a subset of all cameras)", () => {
    const { c } = load();
    const alpr = c.cameras.filter((cam) => cam[2] === 1).length;
    expect(alpr).toBeGreaterThan(0);
    expect(alpr).toBeLessThan(c.cameras.length);
  });
});
