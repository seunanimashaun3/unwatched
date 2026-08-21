import type { RouteResult } from "./types";

export type VerdictKind = "identical" | "win" | "no-benefit";

export interface Verdict {
  /** cameras avoided by taking the private route instead of the fastest. */
  savedCameras: number;
  /** extra seconds the private route costs vs. the fastest. */
  extraTimeS: number;
  kind: VerdictKind;
}

/**
 * Compare the fastest and least-watched routes into a human verdict.
 * Pure so the messaging logic can be tested without rendering.
 */
export function summarizeRoutes(fast: RouteResult, priv: RouteResult): Verdict {
  const savedCameras = fast.cameras.length - priv.cameras.length;
  const extraTimeS = priv.timeS - fast.timeS;
  // "identical" = same roads effectively: no cameras saved and negligible time delta
  const identical = savedCameras <= 0 && Math.abs(extraTimeS) < 30;
  const kind: VerdictKind = identical ? "identical" : savedCameras > 0 ? "win" : "no-benefit";
  return { savedCameras, extraTimeS, kind };
}

/** Label for the detour-tolerance slider value (seconds of penalty per camera). */
export function detourLabel(penaltyS: number): string {
  if (penaltyS < 45) return "Barely detour";
  if (penaltyS < 135) return "Balanced";
  if (penaltyS < 240) return "Prefer privacy";
  return "Avoid at all costs";
}
