"""
Extract surveillance / ALPR camera locations for a city.

Source: DeFlock crowdsourced data, published to OpenStreetMap and queried here
via the Overpass API. Overture deliberately strips `man_made=surveillance`, so
this is the camera layer Overture cannot give us.

Usage:  python scripts/extract_cameras.py <city-slug>
Output: data/raw/<slug>/cameras.geojson  (one Point feature per camera)

Notes / honesty:
- Crowdsourced => a KNOWN-INCOMPLETE lower bound. Real camera count is higher.
- We keep the OSM tags so the UI can distinguish ALPR (plate readers) from
  generic CCTV, show operator/brand, and use facing direction when present.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from cities import get_city

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def query(bbox) -> str:
    # bbox is (W, S, E, N); Overpass wants (S, W, N, E)
    w, s, e, n = bbox
    return (
        f'[out:json][timeout:90];'
        f'(node["man_made"="surveillance"]({s},{w},{n},{e}););'
        f'out body;'
    )


def fetch(q: str, rounds: int = 5) -> dict:
    """Query Overpass, cycling endpoints. If the whole set fails, back off and
    retry — Overpass has frequent short (seconds-to-minutes) outages, and a
    single miss shouldn't fail a city build."""
    data = ("data=" + urllib.parse.quote(q)).encode()
    last_err = None
    for attempt in range(rounds):
        for url in OVERPASS_ENDPOINTS:
            try:
                req = urllib.request.Request(
                    url, data=data, headers={"User-Agent": "unwatched/1.0 (privacy tool)"}
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    return json.load(resp)
            except Exception as e:  # noqa: BLE001
                last_err = e
                print(f"  endpoint {url} failed: {e}", file=sys.stderr)
        if attempt < rounds - 1:
            wait = min(60, 8 * (2 ** attempt))  # 8, 16, 32, 60s
            print(
                f"  all endpoints failed (round {attempt + 1}/{rounds}); backing off {wait}s…",
                file=sys.stderr,
            )
            time.sleep(wait)
    raise RuntimeError(f"all overpass endpoints failed after {rounds} rounds: {last_err}")


def classify(tags: dict) -> str:
    """Bucket a camera into: alpr | camera."""
    stype = (tags.get("surveillance:type") or "").lower()
    if "alpr" in stype or "anpr" in stype:
        return "alpr"
    man = (tags.get("manufacturer") or tags.get("brand") or "").lower()
    if "flock" in man:  # Flock only makes ALPRs
        return "alpr"
    return "camera"


def is_flock(tags: dict) -> bool:
    man = (tags.get("manufacturer") or tags.get("brand") or "").lower()
    return "flock" in man


def parse_direction(tags: dict):
    """Return facing bearing in degrees (0-360, N=0) or None."""
    d = tags.get("direction") or tags.get("camera:direction")
    if d is None:
        return None
    d = str(d).strip().upper()
    compass = {
        "N": 0, "NNE": 22, "NE": 45, "ENE": 67, "E": 90, "ESE": 112,
        "SE": 135, "SSE": 157, "S": 180, "SSW": 202, "SW": 225,
        "WSW": 247, "W": 270, "WNW": 292, "NW": 315, "NNW": 337,
    }
    if d in compass:
        return float(compass[d])
    try:
        return float(d) % 360
    except ValueError:
        return None


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: extract_cameras.py <city-slug>")
    city = get_city(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "data" / "raw" / city["slug"] / "cameras.geojson"

    print(f"[{city['slug']}] Querying Overpass for surveillance cameras (DeFlock/OSM)...")
    raw = fetch(query(city["bbox"]))
    els = raw.get("elements", [])
    print(f"  {len(els)} raw surveillance nodes")

    features = []
    counts = {"alpr": 0, "camera": 0, "flock": 0}
    for e in els:
        if e.get("type") != "node":
            continue
        tags = e.get("tags", {})
        kind = classify(tags)
        flock = is_flock(tags)
        counts[kind] += 1
        if flock:
            counts["flock"] += 1
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(e["lon"], 6), round(e["lat"], 6)]},
                "properties": {
                    "id": e["id"],
                    "kind": kind,
                    "flock": flock,
                    "operator": tags.get("operator") or tags.get("manufacturer") or tags.get("brand"),
                    "direction": parse_direction(tags),
                    "zone": tags.get("surveillance:zone"),
                },
            }
        )

    fc = {
        "type": "FeatureCollection",
        "meta": {
            "source": "DeFlock / OpenStreetMap via Overpass API",
            "bbox": city["bbox"],
            "note": "Crowdsourced; a known-incomplete lower bound of real cameras.",
            "counts": counts,
            "total": len(features),
        },
        "features": features,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fc))
    print(f"  wrote {len(features)} cameras -> {out}")
    print(f"  ALPR={counts['alpr']}  camera={counts['camera']}  flock-branded={counts['flock']}")


if __name__ == "__main__":
    main()
