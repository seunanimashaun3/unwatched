/// <reference lib="webworker" />
import type { CameraData, Graph, RouteRequest } from "./types";
import { RouteEngine } from "./routing";
import { dataUrl } from "./dataBase";

let engine: RouteEngine | null = null;

async function load(slug: string) {
  engine = null;
  const [g, c] = await Promise.all([
    fetch(dataUrl(`${slug}/graph.json`)).then((r) => r.json() as Promise<Graph>),
    fetch(dataUrl(`${slug}/cameras.json`)).then((r) => r.json() as Promise<CameraData>),
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
