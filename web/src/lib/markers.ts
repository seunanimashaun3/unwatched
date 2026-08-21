import maplibregl from "maplibre-gl";
import type { LngLat } from "./types";

export type MarkerKind = "a" | "b" | "exp";

const BG: Record<MarkerKind, string> = {
  a: "#ffffff",
  b: "#35e0a1",
  exp: "#6ea8fe",
};

/**
 * Create/update/remove a styled HTML marker. Returns the marker (or null when
 * the point is null and it was removed). Draggable for A/B endpoints.
 */
export function syncMarker(
  m: maplibregl.Map,
  existing: maplibregl.Marker | null,
  p: LngLat | null,
  kind: MarkerKind,
  onDrag: (p: LngLat) => void,
): maplibregl.Marker | null {
  if (!p) {
    existing?.remove();
    return null;
  }
  if (existing) {
    existing.setLngLat(p);
    return existing;
  }
  const el = document.createElement("div");
  el.className = `mk mk-${kind}`;
  const size = kind === "exp" ? "18px" : "26px";
  Object.assign(el.style, {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontWeight: "700",
    fontSize: "12px",
    color: "#05070a",
    boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
    cursor: "grab",
    border: "2px solid rgba(0,0,0,0.35)",
    background: BG[kind],
  } as Partial<CSSStyleDeclaration>);
  el.textContent = kind === "exp" ? "" : kind.toUpperCase();
  const mk = new maplibregl.Marker({ element: el, draggable: kind !== "exp" })
    .setLngLat(p)
    .addTo(m);
  mk.on("dragend", () => {
    const ll = mk.getLngLat();
    onDrag([ll.lng, ll.lat]);
  });
  return mk;
}

/** A pulsing "you are here" dot for Drive mode. */
export function syncLiveMarker(
  m: maplibregl.Map,
  existing: maplibregl.Marker | null,
  p: LngLat | null,
): maplibregl.Marker | null {
  if (!p) {
    existing?.remove();
    return null;
  }
  if (existing) {
    existing.setLngLat(p);
    return existing;
  }
  const el = document.createElement("div");
  el.className = "live-dot";
  return new maplibregl.Marker({ element: el }).setLngLat(p).addTo(m);
}
