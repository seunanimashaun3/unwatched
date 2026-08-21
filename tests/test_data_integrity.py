"""
Contract tests for the generated browser assets (web/public/data/<city>/).

Validates every shipped city. Skipped automatically if the pipeline hasn't
been run yet.
"""
import json
from pathlib import Path

import pytest

DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
CITY_DIRS = sorted(p.parent for p in DATA.glob("*/graph.json")) if DATA.exists() else []

pytestmark = pytest.mark.skipif(not CITY_DIRS, reason="no generated city data; run scripts/run_all.sh")


def load(city_dir, name):
    return json.loads((city_dir / name).read_text())


def ids():
    return [p.name for p in CITY_DIRS]


@pytest.fixture(params=CITY_DIRS, ids=ids())
def city(request):
    d = request.param
    return {
        "slug": d.name,
        "graph": load(d, "graph.json"),
        "cameras": load(d, "cameras.json"),
        "meta": load(d, "meta.json"),
    }


def test_graph_has_nodes_and_edges(city):
    assert len(city["graph"]["nodes"]) > 1000
    assert len(city["graph"]["edges"]) > 1000


def test_all_nodes_within_city_bbox(city):
    # Overture returns segments whose bbox corner is in range but which can
    # extend past the boundary, so allow a generous margin — this only guards
    # against gross corruption (nodes on another continent), not exact bounds.
    w, s, e, n = city["meta"]["bbox"]
    for lon, lat in city["graph"]["nodes"]:
        assert w - 0.1 <= lon <= e + 0.1
        assert s - 0.1 <= lat <= n + 0.1


def test_every_edge_references_valid_nodes(city):
    n = len(city["graph"]["nodes"])
    for u, v, dist, t10, _ccode, ow in city["graph"]["edges"]:
        assert 0 <= u < n and 0 <= v < n
        assert dist >= 0 and t10 >= 0
        assert ow in (0, 1, 2)


def test_edge_camera_refs_point_to_real_cameras(city):
    num_edges = len(city["graph"]["edges"])
    num_cams = len(city["cameras"]["cameras"])
    for key, cam_ids in city["graph"]["edgeCams"].items():
        assert 0 <= int(key) < num_edges
        for ci in cam_ids:
            assert 0 <= ci < num_cams


def test_edge_geometry_refs_are_valid(city):
    num_edges = len(city["graph"]["edges"])
    for key in city["graph"]["edgeGeom"]:
        assert 0 <= int(key) < num_edges


def test_alpr_is_a_nonempty_subset_of_all_cameras(city):
    # every camera can be an ALPR (e.g. Virginia Beach has no generic CCTV
    # mapped), so ALPR count may equal — but never exceed — the total.
    alpr = [c for c in city["cameras"]["cameras"] if c[2] == 1]
    assert 0 < len(alpr) <= len(city["cameras"]["cameras"])


def test_meta_counts_match_actual_data(city):
    assert city["meta"]["counts"]["nodes"] == len(city["graph"]["nodes"])
    assert city["meta"]["counts"]["edges"] == len(city["graph"]["edges"])
    assert city["meta"]["counts"]["cameras"] == len(city["cameras"]["cameras"])
    assert city["meta"]["slug"] == city["slug"]


def test_presets_are_present(city):
    assert len(city["meta"]["presets"]) >= 2


def test_some_edges_are_watched(city):
    assert len(city["graph"]["edgeCams"]) > 50


def test_index_lists_every_built_city():
    index = json.loads((DATA / "cities.json").read_text())
    listed = {c["slug"] for c in index["cities"]}
    built = {d.name for d in CITY_DIRS}
    assert built <= listed
