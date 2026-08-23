"""
Add (or preview) a city end-to-end.

  python scripts/add_city.py --name "Austin, TX" [--bbox W,S,E,N] [--radius-km 8]
                             [--zoom Z] [--slug austin-tx] [--dry-run] [--force]

Steps:
  1. Geocode the city (Nominatim) for a center if no --bbox given, then draw a
     bbox of ~radius-km around it.
  2. Guardrails: enough mapped ALPRs? bbox not too large? (skip clearly-bad
     cities so one-click adds can't create junk).
  3. Add to the registry, run the pipeline (cameras + roads + graph + index),
     verify the graph isn't too heavy. Roll everything back on any failure.

  --dry-run  report geocode + coverage + proposed config; change nothing.
  --force    bypass the guardrails (for sprawling metros you've vetted).
"""
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import cities

ROOT = Path(__file__).resolve().parent.parent

# guardrails
MIN_ALPR = 40             # a city with fewer mapped plate readers is a dead demo
MAX_AREA_DEG2 = 0.16      # wider than this tends to blow up the graph
MAX_GRAPH_MB = 5.0        # gzipped graph.json cap (Vegas full-metro was 6.8)
DEFAULT_RADIUS_KM = 8.0

UA = {"User-Agent": "unwatched-add-city/1.0"}
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def slugify(name: str, state: str) -> str:
    base = f"{name} {state}".lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base


def parse_name(arg: str):
    if "," in arg:
        name, state = arg.rsplit(",", 1)
        return name.strip(), state.strip().upper()
    return arg.strip(), ""


def geocode(query: str):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1}
    )
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        results = json.load(r)
    if not results:
        raise SystemExit(f"Couldn't geocode '{query}'. Try passing --bbox.")
    return [float(results[0]["lon"]), float(results[0]["lat"])]


def bbox_from_center(center, radius_km):
    lon, lat = center
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))
    return [round(lon - dlon, 4), round(lat - dlat, 4), round(lon + dlon, 4), round(lat + dlat, 4)]


def area_deg2(bbox):
    w, s, e, n = bbox
    return (e - w) * (n - s)


def zoom_for(bbox):
    w, s, e, n = bbox
    span = max(e - w, n - s)
    return round(max(9.5, min(13.0, math.log2(360 / span) - 0.5)), 1)


def _overpass(query):
    """POST an Overpass query, trying each endpoint with a couple retries."""
    data = ("data=" + urllib.parse.quote(query)).encode()
    last = None
    for _ in range(2):
        for url in OVERPASS_ENDPOINTS:
            try:
                req = urllib.request.Request(url, data=data, headers=UA)
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.load(r).get("elements", [])
            except Exception as ex:  # noqa: BLE001
                last = ex
                print(f"  overpass {url} failed ({ex}); trying next…", file=sys.stderr)
                time.sleep(2)
    raise SystemExit(f"Overpass is unavailable right now ({last}). Try again in a minute.")


def alpr_count(bbox):
    w, s, e, n = bbox
    q = (
        f'[out:json][timeout:90];'
        f'(node["man_made"="surveillance"]({s},{w},{n},{e}););out tags;'
    )
    els = _overpass(q)
    n_alpr = 0
    for el in els:
        t = el.get("tags", {})
        st = (t.get("surveillance:type") or "").lower()
        man = (t.get("manufacturer") or t.get("brand") or "").lower()
        if "alpr" in st or "anpr" in st or "flock" in man:
            n_alpr += 1
    return n_alpr


def graph_gz_mb(slug):
    import gzip
    p = ROOT / "web" / "public" / "data" / slug / "graph.json"
    return len(gzip.compress(p.read_bytes())) / 1_048_576


def run(script, slug):
    subprocess.run([sys.executable, f"scripts/{script}", slug], check=True, cwd=ROOT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help='e.g. "Austin, TX"')
    ap.add_argument("--bbox", help="W,S,E,N (overrides geocoded box)")
    ap.add_argument("--radius-km", type=float, default=DEFAULT_RADIUS_KM)
    ap.add_argument("--zoom", type=float)
    ap.add_argument("--slug")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    name, state = parse_name(args.name)
    slug = args.slug or slugify(name, state)
    if cities.has_city(slug) and not args.force:
        raise SystemExit(f"'{slug}' already exists. Use --force to rebuild.")

    if args.bbox:
        bbox = [round(float(x), 4) for x in args.bbox.split(",")]
        if len(bbox) != 4:
            raise SystemExit("--bbox must be W,S,E,N")
        center = [round((bbox[0] + bbox[2]) / 2, 4), round((bbox[1] + bbox[3]) / 2, 4)]
    else:
        center = geocode(f"{name}, {state}" if state else name)
        bbox = bbox_from_center(center, args.radius_km)

    area = area_deg2(bbox)
    zoom = args.zoom or zoom_for(bbox)
    print(f"City:   {name}, {state}  ({slug})")
    print(f"Center: {center}")
    print(f"Bbox:   {bbox}   (~{area:.3f} deg^2)")
    print("Checking camera coverage (Overpass)…")
    alpr = alpr_count(bbox)
    print(f"ALPRs:  {alpr}")

    # guardrails
    problems = []
    if alpr < MIN_ALPR:
        problems.append(f"only {alpr} mapped ALPRs (need ≥ {MIN_ALPR})")
    if area > MAX_AREA_DEG2:
        problems.append(f"bbox is large ({area:.3f} deg^2 > {MAX_AREA_DEG2}); tighten it or lower --radius-km")
    if problems and not args.force:
        raise SystemExit("Skipping — " + "; ".join(problems) + ".  (Pass --force to override.)")

    entry = {"name": name, "state": state, "bbox": bbox, "center": center, "zoom": zoom, "presets": []}
    print("\nProposed entry:\n" + json.dumps({slug: entry}, indent=2))

    if args.dry_run:
        print("\n[dry-run] Nothing written.")
        return

    cities.save_city(slug, entry)
    try:
        print(f"\nBuilding {slug}…")
        run("extract_cameras.py", slug)
        run("extract_overture.py", slug)
        run("build_graph.py", slug)
        gz = graph_gz_mb(slug)
        if gz > MAX_GRAPH_MB and not args.force:
            raise SystemExit(f"graph is {gz:.1f} MB gz (> {MAX_GRAPH_MB}); tighten the bbox.")
        # persist the built counts into the registry so the index can be rebuilt
        # from the registry alone (CI never has the other cities' data on disk).
        meta = json.loads((ROOT / "web" / "public" / "data" / slug / "meta.json").read_text())
        entry["counts"] = meta["counts"]
        cities.save_city(slug, entry)
        subprocess.run([sys.executable, "scripts/build_index.py"], check=True, cwd=ROOT)
    except BaseException as e:
        print(f"\nFailed ({e}); rolling back {slug}.", file=sys.stderr)
        cities.remove_city(slug)
        shutil.rmtree(ROOT / "data" / "raw" / slug, ignore_errors=True)
        shutil.rmtree(ROOT / "web" / "public" / "data" / slug, ignore_errors=True)
        subprocess.run([sys.executable, "scripts/build_index.py"], cwd=ROOT)
        raise SystemExit(1)

    print(f"\n✅ Added {slug}: {alpr} ALPRs, graph {graph_gz_mb(slug):.1f} MB gz.")


if __name__ == "__main__":
    main()
