"""
Extract demographic context for a city — census-tract polygons with ACS
attributes, plus 1930s HOLC "redlining" grades — for the equity overlay.

Sources (all public domain / open):
- Tract geometry:  Census TIGERweb REST (keyless)
- ACS 5-year:      Census Data API (needs a free key: CENSUS_API_KEY env)
- HOLC redlining:  Mapping Inequality, Univ. of Richmond (keyless)

Usage:  python scripts/extract_demographics.py <city-slug>
Outputs (web/public/data/<slug>/):
  demographics.json  tract polygons + {income, pctNonwhite, povertyRate}
  redlining.json     HOLC areas + {grade, label} (only where 1930s data exists)

Honesty: this is CONTEXT, not a disparity claim. Coverage + traffic confounders
mean "cameras per tract" is not "who gets logged" — see the methodology panel.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from cities import get_city

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "unwatched/1.0 (privacy tool; demographics context)"}

TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Tracts_Blocks/MapServer/0/query"
)
ACS = "https://api.census.gov/data/2024/acs/acs5"  # latest 5-year (2020–2024)
HOLC = "https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json"

# ACS variables -> we derive income, % non-white, poverty rate per tract
ACS_VARS = [
    "B19013_001E",  # median household income
    "B03002_001E",  # race: total
    "B03002_003E",  # white alone, not hispanic
    "B17001_001E",  # poverty: pop for whom status determined
    "B17001_002E",  # poverty: below poverty level
]


def _get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def round_coords(geom):
    """Round all coordinates to ~1m to shrink the payload (in place)."""
    def r(x):
        if isinstance(x, (int, float)):
            return round(x, 5)
        return [r(v) for v in x]
    geom["coordinates"] = r(geom["coordinates"])
    return geom


def feature_bbox(geom):
    xs, ys = [], []
    def walk(x):
        if isinstance(x, (int, float)):
            return
        if x and isinstance(x[0], (int, float)):
            xs.append(x[0]); ys.append(x[1])
        else:
            for v in x:
                walk(v)
    walk(geom["coordinates"])
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def bbox_overlaps(a, b):
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def fetch_tracts(bbox):
    """Census-tract polygons intersecting the city bbox (keyless TIGERweb)."""
    w, s, e, n = bbox
    q = urllib.parse.urlencode({
        "where": "1=1",
        "geometry": f"{w},{s},{e},{n}",
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "GEOID",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    })
    data = json.loads(_get(f"{TIGERWEB}?{q}"))
    return data.get("features", [])


def fetch_acs(geoids):
    """Return {geoid: {income, pctNonwhite, povertyRate}} via the ACS API.
    Requires CENSUS_API_KEY; returns {} (with a warning) if unset."""
    key = os.environ.get("CENSUS_API_KEY", "").strip()
    if not key:
        print("  ! CENSUS_API_KEY not set — skipping ACS layers (redlining only).", file=sys.stderr)
        return {}
    # group tracts by (state, county) — one ACS call each
    counties = {}
    for g in geoids:
        counties.setdefault((g[:2], g[2:5]), True)
    out = {}
    for (st, co) in counties:
        url = (f"{ACS}?get={','.join(ACS_VARS)}&for=tract:*"
               f"&in=state:{st}&in=county:{co}&key={key}")
        rows = json.loads(_get(url))
        head = rows[0]
        idx = {name: i for i, name in enumerate(head)}
        for row in rows[1:]:
            geoid = row[idx["state"]] + row[idx["county"]] + row[idx["tract"]]
            def num(v):
                try:
                    f = float(v)
                    return f if f > -666666666 else None
                except (TypeError, ValueError):
                    return None
            income = num(row[idx["B19013_001E"]])
            tot = num(row[idx["B03002_001E"]])
            white = num(row[idx["B03002_003E"]])
            pov_tot = num(row[idx["B17001_001E"]])
            pov_below = num(row[idx["B17001_002E"]])
            out[geoid] = {
                "income": int(income) if income is not None else None,
                "pctNonwhite": round(1 - white / tot, 3) if tot and white is not None and tot > 0 else None,
                "povertyRate": round(pov_below / pov_tot, 3) if pov_tot and pov_below is not None and pov_tot > 0 else None,
            }
    return out


def fetch_redlining(bbox):
    """HOLC graded areas intersecting the bbox (keyless Mapping Inequality)."""
    national = json.loads(_get(HOLC))
    feats = []
    for f in national.get("features", []):
        grade = f["properties"].get("grade")
        if not grade or not f.get("geometry"):
            continue
        fb = feature_bbox(f["geometry"])
        if not fb or not bbox_overlaps(fb, bbox):
            continue
        feats.append({
            "type": "Feature",
            "geometry": round_coords(f["geometry"]),
            "properties": {
                "grade": grade,
                "category": f["properties"].get("category"),
                "label": f["properties"].get("label"),
            },
        })
    return feats


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: extract_demographics.py <city-slug>")
    city = get_city(sys.argv[1])
    slug = city["slug"]
    bbox = city["bbox"]
    outdir = ROOT / "web" / "public" / "data" / slug
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"[{slug}] tracts (TIGERweb)…")
    tracts = fetch_tracts(bbox)
    geoids = [t["properties"]["GEOID"] for t in tracts]
    print(f"  {len(tracts)} tracts")

    print(f"[{slug}] ACS 5-year…")
    acs = fetch_acs(geoids)

    feats = []
    for t in tracts:
        g = t["properties"]["GEOID"]
        a = acs.get(g, {})
        feats.append({
            "type": "Feature",
            "geometry": round_coords(t["geometry"]),
            "properties": {"geoid": g, **{k: a.get(k) for k in ("income", "pctNonwhite", "povertyRate")}},
        })
    (outdir / "demographics.json").write_text(json.dumps({
        "type": "FeatureCollection",
        "meta": {"source": "US Census ACS 5-year 2020–2024 + TIGERweb 2020 tracts", "acs": bool(acs)},
        "features": feats,
    }))
    print(f"  wrote demographics.json ({len(feats)} tracts, acs={bool(acs)})")

    print(f"[{slug}] HOLC redlining (Mapping Inequality)…")
    red = fetch_redlining(bbox)
    (outdir / "redlining.json").write_text(json.dumps({
        "type": "FeatureCollection",
        "meta": {"source": "Mapping Inequality, University of Richmond (1930s HOLC)"},
        "features": red,
    }))
    print(f"  wrote redlining.json ({len(red)} HOLC areas)")


if __name__ == "__main__":
    main()
