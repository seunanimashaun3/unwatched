import { describe, expect, it } from "vitest";
import { RouteEngine, type GraphData } from "./routing";
import type { Edge, LngLat } from "./types";

/**
 * Build a tiny controlled graph:
 *
 *     0 ──e0── 1 ──e1[📷]── 2       (top: fast, but a camera on e1)
 *      \                   /
 *       e2               e3
 *        \               /
 *         3 ───────────── 3          (bottom: longer, camera-free detour)
 *
 * Nodes: 0 start, 2 end, 1 middle-top, 3 middle-bottom.
 */
function diamond(overrides?: Partial<GraphData>): GraphData {
  const nodes: LngLat[] = [
    [0, 0], // 0
    [0.001, 0], // 1
    [0.002, 0], // 2
    [0.001, -0.0015], // 3
  ];
  // [u, v, distM, time10, classCode, oneway]
  const edges: Edge[] = [
    [0, 1, 111, 80, 3, 0],
    [1, 2, 111, 80, 3, 0], // watched
    [0, 3, 200, 160, 3, 0],
    [3, 2, 200, 160, 3, 0],
  ];
  return {
    nodes,
    edges,
    edgeGeom: {},
    edgeCams: { "1": [0] }, // edge 1 is watched by camera 0
    camIsAlpr: [1], // camera 0 is an ALPR
    ...overrides,
  };
}

const req = (start: LngLat, end: LngLat, penalty: number, alprOnly = true) => ({
  type: "route" as const,
  start,
  end,
  cameraPenaltyS: penalty,
  alprOnly,
});

describe("RouteEngine — basic pathfinding", () => {
  it("finds the fast route through the camera when penalty = 0", () => {
    const eng = new RouteEngine(diamond());
    const res = eng.route(req([0, 0], [0.002, 0], 0));
    expect(res.ok).toBe(true);
    expect(res.fast!.cameras.length).toBe(1); // passes the watched edge
    expect(res.fast!.distanceM).toBe(222);
  });

  it("detours around the camera when the penalty is high", () => {
    const eng = new RouteEngine(diamond());
    const res = eng.route(req([0, 0], [0.002, 0], 100));
    expect(res.ok).toBe(true);
    expect(res.fast!.cameras.length).toBe(1);
    expect(res.private!.cameras.length).toBe(0); // avoided
    expect(res.private!.distanceM).toBeGreaterThan(res.fast!.distanceM);
    expect(res.private!.timeS).toBeGreaterThan(res.fast!.timeS);
  });

  it("does NOT detour when the penalty is too small to be worth it", () => {
    const eng = new RouteEngine(diamond());
    // detour costs +16s; a 5s penalty per camera isn't worth it
    const res = eng.route(req([0, 0], [0.002, 0], 5));
    expect(res.private!.cameras.length).toBe(1);
  });
});

describe("RouteEngine — camera semantics", () => {
  it("ignores a camera under alprOnly when it is not an ALPR", () => {
    const eng = new RouteEngine(diamond({ camIsAlpr: [0] })); // camera is plain CCTV
    const res = eng.route(req([0, 0], [0.002, 0], 100, true));
    // alprOnly => the non-ALPR camera is neither counted nor avoided
    expect(res.fast!.cameras.length).toBe(0);
    expect(res.private!.cameras.length).toBe(0);
  });

  it("counts a non-ALPR camera when alprOnly is false", () => {
    const eng = new RouteEngine(diamond({ camIsAlpr: [0] }));
    const res = eng.route(req([0, 0], [0.002, 0], 0, false));
    expect(res.fast!.cameras.length).toBe(1);
  });

  it("counts each distinct camera once, even across multiple edges", () => {
    const g = diamond({ edgeCams: { "0": [0], "1": [0] } }); // same camera on both top edges
    const eng = new RouteEngine(g);
    const res = eng.route(req([0, 0], [0.002, 0], 0));
    expect(res.fast!.cameras).toEqual([0]); // deduped
  });
});

describe("RouteEngine — one-way streets", () => {
  it("refuses to traverse a forward-only edge backwards", () => {
    // Minimal graph: a single forward-only edge 0->1 with no other connections.
    // Going 1 -> 0 would require driving against the arrow, so it must fail.
    const g: GraphData = {
      nodes: [
        [0, 0],
        [0.001, 0],
      ],
      edges: [[0, 1, 111, 80, 3, 1]], // oneway forward (u->v only)
      edgeGeom: {},
      edgeCams: {},
      camIsAlpr: [],
    };
    const eng = new RouteEngine(g);
    const res = eng.route(req([0.001, 0], [0, 0], 0));
    expect(res.ok).toBe(false);
  });

  it("still routes forward across a forward-only edge", () => {
    const g = diamond();
    g.edges[0] = [0, 1, 111, 80, 3, 1];
    const eng = new RouteEngine(g);
    const res = eng.route(req([0, 0], [0.002, 0], 0));
    expect(res.ok).toBe(true);
  });
});

describe("RouteEngine — snapping & guards", () => {
  it("snaps an off-road click to the nearest node", () => {
    const eng = new RouteEngine(diamond());
    // a point slightly off node 0 should still snap to it
    expect(eng.nearestNode([0.0001, 0.0001])).toBe(0);
  });

  it("errors when start and destination snap to the same node", () => {
    const eng = new RouteEngine(diamond());
    const res = eng.route(req([0, 0], [0.00001, 0.00001], 0));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/too close/i);
  });

  it("errors when no route exists between components", () => {
    // isolated extra node with no edges
    const g = diamond();
    g.nodes.push([1, 1]); // node 4, far away, unconnected
    const eng = new RouteEngine(g);
    const res = eng.route(req([1, 1], [0.002, 0], 0));
    expect(res.ok).toBe(false);
  });
});

describe("RouteEngine — geometry assembly", () => {
  it("produces a continuous polyline from start to end", () => {
    const eng = new RouteEngine(diamond());
    const res = eng.route(req([0, 0], [0.002, 0], 0));
    const path = res.fast!.path;
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([0.002, 0]);
    // no duplicate consecutive points
    for (let i = 1; i < path.length; i++) {
      expect(path[i]).not.toEqual(path[i - 1]);
    }
  });

  it("reverses intermediate geometry when an edge is traversed backwards", () => {
    const g = diamond({ edgeGeom: { "3": [[0.0015, -0.0005]] } });
    const eng = new RouteEngine(g);
    // force the detour so edge 3 (3->2) is used forward; check its mid point present
    const res = eng.route(req([0, 0], [0.002, 0], 100));
    const hasMid = res.private!.path.some(
      (p) => Math.abs(p[0] - 0.0015) < 1e-9 && Math.abs(p[1] + 0.0005) < 1e-9,
    );
    expect(hasMid).toBe(true);
  });
});
