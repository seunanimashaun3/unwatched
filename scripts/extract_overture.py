"""
Extract a city's driving network + neighborhood boundaries from Overture Maps'
cloud GeoParquet (queried directly with DuckDB, no planet download).

Overture release: 2026-07-22.0  (s3://overturemaps-us-west-2)

Usage:  python scripts/extract_overture.py <city-slug>
Outputs (data/raw/<slug>/):
  segments.jsonl        one JSON object per drivable road segment
  neighborhoods.geojson city neighborhood polygons (context for exposure score)
"""
import json
import sys
from pathlib import Path

import duckdb

from cities import get_city

RELEASE = "s3://overturemaps-us-west-2/release/2026-07-22.0"
SEG = f"{RELEASE}/theme=transportation/type=segment/*"
DIV = f"{RELEASE}/theme=divisions/type=division_area/*"

DRIVABLE = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "unclassified", "living_street", "service",
)


def connect():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.execute("SET s3_region='us-west-2';")
    return con


def bbox_sql(bbox) -> str:
    w, s, e, n = bbox
    return f"bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n}"


def extract_segments(con, bbox, out_dir) -> None:
    classes = ", ".join(f"'{c}'" for c in DRIVABLE)
    print("  extracting drivable segments...")
    rows = con.execute(
        f"""
        SELECT id, class, names.primary AS name,
               to_json(connectors) AS connectors,
               to_json(access_restrictions) AS access,
               ST_AsGeoJSON(geometry) AS geom
        FROM read_parquet('{SEG}')
        WHERE {bbox_sql(bbox)} AND subtype = 'road' AND class IN ({classes})
        """
    ).fetchall()

    out = out_dir / "segments.jsonl"
    n = 0
    with out.open("w") as f:
        for seg_id, cls, name, connectors_json, access_json, geom_json in rows:
            geom = json.loads(geom_json)
            if geom.get("type") != "LineString":
                continue
            coords = [[round(x, 6), round(y, 6)] for x, y in geom["coordinates"]]
            if len(coords) < 2:
                continue
            connectors = [
                {"id": c["connector_id"], "at": c["at"]}
                for c in json.loads(connectors_json or "[]")
            ]
            f.write(
                json.dumps(
                    {
                        "id": seg_id, "class": cls, "name": name,
                        "oneway": parse_oneway(access_json),
                        "connectors": connectors, "coords": coords,
                    },
                    separators=(",", ":"),
                )
                + "\n"
            )
            n += 1
    print(f"  wrote {n} segments -> {out}")


def parse_oneway(access_json: str):
    """Best-effort oneway from Overture access_restrictions.

    Returns 'forward' | 'backward' | None. Many segments carry no restriction
    (null) -> two-way. Documented simplification: connectivity over strict
    legality.
    """
    if not access_json or access_json == "null":
        return None
    try:
        restrictions = json.loads(access_json)
    except (json.JSONDecodeError, TypeError):
        return None
    for r in restrictions or []:
        if r.get("access_type") != "denied":
            continue
        heading = (r.get("when") or {}).get("heading")
        if heading == "backward":
            return "forward"
        if heading == "forward":
            return "backward"
    return None


def extract_neighborhoods(con, bbox, out_dir) -> None:
    print("  extracting neighborhood boundaries...")
    try:
        rows = con.execute(
            f"""
            SELECT names.primary AS name, subtype,
                   ST_AsGeoJSON(ST_Simplify(geometry, 0.0002)) AS geom
            FROM read_parquet('{DIV}')
            WHERE {bbox_sql(bbox)}
              AND subtype IN ('neighborhood', 'locality', 'borough')
              AND names.primary IS NOT NULL
            """
        ).fetchall()
    except Exception as e:  # noqa: BLE001
        print(f"  divisions query failed ({e}); skipping neighborhoods")
        rows = []

    features = []
    for name, subtype, geom in rows:
        try:
            g = json.loads(geom)
        except (json.JSONDecodeError, TypeError):
            continue
        features.append({"type": "Feature", "properties": {"name": name, "subtype": subtype}, "geometry": g})
    out = out_dir / "neighborhoods.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"  wrote {len(features)} neighborhoods -> {out}")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: extract_overture.py <city-slug>")
    city = get_city(sys.argv[1])
    out_dir = Path(__file__).resolve().parent.parent / "data" / "raw" / city["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"[{city['slug']}] Overture extraction ({city['name']}, {city['state']})")
    con = connect()
    extract_segments(con, city["bbox"], out_dir)
    extract_neighborhoods(con, city["bbox"], out_dir)
    print("  done.")


if __name__ == "__main__":
    main()
