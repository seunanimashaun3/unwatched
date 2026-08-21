import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRouter, type WorkerLike } from "@/hooks/useRouter";
import type { RouteParams } from "@/hooks/useRouter";

interface FakeWorker extends WorkerLike {
  emit: (data: unknown) => void;
}

function makeFake(): FakeWorker {
  const fake: FakeWorker = {
    onmessage: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
    emit(data: unknown) {
      this.onmessage?.({ data } as MessageEvent);
    },
  };
  return fake;
}

const PARAMS: RouteParams = {
  start: [-122.42, 37.77],
  end: [-122.43, 37.78],
  cameraPenaltyS: 90,
  alprOnly: true,
};

describe("useRouter", () => {
  it("starts not-ready and flips ready on the worker's ready message", () => {
    const fake = makeFake();
    const { result } = renderHook(() => useRouter(() => fake));
    expect(result.current.ready).toBe(false);
    act(() => fake.emit({ type: "ready" }));
    expect(result.current.ready).toBe(true);
  });

  it("ignores route requests before the worker is ready", () => {
    const fake = makeFake();
    const { result } = renderHook(() => useRouter(() => fake));
    act(() => result.current.request(PARAMS));
    expect(fake.postMessage).not.toHaveBeenCalled();
    expect(result.current.routing).toBe(false);
  });

  it("posts a route request and enters the routing state once ready", () => {
    const fake = makeFake();
    const { result } = renderHook(() => useRouter(() => fake));
    act(() => fake.emit({ type: "ready" }));
    act(() => result.current.request(PARAMS));
    expect(fake.postMessage).toHaveBeenCalledWith({ type: "route", ...PARAMS });
    expect(result.current.routing).toBe(true);
  });

  it("stores the result and leaves the routing state on a route reply", () => {
    const fake = makeFake();
    const { result } = renderHook(() => useRouter(() => fake));
    act(() => fake.emit({ type: "ready" }));
    act(() => result.current.request(PARAMS));
    const reply = { type: "route", ok: true, fast: null, private: null };
    act(() => fake.emit(reply));
    expect(result.current.routing).toBe(false);
    expect(result.current.result).toMatchObject({ ok: true });
  });

  it("clear() drops the last result", () => {
    const fake = makeFake();
    const { result } = renderHook(() => useRouter(() => fake));
    act(() => fake.emit({ type: "ready" }));
    act(() => fake.emit({ type: "route", ok: true }));
    expect(result.current.result).not.toBeNull();
    act(() => result.current.clear());
    expect(result.current.result).toBeNull();
  });

  it("terminates the worker on unmount", () => {
    const fake = makeFake();
    const { unmount } = renderHook(() => useRouter(() => fake));
    unmount();
    expect(fake.terminate).toHaveBeenCalledOnce();
  });
});
