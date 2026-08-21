import type { LngLat } from "./types";

export function fmtPoint(p: LngLat): string {
  return `${p[1].toFixed(4)}, ${p[0].toFixed(4)}`;
}
