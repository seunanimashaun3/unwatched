"""Unit tests for add_city helpers (pure — no network)."""
import add_city as ac


class TestSlugify:
    def test_basic(self):
        assert ac.slugify("Austin", "TX") == "austin-tx"
        assert ac.slugify("New York", "NY") == "new-york-ny"

    def test_punctuation(self):
        assert ac.slugify("Mt. Juliet", "TN") == "mt-juliet-tn"
        assert ac.slugify("St. Louis", "MO") == "st-louis-mo"


class TestParseName:
    def test_city_state(self):
        assert ac.parse_name("Austin, TX") == ("Austin", "TX")
        assert ac.parse_name("New York, NY") == ("New York", "NY")

    def test_lowercases_uppercases_state(self):
        assert ac.parse_name("Portland, or") == ("Portland", "OR")

    def test_no_state(self):
        assert ac.parse_name("Springfield") == ("Springfield", "")


class TestBboxFromCenter:
    def test_box_surrounds_center(self):
        bbox = ac.bbox_from_center([-100.0, 40.0], 8)
        w, s, e, n = bbox
        assert w < -100.0 < e
        assert s < 40.0 < n
        # ~8 km -> ~0.072 deg of latitude each way
        assert abs((n - s) / 2 - 0.072) < 0.01

    def test_longitude_stretches_with_latitude(self):
        # a degree of longitude is shorter near the poles -> wider dlon
        near_eq = ac.bbox_from_center([0, 5], 8)
        near_pole = ac.bbox_from_center([0, 60], 8)
        assert (near_pole[2] - near_pole[0]) > (near_eq[2] - near_eq[0])


class TestAreaAndZoom:
    def test_area(self):
        assert abs(ac.area_deg2([-100, 40, -99, 41]) - 1.0) < 1e-9

    def test_zoom_shrinks_for_bigger_box(self):
        small = ac.zoom_for([-100, 40, -99.9, 40.1])
        big = ac.zoom_for([-100, 40, -99, 41])
        assert big < small
        assert 9.5 <= big <= 13 and 9.5 <= small <= 13
