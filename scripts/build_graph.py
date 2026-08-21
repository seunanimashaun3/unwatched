"""
Build the routable graph the browser ships with, for one city.

Usage:  python scripts/build_graph.py <city-slug>
Input  (data/raw/<slug>/):   segments.jsonl, cameras.geojson, neighborhoods.geojson
Output (web/public/data/<slug>/):
    graph.json      nodes + edges + which cameras each edge passes
    cameras.json    trimmed camera points (index-addressed)
    meta.json       city info (name, center, zoom, presets) + counts + source

Pipeline: split segments at connectors -> edges; keep the largest connected
component; attach each camera to the edges it watches (within SEE_RADIUS_M).
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from cities import get_city

ROOT = Path(__file__).resolve().parent.parent
SEE_RADIUS_M = 30.0

CLASS_SPEED_KMH = {
    "motorway": 90, "trunk": 70, "primary": 50, "secondary": 45,
    "tertiary": 40, "residential": 30, "unclassified": 35,
    "living_street": 15, "service": 15,
}
CLASS_CODE = {c: i for i, c in enumerate(CLASS_SPEED_KMH)}


def haversine(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def cumulative_lengths(coords):
    cum = [0.0]
    for i in range(1, len(coords)):
        cum.append(cum[-1] + haversine(coords[i - 1], coords[i]))
    return cum


def point_at_fraction(coords, cum, frac):
    total = cum[-1]
    if total == 0:
        return coords[0]
    target = max(0.0, min(1.0, frac)) * total
    for i in range(1, len(coords)):
        if cum[i] >= target:
            span = cum[i] - cum[i - 1]
            t = 0 if span == 0 else (target - cum[i - 1]) / span
            return [
                coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
                coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
            ]
    return coords[-1]


def slice_polyline(coords, cum, f0, f1):
    total = cum[-1]
    t0, t1 = f0 * total, f1 * total
    pts = [point_at_fraction(coords, cum, f0)]
    for i in range(len(coords)):
        if t0 < cum[i] < t1:
            pts.append(coords[i])
    pts.append(point_at_fraction(coords, cum, f1))
    out = [pts[0]]
    for p in pts[1:]:
        if p != out[-1]:
            out.append(p)
    return out


def build_edges(raw_dir):
    node_index = {}
    node_coords = []
    edges = []

    def node_for(cid, coord):
        if cid not in node_index:
            node_index[cid] = len(node_coords)
            node_coords.append([round(coord[0], 6), round(coord[1], 6)])
        return node_index[cid]

    n_seg = 0
    for line in (raw_dir / "segments.jsonl").read_text().splitlines():
        seg = json.loads(line)
        coords = seg["coords"]
        conns = seg["connectors"]
        if len(coords) < 2 or len(conns) < 2:
            continue
        conns = sorted(conns, key=lambda c: c["at"])
        cum = cumulative_lengths(coords)
        speed = CLASS_SPEED_KMH.get(seg["class"], 30)
        ccode = CLASS_CODE.get(seg["class"], 5)
        ow_code = {None: 0, "forward": 1, "backward": 2}[seg.get("oneway")]

        for i in range(len(conns) - 1):
            c0, c1 = conns[i], conns[i + 1]
            u = node_for(c0["id"], point_at_fraction(coords, cum, c0["at"]))
            v = node_for(c1["id"], point_at_fraction(coords, cum, c1["at"]))
            if u == v:
                continue
            geom = slice_polyline(coords, cum, c0["at"], c1["at"])
            dist = sum(haversine(geom[k - 1], geom[k]) for k in range(1, len(geom)))
            if dist < 0.5:
                continue
            edges.append([u, v, dist, dist / (speed * 1000 / 3600), ccode, ow_code, geom])
        n_seg += 1

    print(f"  {n_seg} segments -> {len(edges)} edges, {len(node_coords)} nodes")
    return node_coords, edges


def largest_component(n_nodes, edges):
    """Largest strongly connected component, respecting one-way directions.

    We keep the largest SCC (not just the weakly-connected component) so that
    *every* kept node can reach every other kept node — otherwise A* could hit
    a one-way dead-end and report "no route" for a valid-looking trip.
    Iterative Kosaraju (no recursion, safe for ~100k nodes).
    """
    out = [[] for _ in range(n_nodes)]
    rev = [[] for _ in range(n_nodes)]
    for e in edges:
        u, v, ow = e[0], e[1], e[5]
        if ow in (0, 1):
            out[u].append(v)
            rev[v].append(u)
        if ow in (0, 2):
            out[v].append(u)
            rev[u].append(v)

    # pass 1: push finish order
    visited = bytearray(n_nodes)
    order = []
    for s in range(n_nodes):
        if visited[s]:
            continue
        stack = [(s, iter(out[s]))]
        visited[s] = 1
        while stack:
            node, it = stack[-1]
            advanced = False
            for w in it:
                if not visited[w]:
                    visited[w] = 1
                    stack.append((w, iter(out[w])))
                    advanced = True
                    break
            if not advanced:
                order.append(node)
                stack.pop()

    # pass 2: SCCs on the reversed graph, in reverse finish order
    comp = [-1] * n_nodes
    best = set()
    label = 0
    for s in reversed(order):
        if comp[s] != -1:
            continue
        members, stack = [], [s]
        comp[s] = label
        while stack:
            x = stack.pop()
            members.append(x)
            for w in rev[x]:
                if comp[w] == -1:
                    comp[w] = label
                    stack.append(w)
        if len(members) > len(best):
            best = set(members)
        label += 1
    return best


def point_seg_dist_m(p, a, b):
    lat0 = math.radians(p[1])
    mx = 111320 * math.cos(lat0)
    my = 110540
    px, py = p[0] * mx, p[1] * my
    ax, ay = a[0] * mx, a[1] * my
    bx, by = b[0] * mx, b[1] * my
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def assign_cameras(edges, cameras):
    cell = 0.0025
    grid = defaultdict(list)
    for ci, cam in enumerate(cameras):
        grid[(round(cam["lon"] / cell), round(cam["lat"] / cell))].append(ci)

    edge_cams = [[] for _ in edges]
    for ei, e in enumerate(edges):
        geom = e[6]
        checked = set()
        for k in range(1, len(geom)):
            a, b = geom[k - 1], geom[k]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            gx, gy = round(mid[0] / cell), round(mid[1] / cell)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for ci in grid.get((gx + dx, gy + dy), ()):
                        if ci in checked:
                            continue
                        cam = cameras[ci]
                        if point_seg_dist_m([cam["lon"], cam["lat"]], a, b) <= SEE_RADIUS_M:
                            checked.add(ci)
        edge_cams[ei] = sorted(checked)
    return edge_cams


def auto_presets(node_coords, bbox):
    """Directional cross-town sample trips, snapped to real nodes."""
    w, s, e, n = bbox

    def nearest(target):
        best, bd = None, 1e9
        for c in node_coords:
            d = (c[0] - target[0]) ** 2 + (c[1] - target[1]) ** 2
            if d < bd:
                bd, best = d, c
        return best

    midlon, midlat = (w + e) / 2, (s + n) / 2
    return [
        {"label": "West ↔ East", "a": nearest([w + 0.15 * (e - w), midlat]),
         "b": nearest([w + 0.85 * (e - w), midlat])},
        {"label": "South ↔ North", "a": nearest([midlon, s + 0.15 * (n - s)]),
         "b": nearest([midlon, s + 0.85 * (n - s)])},
    ]


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: build_graph.py <city-slug>")
    city = get_city(sys.argv[1])
    raw_dir = ROOT / "data" / "raw" / city["slug"]
    out = ROOT / "web" / "public" / "data" / city["slug"]
    out.mkdir(parents=True, exist_ok=True)

    print(f"[{city['slug']}] Building graph ({city['name']})")
    node_coords, edges = build_edges(raw_dir)

    keep = largest_component(len(node_coords), edges)
    print(f"  keeping {len(keep)}/{len(node_coords)} nodes in main component")
    remap = {}
    new_coords = []
    for old in sorted(keep):
        remap[old] = len(new_coords)
        new_coords.append(node_coords[old])
    kept_edges = [
        [remap[u], remap[v], dist, time_s, ccode, ow, geom]
        for u, v, dist, time_s, ccode, ow, geom in edges
        if u in remap and v in remap
    ]

    cam_fc = json.loads((raw_dir / "cameras.geojson").read_text())
    cameras = []
    for f in cam_fc["features"]:
        lon, lat = f["geometry"]["coordinates"]
        p = f["properties"]
        cameras.append({"lon": lon, "lat": lat, "kind": p["kind"], "flock": p["flock"], "operator": p.get("operator")})

    print("  assigning cameras to edges...")
    edge_cams = assign_cameras(kept_edges, cameras)
    watched = sum(1 for e in edge_cams if e)
    print(f"  {watched}/{len(kept_edges)} edges watched by >=1 camera")

    out_edges = []
    edge_geom = {}
    for i, (u, v, dist, time_s, ccode, ow, geom) in enumerate(kept_edges):
        out_edges.append([u, v, round(dist), round(time_s * 10), ccode, ow])
        if len(geom) > 2:
            edge_geom[i] = [[round(x, 6), round(y, 6)] for x, y in geom[1:-1]]
    out_edge_cams = {str(i): c for i, c in enumerate(edge_cams) if c}

    (out / "graph.json").write_text(json.dumps(
        {"nodes": new_coords, "edges": out_edges, "edgeGeom": edge_geom,
         "edgeCams": out_edge_cams, "classSpeedKmh": CLASS_SPEED_KMH, "seeRadiusM": SEE_RADIUS_M},
        separators=(",", ":"),
    ))
    (out / "cameras.json").write_text(json.dumps(
        {"seeRadiusM": SEE_RADIUS_M,
         "cameras": [[round(c["lon"], 6), round(c["lat"], 6), 1 if c["kind"] == "alpr" else 0,
                      1 if c["flock"] else 0, c["operator"] or ""] for c in cameras]},
        separators=(",", ":"),
    ))
    neigh = raw_dir / "neighborhoods.geojson"
    if neigh.exists():
        (out / "neighborhoods.geojson").write_text(neigh.read_text())

    presets = city["presets"] or auto_presets(new_coords, city["bbox"])
    counts = {
        "nodes": len(new_coords), "edges": len(out_edges), "cameras": len(cameras),
        "alpr": sum(1 for c in cameras if c["kind"] == "alpr"),
        "flock": sum(1 for c in cameras if c["flock"]),
        "watchedEdges": watched,
    }
    (out / "meta.json").write_text(json.dumps({
        "slug": city["slug"], "city": city["name"], "state": city["state"],
        "center": city["center"], "zoom": city["zoom"], "bbox": list(city["bbox"]),
        "presets": presets,
        "overtureRelease": "2026-07-22.0",
        "cameraSource": "DeFlock / OpenStreetMap (crowdsourced, incomplete lower bound)",
        "counts": counts,
    }, indent=2))

    print("  counts:", counts)
    for p in ("graph.json", "cameras.json", "meta.json"):
        print(f"  {p}: {(out / p).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
