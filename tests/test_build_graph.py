"""Unit tests for the graph-building geometry + topology helpers."""
import math

import build_graph as bg


class TestHaversine:
    def test_zero_for_identical(self):
        assert bg.haversine([-122.4, 37.77], [-122.4, 37.77]) == 0

    def test_one_degree_latitude_is_about_111km(self):
        d = bg.haversine([0, 0], [0, 1])
        assert 110_000 < d < 112_000

    def test_symmetric(self):
        a, b = [-122.42, 37.75], [-122.40, 37.80]
        assert bg.haversine(a, b) == bg.haversine(b, a)


class TestCumulativeLengths:
    def test_starts_at_zero_and_is_monotonic(self):
        coords = [[0, 0], [0, 0.001], [0, 0.002]]
        cum = bg.cumulative_lengths(coords)
        assert cum[0] == 0
        assert cum[1] < cum[2]
        assert len(cum) == len(coords)

    def test_total_matches_segment_sum(self):
        coords = [[0, 0], [0.001, 0], [0.001, 0.001]]
        cum = bg.cumulative_lengths(coords)
        manual = bg.haversine(coords[0], coords[1]) + bg.haversine(coords[1], coords[2])
        assert math.isclose(cum[-1], manual)


class TestPointAtFraction:
    coords = [[0, 0], [0.002, 0]]
    cum = bg.cumulative_lengths(coords)

    def test_fraction_zero_is_first_point(self):
        assert bg.point_at_fraction(self.coords, self.cum, 0.0) == [0, 0]

    def test_fraction_one_is_last_point(self):
        assert bg.point_at_fraction(self.coords, self.cum, 1.0) == [0.002, 0]

    def test_midpoint_on_straight_line(self):
        p = bg.point_at_fraction(self.coords, self.cum, 0.5)
        assert math.isclose(p[0], 0.001, abs_tol=1e-6)
        assert math.isclose(p[1], 0.0, abs_tol=1e-9)


class TestSlicePolyline:
    coords = [[0, 0], [0.001, 0], [0.002, 0], [0.003, 0]]
    cum = bg.cumulative_lengths(coords)

    def test_full_slice_returns_whole_line(self):
        out = bg.slice_polyline(self.coords, self.cum, 0.0, 1.0)
        assert out[0] == [0, 0]
        assert out[-1] == [0.003, 0]

    def test_partial_slice_keeps_interior_vertices(self):
        out = bg.slice_polyline(self.coords, self.cum, 0.25, 0.75)
        # endpoints are interpolated; interior vertex [0.002,0] should be present
        assert any(math.isclose(p[0], 0.002, abs_tol=1e-6) for p in out)

    def test_no_consecutive_duplicates(self):
        out = bg.slice_polyline(self.coords, self.cum, 0.0, 1.0)
        for i in range(1, len(out)):
            assert out[i] != out[i - 1]


class TestPointSegDistance:
    def test_point_on_segment_is_zero(self):
        d = bg.point_seg_dist_m([0.001, 0], [0, 0], [0.002, 0])
        assert d < 1  # within a meter

    def test_perpendicular_offset(self):
        # a point ~0.001 deg north of the midpoint of a west-east segment
        d = bg.point_seg_dist_m([0.001, 0.001], [0, 0], [0.002, 0])
        assert 100 < d < 120  # ~111 m per 0.001 deg lat

    def test_beyond_endpoint_clamps_to_end(self):
        d = bg.point_seg_dist_m([0.003, 0], [0, 0], [0.002, 0])
        near_end = bg.haversine([0.003, 0], [0.002, 0])
        assert math.isclose(d, near_end, rel_tol=0.02)


class TestLargestComponent:
    def test_picks_the_bigger_island(self):
        # nodes 0-1-2 connected (two-way); nodes 3-4 a separate smaller island
        edges = [
            [0, 1, 1, 1, 0, 0],
            [1, 2, 1, 1, 0, 0],
            [3, 4, 1, 1, 0, 0],
        ]
        keep = bg.largest_component(5, edges)
        assert keep == {0, 1, 2}

    def test_two_way_chain_kept_whole(self):
        edges = [[0, 1, 1, 1, 0, 0], [1, 2, 1, 1, 0, 0]]
        keep = bg.largest_component(3, edges)
        assert keep == {0, 1, 2}

    def test_drops_a_one_way_dead_end(self):
        # 0<->1<->2 form a 2-way core; a one-way edge 2->3 makes node 3 a sink
        # that cannot be left, so it is NOT strongly connected -> dropped.
        edges = [
            [0, 1, 1, 1, 0, 0],
            [1, 2, 1, 1, 0, 0],
            [2, 3, 1, 1, 0, 1],  # oneway forward: 2->3 only
        ]
        keep = bg.largest_component(4, edges)
        assert keep == {0, 1, 2}

    def test_directed_cycle_is_strongly_connected(self):
        # a one-way loop 0->1->2->0 is a single SCC — all reachable from all
        edges = [
            [0, 1, 1, 1, 0, 1],
            [1, 2, 1, 1, 0, 1],
            [2, 0, 1, 1, 0, 1],
        ]
        keep = bg.largest_component(3, edges)
        assert keep == {0, 1, 2}


class TestBearing:
    def test_cardinal_directions(self):
        assert bg.bearing([0, 0], [0, 1]) == 0        # north
        assert round(bg.bearing([0, 0], [1, 0])) == 90   # east
        assert bg.bearing([0, 0], [0, -1]) == 180     # south
        assert round(bg.bearing([0, 0], [-1, 0])) == 270  # west


class TestAngleDiff:
    def test_basic(self):
        assert bg.angle_diff(90, 90) == 0
        assert bg.angle_diff(0, 180) == 180

    def test_wraparound(self):
        assert bg.angle_diff(10, 350) == 20
        assert bg.angle_diff(350, 10) == 20


class TestPointSegNearest:
    def test_returns_point_on_segment(self):
        d, pt = bg.point_seg_nearest([0.0005, 0.0002], [0, 0], [0.001, 0])
        assert d < 30  # ~22 m north of the road
        assert abs(pt[0] - 0.0005) < 1e-4
        assert abs(pt[1]) < 1e-5  # nearest point is on the (y=0) road


class TestCameraSees:
    # a west->east road at y=0; camera ~22 m north of its middle
    ROAD_PT = [0.0005, 0.0]
    CAM = {"lon": 0.0005, "lat": 0.0002}

    def test_no_direction_always_sees(self):
        assert bg.camera_sees({**self.CAM, "direction": None}, self.ROAD_PT) is True

    def test_facing_toward_road_sees(self):
        # camera points south (180) toward the road -> sees it
        assert bg.camera_sees({**self.CAM, "direction": 180}, self.ROAD_PT) is True

    def test_facing_away_does_not_see(self):
        # camera points north (0), road is behind it -> does not see
        assert bg.camera_sees({**self.CAM, "direction": 0}, self.ROAD_PT) is False


class TestAssignCamerasDirectional:
    def _edge(self):
        # [u, v, dist, time10, class, oneway, geom] — a west->east road at y=0
        return [0, 1, 111, 80, 3, 0, [[0.0, 0.0], [0.001, 0.0]]]

    def test_camera_facing_road_is_assigned(self):
        cams = [{"lon": 0.0005, "lat": 0.0002, "direction": 180}]  # faces south, toward road
        assert bg.assign_cameras([self._edge()], cams) == [[0]]

    def test_camera_facing_away_is_not_assigned(self):
        cams = [{"lon": 0.0005, "lat": 0.0002, "direction": 0}]  # faces north, away
        assert bg.assign_cameras([self._edge()], cams) == [[]]

    def test_camera_without_direction_is_assigned(self):
        cams = [{"lon": 0.0005, "lat": 0.0002, "direction": None}]
        assert bg.assign_cameras([self._edge()], cams) == [[0]]

    def test_far_camera_ignored_regardless_of_facing(self):
        cams = [{"lon": 0.0005, "lat": 0.01, "direction": 180}]  # ~1.1 km away
        assert bg.assign_cameras([self._edge()], cams) == [[]]
