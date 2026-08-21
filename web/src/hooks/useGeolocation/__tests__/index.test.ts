import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGeolocation } from "@/hooks/useGeolocation";

function pos(lon: number, lat: number, accuracy = 10): GeolocationPosition {
  return {
    coords: { longitude: lon, latitude: lat, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null } as GeolocationCoordinates,
    timestamp: 0,
  } as GeolocationPosition;
}

function fakeGeo() {
  const state: { watchOk?: PositionCallback; watchErr?: PositionErrorCallback } = {};
  const geo = {
    getCurrentPosition: vi.fn((ok: PositionCallback) => ok(pos(-121.9, 37.34))),
    watchPosition: vi.fn((ok: PositionCallback, err: PositionErrorCallback) => {
      state.watchOk = ok;
      state.watchErr = err;
      return 42;
    }),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;
  return { geo, emit: (p: GeolocationPosition) => state.watchOk?.(p) };
}

describe("useGeolocation", () => {
  it("locateOnce resolves a fix and stores it", async () => {
    const { geo } = fakeGeo();
    const { result } = renderHook(() => useGeolocation(geo));
    let fix;
    await act(async () => {
      fix = await result.current.locateOnce();
    });
    expect(fix).toMatchObject({ point: [-121.9, 37.34] });
    expect(result.current.fix?.point).toEqual([-121.9, 37.34]);
  });

  it("start() watches and updates on each fix; stop() clears the watch", () => {
    const { geo, emit } = fakeGeo();
    const { result } = renderHook(() => useGeolocation(geo));

    act(() => result.current.start());
    expect(result.current.watching).toBe(true);

    act(() => emit(pos(-121.88, 37.33, 5)));
    expect(result.current.fix).toMatchObject({ point: [-121.88, 37.33], accuracyM: 5 });

    act(() => result.current.stop());
    expect(geo.clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(false);
  });

  it("reports an error when geolocation is unsupported", () => {
    const { result } = renderHook(() => useGeolocation(undefined));
    act(() => result.current.start());
    expect(result.current.error).toMatch(/isn't supported/i);
  });
});
