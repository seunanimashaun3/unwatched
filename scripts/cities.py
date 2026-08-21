"""
Registry of supported cities. Adding a city is just a new entry here + a
pipeline run (extract_cameras, extract_overture, build_graph, build_index).

bbox is (W, S, E, N) in lon/lat. Keep each ~0.13-0.19° so the shipped graph
stays around 1-2 MB gzipped. center/zoom drive the initial map view. presets
are optional hand-picked example trips; cities without them get directional
sample routes auto-generated from the graph at build time.
"""

CITIES = {
    "san-francisco-ca": {
        "name": "San Francisco",
        "state": "CA",
        "bbox": (-122.52, 37.70, -122.35, 37.83),
        "center": [-122.4194, 37.7649],
        "zoom": 12.4,
        "presets": [
            {"label": "Mission → Marina", "a": [-122.4194, 37.7599], "b": [-122.4368, 37.803]},
            {"label": "Downtown → Sunset", "a": [-122.4058, 37.7887], "b": [-122.4944, 37.7558]},
            {"label": "Castro → Bayview", "a": [-122.435, 37.7609], "b": [-122.39, 37.735]},
        ],
    },
    # NOTE: Los Angeles is omitted — its ALPRs are spread across the metro,
    # not downtown, so a single small-bbox graph gives poor coverage for a
    # large file. It would need a wider (and much heavier) extract.
    "new-york-ny": {
        "name": "New York",
        "state": "NY",
        "bbox": (-74.02, 40.70, -73.90, 40.82),
        "center": [-73.98, 40.758],
        "zoom": 12.0,
        "presets": [],
    },
    "atlanta-ga": {
        "name": "Atlanta",
        "state": "GA",
        "bbox": (-84.46, 33.70, -84.32, 33.82),
        "center": [-84.388, 33.749],
        "zoom": 11.8,
        "presets": [],
    },
    "chicago-il": {
        "name": "Chicago",
        "state": "IL",
        "bbox": (-87.72, 41.82, -87.58, 41.96),
        "center": [-87.63, 41.885],
        "zoom": 11.6,
        "presets": [],
    },
    "san-jose-ca": {
        "name": "San Jose",
        "state": "CA",
        "bbox": (-122.02, 37.25, -121.80, 37.44),
        "center": [-121.886, 37.338],
        "zoom": 11.4,
        "presets": [],
    },
    "norfolk-va": {
        "name": "Norfolk",
        "state": "VA",
        "bbox": (-76.35, 36.82, -76.17, 36.95),
        "center": [-76.285, 36.885],
        "zoom": 12.0,
        "presets": [],
    },
    "virginia-beach-va": {
        "name": "Virginia Beach",
        "state": "VA",
        "bbox": (-76.10, 36.70, -75.90, 36.90),
        "center": [-76.05, 36.84],
        "zoom": 11.3,
        "presets": [],
    },
    "las-vegas-nv": {
        # Strip + downtown + Paradise. The full metro's grid produced a ~6.8 MB
        # graph — too heavy to ship — so this trades sprawl for a sane size.
        "name": "Las Vegas",
        "state": "NV",
        "bbox": (-115.28, 36.06, -115.05, 36.23),
        "center": [-115.16, 36.145],
        "zoom": 11.2,
        "presets": [],
    },
}


def get_city(slug: str) -> dict:
    if slug not in CITIES:
        raise SystemExit(
            f"Unknown city '{slug}'. Known: {', '.join(CITIES)}"
        )
    return {"slug": slug, **CITIES[slug]}


def all_slugs() -> list[str]:
    return list(CITIES)
