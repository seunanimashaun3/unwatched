/// <reference lib="webworker" />
import type { CameraData, Graph, RouteRequest } from "./types";
import { RouteEngine } from "./routing";

let engine: RouteEngine | null = null;

async function load(slug: string) {
  engine = null;
  const base = import.meta.env.BASE_URL || "/";
  const [g, c] = await Promise.all([
    fetch(`${base}data/${slug}/graph.json`).then((r) => r.json() as Promise<Graph>),
    fetch(`${base}data/${slug}/cameras.json`).then((r) => r.json() as Promise<CameraData>),
  ]);
  const camIsAlpr = new Uint8Array(c.cameras.length);
  c.cameras.forEach((cam, i) => (camIsAlpr[i] = cam[2] ? 1 : 0));
  engine = new RouteEngine({
    nodes: g.nodes,
    edges: g.edges,
    edgeGeom: g.edgeGeom,
    edgeCams: g.edgeCams,
    camIsAlpr,
  });
  (self as unknown as Worker).postMessage({ type: "ready", slug });
}

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === "load") {
    load(msg.slug).catch((e) =>
      (self as unknown as Worker).postMessage({ type: "error", reason: String(e) }),
    );
  } else if (msg.type === "route" && engine) {
    const res = engine.route(msg as RouteRequest);
    (self as unknown as Worker).postMessage({ type: "route", ...res });
  }
};
