"""
City registry — backed by cities.json (a data file, so tooling/workflows can
append to it; a Python dict couldn't be edited cleanly). This module is the one
place the pipeline reads city config from.

Each entry: {name, state, bbox:[W,S,E,N], center:[lon,lat], zoom, presets}.

The JSON registry is intentionally the same shape a future `cities` DB table
would have (one row per city), so this swaps to a database with minimal change:
only `_load`/`save_city`/`remove_city` need to point at the DB instead of the
file — callers (get_city / all_slugs) stay the same.
"""
import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parent / "cities.json"


def _load() -> dict:
    return json.loads(REGISTRY.read_text())


def _write(cities: dict) -> None:
    REGISTRY.write_text(json.dumps(cities, indent=2) + "\n")


def get_city(slug: str) -> dict:
    cities = _load()
    if slug not in cities:
        raise SystemExit(f"Unknown city '{slug}'. Known: {', '.join(cities)}")
    return {"slug": slug, **cities[slug]}


def all_slugs() -> list[str]:
    return list(_load().keys())


def has_city(slug: str) -> bool:
    return slug in _load()


def save_city(slug: str, entry: dict) -> None:
    """Add or update a city in the registry."""
    cities = _load()
    cities[slug] = {k: entry[k] for k in ("name", "state", "bbox", "center", "zoom", "presets")}
    _write(cities)


def remove_city(slug: str) -> None:
    cities = _load()
    cities.pop(slug, None)
    _write(cities)
