// Headless verification of the shipped graph + routing logic.
// Loads the real generated web/public/data assets, runs the same A* the worker
// runs, and checks that the "least-watched" route actually reduces camera
// exposure vs the fastest route for several SF trips.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const slug = process.argv[2] || "san-francisco-ca";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "public", "data", slug);
const graph = JSON.parse(readFileSync(join(DIR, "graph.json"), "utf8"));
const camData = JSON.parse(readFileSync(join(DIR, "cameras.json"), "utf8"));

const nodes = graph.nodes;
const edges = graph.edges;
const edgeCams = graph.edgeCams;
const camIsAlpr = camData.cameras.map((c) => (c[2] ? 1 : 0));

function haversine(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const la1 = a[1] * toRad, la2 = b[1] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// adjacency
const adj = Array.from({ length: nodes.length }, () => []);
edges.forEach((e, i) => {
  const [u, v, , t10, , ow] = e;
  const cams = edgeCams[i] || [];
  let alpr = 0;
  for (const ci of cams) alpr += camIsAlpr[ci];
  const arc = (to) => ({ to, edge: i, timeS: t10 / 10, camAll: cams.length, camAlpr: alpr });
  if (ow === 0 || ow === 1) adj[u].push(arc(v));
  if (ow === 0 || ow === 2) adj[v].push(arc(u));
});

const CELL = 0.003;
const grid = new Map();
nodes.forEach((n, i) => {
  const k = `${Math.round(n[0] / CELL)}:${Math.round(n[1] / CELL)}`;
  (grid.get(k) || grid.set(k, []).get(k)).push(i);
});
function nearest(p) {
  const gx = Math.round(p[0] / CELL), gy = Math.round(p[1] / CELL);
  let best = -1, bd = Infinity;
  for (let r = 0; r <= 4 && best === -1; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const i of grid.get(`${gx + dx}:${gy + dy}`) || []) {
          const d = haversine(p, nodes[i]);
          if (d < bd) { bd = d; best = i; }
        }
      }
  return best;
}

const MAXV = 90 * (1000 / 3600);
function astar(s, e, penalty, alprOnly) {
  const N = nodes.length;
  const g = new Float64Array(N).fill(Infinity);
  const fromE = new Int32Array(N).fill(-1);
  const fromN = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const end = nodes[e];
  const heap = [[haversine(nodes[s], end) / MAXV, s]];
  g[s] = 0;
  const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2*i+1, r = 2*i+2; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [, cur] = pop();
    if (cur === e) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    for (const a of adj[cur]) {
      if (closed[a.to]) continue;
      const cams = alprOnly ? a.camAlpr : a.camAll;
      const ng = g[cur] + a.timeS + penalty * cams;
      if (ng < g[a.to]) { g[a.to] = ng; fromN[a.to] = cur; fromE[a.to] = a.edge; push(ng + haversine(nodes[a.to], end) / MAXV, a.to); }
    }
  }
  if (g[e] === Infinity) return null;
  let n = e, dist = 0, time = 0; const camSet = new Set();
  while (n !== s) { const ei = fromE[n]; dist += edges[ei][2]; time += edges[ei][3] / 10; for (const ci of edgeCams[ei] || []) camSet.add(ci); n = fromN[n]; }
  const cams = [...camSet].filter((ci) => (alprOnly ? camIsAlpr[ci] : true));
  return { dist, time, cams: cams.length };
}

// use the city's own presets (guaranteed in-graph) as the test trips
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"));
const TRIPS = meta.presets.map((p) => [p.label, p.a, p.b]);

console.log(`graph: ${nodes.length} nodes, ${edges.length} edges, ${camData.cameras.length} cameras\n`);
let pass = 0;
for (const [name, a, b] of TRIPS) {
  const s = nearest(a), e = nearest(b);
  const t0 = Date.now();
  const fast = astar(s, e, 0, true);
  const priv = astar(s, e, 90, true);
  const ms = Date.now() - t0;
  if (!fast || !priv) { console.log(`${name}: NO ROUTE`); continue; }
  const okReduced = priv.cams <= fast.cams;
  const okReachable = fast.dist > 0;
  if (okReduced && okReachable) pass++;
  console.log(
    `${name}\n  fastest: ${(fast.time/60).toFixed(1)}min ${(fast.dist/1609).toFixed(1)}mi ${fast.cams} ALPR\n` +
    `  private: ${(priv.time/60).toFixed(1)}min ${(priv.dist/1609).toFixed(1)}mi ${priv.cams} ALPR` +
    `  (avoided ${fast.cams - priv.cams}, both routes in ${ms}ms)\n`,
  );
}
console.log(`\n${pass}/${TRIPS.length} trips valid (route found + private never worse than fastest)`);
process.exit(pass === TRIPS.length ? 0 : 1);
