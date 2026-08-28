"""
Refresh an existing city's data from the latest DeFlock/OpenStreetMap (+ Overture)
using its STORED bounding box — so cameras that were taken down (or newly added)
propagate to the map. Does not re-geocode or change the box/presets.

Usage:  python scripts/refresh_city.py <city-slug>
"""
import json
import subprocess
import sys
from pathlib import Path

import cities

ROOT = Path(__file__).resolve().parent.parent


def run(script: str, slug: str) -> None:
    subprocess.run([sys.executable, f"scripts/{script}", slug], check=True, cwd=ROOT)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: refresh_city.py <city-slug>")
    slug = sys.argv[1]
    if not cities.has_city(slug):
        raise SystemExit(f"Unknown city '{slug}'. Nothing to refresh.")

    entry = cities.get_city(slug)
    before = (entry.get("counts") or {}).get("alpr")
    print(f"[{slug}] refreshing from stored bbox {entry['bbox']}  (was {before} ALPR)…")

    # re-pull cameras (DeFlock/OSM) + roads (Overture), then rebuild the graph so
    # the camera→edge assignments (and counts) reflect the current data
    run("extract_cameras.py", slug)
    run("extract_overture.py", slug)
    run("build_graph.py", slug)

    meta = json.loads((ROOT / "web" / "public" / "data" / slug / "meta.json").read_text())
    counts = meta["counts"]
    # preserve name/state/bbox/center/zoom/presets exactly; only refresh counts
    updated = {k: entry[k] for k in ("name", "state", "bbox", "center", "zoom", "presets")}
    updated["counts"] = {k: counts[k] for k in ("alpr", "cameras", "flock")}
    cities.save_city(slug, updated)
    subprocess.run([sys.executable, "scripts/build_index.py"], check=True, cwd=ROOT)

    after = counts["alpr"]
    if before is None:
        print(f"[{slug}] now {after} ALPR")
    else:
        d = after - before
        print(f"[{slug}] {before} → {after} ALPR  ({'+' if d >= 0 else ''}{d})")


if __name__ == "__main__":
    main()
