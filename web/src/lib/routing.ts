// Pure routing engine — no DOM, no worker, no network. This is what the Web
// Worker wraps, and what the unit tests exercise directly.
import type {
  Edge,
  LngLat,
  RouteRequest,
  RouteResponse,
  RouteResult,
} from "./types";
import { haversine } from "./geo";

export interface GraphData {
  nodes: LngLat[];
  edges: Edge[];
  /** edgeIndex -> intermediate geometry points (endpoints implied by nodes). */
  edgeGeom: Record<string, LngLat[]>;
  /** edgeIndex -> camera indices whose road this edge passes. */
  edgeCams: Record<string, number[]>;
  /** per-camera flag: 1 if ALPR. */
  camIsAlpr: ArrayLike<number>;
}

interface Arc {
  to: number;
  edge: number;
  timeS: number;
  camAll: number;
  camAlpr: number;
}

const GRID_CELL = 0.003; // ~300 m
const MAX_SPEED_MS = 90 * (1000 / 3600); // heuristic upper bound (admissible)

// binary min-heap keyed by f-score
class Heap {
  private a: number[] = [];
  private f: number[] = [];
  push(node: number, f: number) {
    this.a.push(node);
    this.f.push(f);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.a[0];
    const n = this.a.length - 1;
    this.a[0] = this.a[n];
    this.f[0] = this.f[n];
    this.a.pop();
    this.f.pop();
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let s = i;
      if (l < this.a.length && this.f[l] < this.f[s]) s = l;
      if (r < this.a.length && this.f[r] < this.f[s]) s = r;
      if (s === i) break;
      this.swap(i, s);
      i = s;
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
  private swap(i: number, j: number) {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
    [this.f[i], this.f[j]] = [this.f[j], this.f[i]];
  }
}

export class RouteEngine {
  private nodes: LngLat[];
  private edges: Edge[];
  private edgeGeom: Record<string, LngLat[]>;
  private edgeCams: Record<string, number[]>;
  private camIsAlpr: ArrayLike<number>;
  private adj: Arc[][];
  private grid = new Map<string, number[]>();

  constructor(g: GraphData) {
    this.nodes = g.nodes;
    this.edges = g.edges;
    this.edgeGeom = g.edgeGeom;
    this.edgeCams = g.edgeCams;
    this.camIsAlpr = g.camIsAlpr;

    this.adj = Array.from({ length: this.nodes.length }, () => [] as Arc[]);
    this.edges.forEach((e, i) => {
      const [u, v, , t10, , oneway] = e;
      const timeS = t10 / 10;
      const cams = this.edgeCams[i] || [];
      let camAlpr = 0;
      for (const ci of cams) camAlpr += this.camIsAlpr[ci] ? 1 : 0;
      const uv: Arc = { to: v, edge: i, timeS, camAll: cams.length, camAlpr };
      const vu: Arc = { to: u, edge: i, timeS, camAll: cams.length, camAlpr };
      if (oneway === 0 || oneway === 1) this.adj[u].push(uv);
      if (oneway === 0 || oneway === 2) this.adj[v].push(vu);
    });

    this.nodes.forEach((n, i) => {
      const k = this.key(Math.round(n[0] / GRID_CELL), Math.round(n[1] / GRID_CELL));
      let cell = this.grid.get(k);
      if (!cell) this.grid.set(k, (cell = []));
      cell.push(i);
    });
  }

  private key(gx: number, gy: number) {
    return `${gx}:${gy}`;
  }

  /** Nearest graph node to a point, searching outward in grid rings. */
  nearestNode(p: LngLat, maxRings = 5): number {
    const gx = Math.round(p[0] / GRID_CELL);
    const gy = Math.round(p[1] / GRID_CELL);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxRings && best === -1; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cell = this.grid.get(this.key(gx + dx, gy + dy));
          if (!cell) continue;
          for (const i of cell) {
            const d = haversine(p, this.nodes[i]);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
    }
    return best;
  }

  /** Full geometry for edge i traversed starting from node `from`. */
  edgeGeometry(i: number, from: number): LngLat[] {
    const [u, v] = this.edges[i];
    const mid = this.edgeGeom[String(i)] || [];
    const pts: LngLat[] = [this.nodes[u], ...mid, this.nodes[v]];
    return from === u ? pts : [...pts].reverse();
  }

  /** A* over travel-time + camera penalty. Returns edge/from paths or null. */
  private astar(
    startNode: number,
    endNode: number,
    penaltyS: number,
    alprOnly: boolean,
  ): { edgePath: number[]; fromPath: number[] } | null {
    const N = this.nodes.length;
    const g = new Float64Array(N).fill(Infinity);
    const cameFromNode = new Int32Array(N).fill(-1);
    const cameFromEdge = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const end = this.nodes[endNode];
    const h = (i: number) => haversine(this.nodes[i], end) / MAX_SPEED_MS;

    g[startNode] = 0;
    const open = new Heap();
    open.push(startNode, h(startNode));

    while (open.size) {
      const cur = open.pop();
      if (cur === endNode) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      for (const arc of this.adj[cur]) {
        if (closed[arc.to]) continue;
        const cams = alprOnly ? arc.camAlpr : arc.camAll;
        const ng = g[cur] + arc.timeS + penaltyS * cams;
        if (ng < g[arc.to]) {
          g[arc.to] = ng;
          cameFromNode[arc.to] = cur;
          cameFromEdge[arc.to] = arc.edge;
          open.push(arc.to, ng + h(arc.to));
        }
      }
    }

    if (g[endNode] === Infinity) return null;
    const edgePath: number[] = [];
    const fromPath: number[] = [];
    let n = endNode;
    while (n !== startNode) {
      edgePath.push(cameFromEdge[n]);
      fromPath.push(cameFromNode[n]);
      n = cameFromNode[n];
    }
    edgePath.reverse();
    fromPath.reverse();
    return { edgePath, fromPath };
  }

  private assemble(
    edgePath: number[],
    fromPath: number[],
    alprOnly: boolean,
  ): RouteResult {
    const path: LngLat[] = [];
    let distanceM = 0;
    let timeS = 0;
    const camSet = new Set<number>();
    edgePath.forEach((ei, idx) => {
      const geom = this.edgeGeometry(ei, fromPath[idx]);
      const start = path.length ? 1 : 0; // skip shared vertex
      for (let k = start; k < geom.length; k++) path.push(geom[k]);
      distanceM += this.edges[ei][2];
      timeS += this.edges[ei][3] / 10;
      for (const ci of this.edgeCams[String(ei)] || []) camSet.add(ci);
    });
    const cameras = [...camSet];
    const alprCameras = cameras.filter((ci) => this.camIsAlpr[ci]);
    return {
      path,
      distanceM,
      timeS,
      cameras: alprOnly ? alprCameras : cameras,
      alprCameras,
    };
  }

  route(req: RouteRequest): RouteResponse {
    const s = this.nearestNode(req.start);
    const e = this.nearestNode(req.end);
    if (s < 0 || e < 0) return { ok: false, reason: "Couldn't snap to a road nearby." };
    if (s === e) return { ok: false, reason: "Start and destination are too close." };

    const fastP = this.astar(s, e, 0, req.alprOnly);
    if (!fastP) return { ok: false, reason: "No driving route found between those points." };
    const privP = this.astar(s, e, req.cameraPenaltyS, req.alprOnly);

    const fast = this.assemble(fastP.edgePath, fastP.fromPath, req.alprOnly);
    const priv = privP ? this.assemble(privP.edgePath, privP.fromPath, req.alprOnly) : fast;
    return { ok: true, fast, private: priv };
  }
}
