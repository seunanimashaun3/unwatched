import type { Camera, RouteResult } from "./types";

/** Assumed commuting days per year for the yearly projection. */
export const WORKDAYS_PER_YEAR = 250;

export interface CommuteExposure {
  /** plate-reader logs on one trip (one way). */
  perTrip: number;
  /** perTrip × 2 (round trip) × workdays. */
  perYear: number;
  /** distinct named operators that log you on this route. */
  agencies: string[];
  /** some logging cameras had no operator in the data. */
  hasUnknown: boolean;
}

/**
 * How often a given route gets you logged by license-plate readers — the
 * personal, visceral version of the abstract camera count. Pure + testable.
 * Uses ALPR cameras only (those are what create a record); the operator field
 * (camera[4]) gives the agencies doing the logging.
 */
export function commuteExposure(
  route: RouteResult,
  cameras: Camera[],
  workdays = WORKDAYS_PER_YEAR,
): CommuteExposure {
  const perTrip = route.alprCameras.length;
  const named = new Set<string>();
  let hasUnknown = false;
  for (const i of route.alprCameras) {
    const op = String(cameras[i]?.[4] ?? "").trim();
    if (op) named.add(op);
    else hasUnknown = true;
  }
  return {
    perTrip,
    perYear: perTrip * 2 * workdays,
    agencies: [...named].sort((a, b) => a.localeCompare(b)),
    hasUnknown,
  };
}
