import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDriveAlerts } from "@/hooks/useDriveAlerts";
import type { Camera, LngLat } from "@/lib/types";

// one ALPR camera at the origin
const CAMERAS: Camera[] = [[0, 0, 1, 0, "Flock Safety"]];

function run(fix: LngLat | null) {
  return renderHook(({ f }: { f: LngLat | null }) => useDriveAlerts(f, CAMERAS, { enabled: true, alprOnly: true }), {
    initialProps: { f: fix },
  });
}

describe("useDriveAlerts", () => {
  it("warns when a camera is within the alert radius", () => {
    const { result, rerender } = run(null);
    rerender({ f: [0, 0.0015] }); // ~166 m north of the camera (< 200 m)
    expect(result.current.alert?.cameraIndex).toBe(0);
    expect(result.current.alert?.distanceM).toBeGreaterThan(100);
    expect(result.current.loggedCount).toBe(0); // not yet within the logged radius
  });

  it("counts a camera as logged once you pass within ~35 m", () => {
    const { result, rerender } = run(null);
    rerender({ f: [0, 0.0002] }); // ~22 m — logged
    expect(result.current.loggedCount).toBe(1);
  });

  it("does not double-count or re-alert the same camera", () => {
    const { result, rerender } = run(null);
    rerender({ f: [0, 0.0003] }); // logged once
    rerender({ f: [0, 0.00025] }); // still near — no new log
    expect(result.current.loggedCount).toBe(1);
  });

  it("stays silent when disabled", () => {
    const { result, rerender } = renderHook(
      ({ f }: { f: LngLat | null }) => useDriveAlerts(f, CAMERAS, { enabled: false, alprOnly: true }),
      { initialProps: { f: null as LngLat | null } },
    );
    rerender({ f: [0, 0.0002] });
    expect(result.current.alert).toBeNull();
    expect(result.current.loggedCount).toBe(0);
  });

  it("dismiss() clears the active alert", () => {
    const { result, rerender } = run(null);
    rerender({ f: [0, 0.0015] });
    expect(result.current.alert).not.toBeNull();
    result.current.dismiss();
    // dismiss triggers a state update; assert via a rerender read
    rerender({ f: [0, 0.0015] });
    expect(result.current.alert).toBeNull();
  });
});
