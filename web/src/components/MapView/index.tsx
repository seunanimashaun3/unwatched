import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Camera, LngLat, RouteResponse } from "@/lib/types";
import { buildMapStyle, cartoTiles } from "@/lib/mapStyle";
import type { Theme } from "@/components/ThemeProvider";
import { emptyFC, initMapLayers, lineFC, pointsFC, setCamVisibility } from "@/lib/mapLayers";
import { syncLiveMarker, syncMarker } from "@/lib/markers";
import type { Mode } from "@/components/Panel";

/** A point to fly to, tagged with a nonce so repeats re-trigger the effect. */
export interface Focus {
  point: LngLat;
  nonce: number;
}

/**
 * Owns the MapLibre instance and every imperative side effect on it. Purely
 * driven by props: it renders camera dots, routes, endpoint/exposure markers,
 * and reports clicks/marker drags back up via callbacks.
 */
export default function MapView({
  cameras,
  theme,
  center,
  zoom,
  focus,
  mode,
  start,
  end,
  exposurePoint,
  livePosition,
  follow,
  result,
  alprOnly,
  onPick,
  onMoveStart,
  onMoveEnd,
}: {
  cameras: Camera[];
  theme: Theme;
  center: LngLat;
  zoom: number;
  focus: Focus | null;
  mode: Mode;
  start: LngLat | null;
  end: LngLat | null;
  exposurePoint: LngLat | null;
  livePosition: LngLat | null;
  follow: boolean;
  result: RouteResponse | null;
  alprOnly: boolean;
  onPick: (p: LngLat) => void;
  onMoveStart: (p: LngLat) => void;
  onMoveEnd: (p: LngLat) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const markerA = useRef<maplibregl.Marker | null>(null);
  const markerB = useRef<maplibregl.Marker | null>(null);
  const markerE = useRef<maplibregl.Marker | null>(null);
  const markerLive = useRef<maplibregl.Marker | null>(null);

  // keep a stable click handler that reads the latest onPick
  const pick = useRef(onPick);
  pick.current = onPick;

  // ---- init once ----
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: buildMapStyle(theme),
      center,
      zoom,
      attributionControl: false,
    });
    map.current = m;
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.getCanvas().style.cursor = "crosshair";

    m.on("load", () => {
      initMapLayers(m, cameras);
      loaded.current = true;
      setCamVisibility(m, alprOnly);
    });

    m.on("click", (e) => pick.current([e.lngLat.lng, e.lngLat.lat]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras]);

  // ---- markers ----
  useEffect(() => {
    if (map.current) markerA.current = syncMarker(map.current, markerA.current, start, "a", onMoveStart);
  }, [start, onMoveStart]);
  useEffect(() => {
    if (map.current) markerB.current = syncMarker(map.current, markerB.current, end, "b", onMoveEnd);
  }, [end, onMoveEnd]);
  useEffect(() => {
    if (map.current)
      markerE.current = syncMarker(map.current, markerE.current, exposurePoint, "exp", () => {});
  }, [exposurePoint]);

  // ---- draw routes + passed cameras ----
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    const fast = result?.ok ? result.fast : undefined;
    const priv = result?.ok ? result.private : undefined;
    (m.getSource("route-fast") as maplibregl.GeoJSONSource)?.setData(fast ? lineFC(fast.path) : emptyFC());
    (m.getSource("route-private") as maplibregl.GeoJSONSource)?.setData(priv ? lineFC(priv.path) : emptyFC());
    (m.getSource("passed") as maplibregl.GeoJSONSource)?.setData(
      priv ? pointsFC(priv.cameras, cameras) : emptyFC(),
    );
    if (fast && priv) {
      const b = new maplibregl.LngLatBounds();
      [...fast.path, ...priv.path].forEach((p) => b.extend(p));
      // keep the route clear of the panel: left on desktop, bottom sheet on mobile
      const narrow = window.innerWidth < 640;
      const padding = narrow
        ? { top: 50, bottom: Math.round(window.innerHeight * 0.42), left: 30, right: 30 }
        : { top: 60, bottom: 60, left: 400, right: 60 };
      m.fitBounds(b, { padding, maxZoom: 15 });
    }
  }, [result, cameras]);

  // ---- camera visibility ----
  useEffect(() => {
    if (map.current && loaded.current) setCamVisibility(map.current, alprOnly);
  }, [alprOnly]);

  // ---- swap basemap tiles when the theme changes ----
  useEffect(() => {
    const src = map.current?.getSource("carto") as maplibregl.RasterTileSource | undefined;
    src?.setTiles(cartoTiles(theme));
  }, [theme]);

  // clear exposure marker when leaving exposure mode
  useEffect(() => {
    if (mode !== "exposure" && markerE.current) {
      markerE.current.remove();
      markerE.current = null;
    }
  }, [mode]);

  // ---- fly to a searched location ----
  useEffect(() => {
    if (map.current && focus) {
      map.current.flyTo({ center: focus.point, zoom: Math.max(map.current.getZoom(), 14), speed: 1.2 });
    }
  }, [focus]);

  // ---- live location dot + follow while driving ----
  useEffect(() => {
    if (map.current) markerLive.current = syncLiveMarker(map.current, markerLive.current, livePosition);
  }, [livePosition]);

  useEffect(() => {
    if (map.current && follow && livePosition) {
      map.current.easeTo({ center: livePosition, zoom: Math.max(map.current.getZoom(), 15), duration: 800 });
    }
  }, [livePosition, follow]);

  return <div className="fixed inset-0 h-screen w-screen" ref={el} />;
}
