export type LngLat = [number, number];

/** Compact edge: [u, v, distMeters, timeS*10, classCode, oneway(0|1|2)]. */
export type Edge = [number, number, number, number, number, number];

export interface Graph {
  nodes: LngLat[];
  edges: Edge[];
  /** edgeIndex -> intermediate geometry points (endpoints implied by nodes). */
  edgeGeom: Record<string, LngLat[]>;
  /** edgeIndex -> camera indices whose road this edge passes within seeRadius. */
  edgeCams: Record<string, number[]>;
  classSpeedKmh: Record<string, number>;
  seeRadiusM: number;
}

/** Camera: [lon, lat, isAlpr(0|1), isFlock(0|1), operator]. */
/** [lon, lat, isAlpr(0|1), isFlock(0|1), operator, direction(deg|null), zone]. */
export type Camera = [number, number, number, number, string, (number | null)?, string?];

export interface CameraData {
  seeRadiusM: number;
  cameras: Camera[];
}

export interface Preset {
  label: string;
  a: LngLat;
  b: LngLat;
}

export interface Meta {
  slug: string;
  city: string;
  state: string;
  center: LngLat;
  zoom: number;
  /** [W, S, E, N] — bounds geocoding search to the city. */
  bbox: [number, number, number, number];
  presets: Preset[];
  overtureRelease: string;
  cameraSource: string;
  counts: {
    nodes: number;
    edges: number;
    cameras: number;
    alpr: number;
    flock: number;
    watchedEdges: number;
  };
}

/** One entry in web/public/data/cities.json (the home-page index). */
export interface CityIndexEntry {
  slug: string;
  city: string;
  state: string;
  center: LngLat;
  zoom: number;
  counts: { alpr: number; cameras: number; flock: number };
}

export interface CitiesIndex {
  cities: CityIndexEntry[];
}

export interface RouteResult {
  /** Ordered [lon,lat] polyline for drawing. */
  path: LngLat[];
  distanceM: number;
  timeS: number;
  /** Distinct camera indices this route passes. */
  cameras: number[];
  /** Distinct ALPR camera indices (subset of cameras). */
  alprCameras: number[];
}

export interface RouteResponse {
  ok: boolean;
  reason?: string;
  fast?: RouteResult;
  private?: RouteResult;
}

export interface RouteRequest {
  type: "route";
  start: LngLat;
  end: LngLat;
  /** Seconds of penalty added per camera an edge is watched by. */
  cameraPenaltyS: number;
  /** If true, only ALPR cameras are avoided/counted (driving mode). */
  alprOnly: boolean;
}
