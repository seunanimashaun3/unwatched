"""Unit tests for Overture one-way parsing."""
import json

import extract_overture as eo


def restr(access_type, heading):
    return json.dumps([{"access_type": access_type, "when": {"heading": heading}}])


class TestParseOneway:
    def test_null_is_two_way(self):
        assert eo.parse_oneway(None) is None
        assert eo.parse_oneway("null") is None

    def test_denied_backward_means_forward_only(self):
        assert eo.parse_oneway(restr("denied", "backward")) == "forward"

    def test_denied_forward_means_backward_only(self):
        assert eo.parse_oneway(restr("denied", "forward")) == "backward"

    def test_allowed_restriction_is_two_way(self):
        assert eo.parse_oneway(restr("allowed", "forward")) is None

    def test_malformed_json_is_two_way(self):
        assert eo.parse_oneway("{not json") is None

    def test_empty_list_is_two_way(self):
        assert eo.parse_oneway("[]") is None
