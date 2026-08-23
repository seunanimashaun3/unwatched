"""
Rebuild web/public/data/cities.json — the index the home page reads to list
supported cities — from the registry (scripts/cities.json).

Reading the registry (not scanning web/public/data/*/meta.json) is deliberate:
in CI only the city being added is present on disk, so scanning would silently
drop every other city from the index. The registry holds every city and its
counts, so the full index rebuilds correctly from it alone.

Usage:  python scripts/build_index.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "scripts" / "cities.json"
OUT = ROOT / "web" / "public" / "data" / "cities.json"


def main() -> None:
    registry = json.loads(REGISTRY.read_text())
    cities = []
    skipped = []
    for slug, m in registry.items():
        counts = m.get("counts")
        if not counts:
            # in the registry but not built yet (or a failed build) — no data on
            # R2 to point at, so leave it out of the index.
            skipped.append(slug)
            continue
        cities.append({
            "slug": slug,
            "city": m["name"],
            "state": m["state"],
            "center": m["center"],
            "zoom": m["zoom"],
            "counts": {
                "alpr": counts["alpr"],
                "cameras": counts["cameras"],
                "flock": counts["flock"],
            },
        })
    # busiest surveillance first — most compelling at the top of the list
    cities.sort(key=lambda c: c["counts"]["alpr"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"cities": cities}, indent=2))
    print(f"wrote index with {len(cities)} cities -> {OUT}")
    for c in cities:
        print(f"  {c['slug']:20} {c['counts']['alpr']:5} ALPR")
    if skipped:
        print(f"skipped (no counts / not built): {', '.join(skipped)}")


if __name__ == "__main__":
    main()
