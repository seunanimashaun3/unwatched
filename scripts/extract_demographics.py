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
from datetime import date
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
    "B17001_001E",  # poverty: pop for whom status determined
    "B17001_002E",  # poverty: below poverty level
    "B25077_001E",  # median home value
    "B01003_001E",  # total population (density = pop / tract land area)
]
VINTAGE = "US Census ACS 5-year 2020–2024"
# per-variable "learn more" links (data.census.gov table shells)
SOURCES = {
    "income": "https://data.census.gov/table/ACSDT5Y2024.B19013",
    "povertyRate": "https://data.census.gov/table/ACSDT5Y2024.B17001",
    "homeValue": "https://data.census.gov/table/ACSDT5Y2024.B25077",
    "density": "https://data.census.gov/table/ACSDT5Y2024.B01003",
}
SQM_PER_SQMI = 2589988.11


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
        "outFields": "GEOID,AREALAND",
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
        try:
            body = _get(url)
            rows = json.loads(body)
        except Exception as e:  # noqa: BLE001
            snippet = body[:200].decode("utf-8", "replace") if isinstance(locals().get("body"), bytes) else ""
            print(f"  ! ACS request failed for {st}/{co}: {e}", file=sys.stderr)
            print(f"    response: {snippet!r}", file=sys.stderr)
            print("    → skipping ACS layers. Is the Census key ACTIVATED "
                  "(click the link in the signup email)?", file=sys.stderr)
            return {}
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
            pov_tot = num(row[idx["B17001_001E"]])
            pov_below = num(row[idx["B17001_002E"]])
            home = num(row[idx["B25077_001E"]])
            pop = num(row[idx["B01003_001E"]])
            out[geoid] = {
                "income": int(income) if income is not None else None,
                "povertyRate": round(pov_below / pov_tot, 3) if pov_tot and pov_below is not None and pov_tot > 0 else None,
                "homeValue": int(home) if home is not None else None,
                "pop": pop,  # kept only to derive density with the tract's land area
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
        # density = population / land area (AREALAND, m² from TIGER; may be a str) in sq miles
        try:
            aland = float(t["properties"].get("AREALAND") or 0)
        except (TypeError, ValueError):
            aland = 0
        pop = a.get("pop")
        density = round(pop / (aland / SQM_PER_SQMI)) if pop is not None and aland > 0 else None
        feats.append({
            "type": "Feature",
            "geometry": round_coords(t["geometry"]),
            "properties": {
                "geoid": g,
                "income": a.get("income"),
                "povertyRate": a.get("povertyRate"),
                "homeValue": a.get("homeValue"),
                "density": density,
            },
        })
    (outdir / "demographics.json").write_text(json.dumps({
        "type": "FeatureCollection",
        "meta": {
            "vintage": VINTAGE,
            "retrieved": date.today().isoformat(),
            "tracts": "US Census TIGERweb (2020 tracts)",
            "sources": SOURCES,
            "acs": bool(acs),
        },
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
