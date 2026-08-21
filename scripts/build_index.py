"""
Aggregate every built city's meta.json into web/public/data/cities.json — the
index the home page reads to list supported cities.

Usage:  python scripts/build_index.py
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def main() -> None:
    cities = []
    for meta_path in sorted(DATA.glob("*/meta.json")):
        m = json.loads(meta_path.read_text())
        cities.append({
            "slug": m["slug"],
            "city": m["city"],
            "state": m["state"],
            "center": m["center"],
            "zoom": m["zoom"],
            "counts": {
                "alpr": m["counts"]["alpr"],
                "cameras": m["counts"]["cameras"],
                "flock": m["counts"]["flock"],
            },
        })
    # busiest surveillance first — most compelling at the top of the list
    cities.sort(key=lambda c: c["counts"]["alpr"], reverse=True)
    (DATA / "cities.json").write_text(json.dumps({"cities": cities}, indent=2))
    print(f"wrote index with {len(cities)} cities -> {DATA / 'cities.json'}")
    for c in cities:
        print(f"  {c['slug']:20} {c['counts']['alpr']:5} ALPR")


if __name__ == "__main__":
    main()
