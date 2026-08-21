"""Unit tests for camera classification + tag parsing."""
import extract_cameras as ec


class TestClassify:
    def test_alpr_by_surveillance_type(self):
        assert ec.classify({"surveillance:type": "ALPR"}) == "alpr"

    def test_anpr_variant_is_alpr(self):
        assert ec.classify({"surveillance:type": "ANPR"}) == "alpr"

    def test_flock_manufacturer_is_alpr(self):
        # Flock only makes plate readers, even if surveillance:type is missing
        assert ec.classify({"manufacturer": "Flock Safety"}) == "alpr"

    def test_generic_camera(self):
        assert ec.classify({"surveillance:type": "camera"}) == "camera"

    def test_untagged_defaults_to_camera(self):
        assert ec.classify({}) == "camera"


class TestIsFlock:
    def test_true_for_flock_manufacturer(self):
        assert ec.is_flock({"manufacturer": "Flock Safety"}) is True

    def test_true_for_flock_brand_any_case(self):
        assert ec.is_flock({"brand": "flock"}) is True

    def test_false_for_other_brands(self):
        assert ec.is_flock({"manufacturer": "Motorola Solutions"}) is False
        assert ec.is_flock({}) is False


class TestParseDirection:
    def test_compass_points(self):
        assert ec.parse_direction({"direction": "N"}) == 0
        assert ec.parse_direction({"direction": "E"}) == 90
        assert ec.parse_direction({"direction": "S"}) == 180
        assert ec.parse_direction({"direction": "W"}) == 270

    def test_numeric_degrees(self):
        assert ec.parse_direction({"direction": "45"}) == 45.0

    def test_numeric_wraps_at_360(self):
        assert ec.parse_direction({"direction": "450"}) == 90.0

    def test_camera_direction_key(self):
        assert ec.parse_direction({"camera:direction": "90"}) == 90.0

    def test_missing_or_invalid_returns_none(self):
        assert ec.parse_direction({}) is None
        assert ec.parse_direction({"direction": "sideways"}) is None
