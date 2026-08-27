import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Camera, LngLat, RouteResponse } from "@/lib/types";
import { buildMapStyle } from "@/lib/mapStyle";
import type { Theme } from "@/components/ThemeProvider";
import { emptyFC, initMapLayers, lineFC, pointsFC, setCamVisibility, setDemographics } from "@/lib/mapLayers";
import type { OverlayVar } from "@/lib/demographics";
import { syncLiveMarker, syncMarker } from "@/lib/markers";
import { reverseGeocode } from "@/lib/geocode";
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
  highlightCameras,
  alprOnly,
  overlay,
  demoTracts,
  demoRedlining,
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
  /** camera indices to highlight big & bright (the selected route's cameras). */
  highlightCameras: number[];
  alprOnly: boolean;
  /** demographic context overlay (null = off). */
  overlay: OverlayVar | null;
  demoTracts: GeoJSON.FeatureCollection | null;
  demoRedlining: GeoJSON.FeatureCollection | null;
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

  // keep stable refs for the latest onPick / cameras (handlers registered once)
  const pick = useRef(onPick);
  pick.current = onPick;
  const camsRef = useRef(cameras);
  camsRef.current = cameras;
  const popup = useRef<maplibregl.Popup | null>(null);
  const popupSeq = useRef(0);

  // refs so we can re-apply all custom layers/data after a base-style swap
  // (a vector setStyle wipes them), plus on first load
  const resultRef = useRef(result);
  resultRef.current = result;
  const highlightRef = useRef(highlightCameras);
  highlightRef.current = highlightCameras;
  const alprRef = useRef(alprOnly);
  alprRef.current = alprOnly;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const demoTractsRef = useRef(demoTracts);
  demoTractsRef.current = demoTracts;
  const demoRedliningRef = useRef(demoRedlining);
  demoRedliningRef.current = demoRedlining;

  const applyLayers = useCallback((m: maplibregl.Map) => {
    initMapLayers(m, camsRef.current);
    const res = resultRef.current;
    const fast = res?.ok ? res.fast : undefined;
    const priv = res?.ok ? res.private : undefined;
    (m.getSource("route-fast") as maplibregl.GeoJSONSource | undefined)?.setData(fast ? lineFC(fast.path) : emptyFC());
    (m.getSource("route-private") as maplibregl.GeoJSONSource | undefined)?.setData(priv ? lineFC(priv.path) : emptyFC());
    (m.getSource("passed") as maplibregl.GeoJSONSource | undefined)?.setData(pointsFC(highlightRef.current, camsRef.current));
    setCamVisibility(m, alprRef.current);
    setDemographics(m, overlayRef.current, demoTractsRef.current, demoRedliningRef.current);
  }, []);

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
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.getCanvas().style.cursor = "crosshair";

    m.on("load", () => {
      loaded.current = true;
      applyLayers(m);
    });

    // a camera under the tap opens its details popup; otherwise set an endpoint
    const CAM_LAYERS = ["passed", "cam-glow", "cam-dot"];
    m.on("click", (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: CAM_LAYERS.filter((l) => m.getLayer(l)) });
      if (hit.length) {
        const idx = hit[0].id as number;
        showCameraPopup(m, idx);
        return;
      }
      pick.current([e.lngLat.lng, e.lngLat.lat]);
    });
    CAM_LAYERS.forEach((l) => {
      m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", l, () => (m.getCanvas().style.cursor = "crosshair"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras]);

  function camHtml(cam: Camera, address: string): string {
    const [, , isAlpr, isFlock, operator, direction, zone] = cam;
    const kind = isAlpr ? "License-plate reader" : "Surveillance camera";
    const op = operator ? String(operator) : "";
    const meta: string[] = [];
    if (direction != null) meta.push(`Faces ${bearingToCompass(direction)}`);
    if (zone) meta.push(`${zone} zone`);
    const parts = [`<div class="cam-kind">${kind}</div>`];
    // operator OR a Flock tag — never both (avoids "Flock Safety" twice)
    if (op) parts.push(`<div class="cam-op">${escapeHtml(op)}</div>`);
    else if (isFlock) parts.push(`<div class="cam-tag">Flock Safety</div>`);
    if (meta.length) parts.push(`<div class="cam-meta">${escapeHtml(meta.join(" · "))}</div>`);
    parts.push(`<div class="cam-addr">${escapeHtml(address)}</div>`);
    return `<div class="cam-popup">${parts.join("")}</div>`;
  }

  function showCameraPopup(m: maplibregl.Map, idx: number) {
    const cam = camsRef.current[idx];
    if (!cam) return;
    const [lon, lat] = cam;
    const seq = ++popupSeq.current;
    popup.current?.remove();
    const p = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: "260px" })
      .setLngLat([lon, lat])
      .setHTML(camHtml(cam, "Locating address…"))
      .addTo(m);
    popup.current = p;
    reverseGeocode(lon, lat).then((addr) => {
      if (popupSeq.current === seq && popup.current === p) {
        p.setHTML(camHtml(cam, addr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`));
      }
    });
  }

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

  // ---- draw routes ----
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    const fast = result?.ok ? result.fast : undefined;
    const priv = result?.ok ? result.private : undefined;
    (m.getSource("route-fast") as maplibregl.GeoJSONSource)?.setData(fast ? lineFC(fast.path) : emptyFC());
    (m.getSource("route-private") as maplibregl.GeoJSONSource)?.setData(priv ? lineFC(priv.path) : emptyFC());
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

  // ---- highlight the selected route's cameras (big & bright) ----
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    (m.getSource("passed") as maplibregl.GeoJSONSource)?.setData(pointsFC(highlightCameras, cameras));
  }, [highlightCameras, cameras]);

  // ---- camera visibility ----
  useEffect(() => {
    if (map.current && loaded.current) setCamVisibility(map.current, alprOnly);
  }, [alprOnly]);

  // ---- demographic context overlay ----
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    setDemographics(m, overlay, demoTracts, demoRedlining);
  }, [overlay, demoTracts, demoRedlining]);

  // ---- swap the whole base style on theme change, then re-add our layers ----
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(buildMapStyle(theme));
    m.once("styledata", () => applyLayers(m));
  }, [theme, applyLayers]);

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

function bearingToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}
