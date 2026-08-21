import { useCallback, useEffect, useRef, useState } from "react";
import DefaultRouterWorker from "@/lib/router.worker?worker";
import type { LngLat, RouteResponse } from "@/lib/types";

export interface RouteParams {
  start: LngLat;
  end: LngLat;
  cameraPenaltyS: number;
  alprOnly: boolean;
}

/** Minimal slice of the Worker API this hook uses — lets tests inject a fake. */
export interface WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
  terminate: () => void;
}

export type WorkerFactory = () => WorkerLike;

const defaultFactory: WorkerFactory = () => new DefaultRouterWorker();

/**
 * Owns the routing Web Worker. Call `load(slug)` to (re)initialize the engine
 * for a city; `ready` reflects when that city's graph is loaded. `request()`
 * computes a route; `clear()` drops the last result. The worker factory is
 * injectable so the hook is unit-testable without a real Worker.
 */
export function useRouter(makeWorker: WorkerFactory = defaultFactory) {
  const worker = useRef<WorkerLike | null>(null);
  const readyRef = useRef(false); // stable read for the memoized `request`
  const [ready, setReady] = useState(false);
  const [routing, setRouting] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);

  useEffect(() => {
    const w = makeWorker();
    worker.current = w;
    w.onmessage = (ev: MessageEvent) => {
      if (ev.data.type === "ready") {
        readyRef.current = true;
        setReady(true);
      }
      if (ev.data.type === "route") {
        setResult(ev.data as RouteResponse);
        setRouting(false);
      }
    };
    return () => w.terminate();
    // makeWorker is intentionally not a dependency — one worker per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // These are memoized (stable identity) so effects that depend on them don't
  // re-fire every render — otherwise routing loops and the panel flickers.
  const load = useCallback((slug: string) => {
    readyRef.current = false;
    setReady(false);
    setResult(null);
    worker.current?.postMessage({ type: "load", slug });
  }, []);

  const request = useCallback((params: RouteParams) => {
    if (!worker.current || !readyRef.current) return;
    setRouting(true);
    worker.current.postMessage({ type: "route", ...params });
  }, []);

  const clear = useCallback(() => setResult(null), []);

  return { ready, routing, result, load, request, clear };
}
