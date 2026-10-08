from geometry.operations import arrow_tip, move, notch, rect, seam_outline, stitch_line


def test_rect_dims():
    r = rect(30, 20)
    assert r.bounds == (0.0, 0.0, 30.0, 20.0)
    assert r.area == 600.0


def test_seam_outline_outsets_by_seam_allowance():
    r = rect(30, 20)
    cut = seam_outline(r, 10)
    assert cut.bounds == (-10.0, -10.0, 40.0, 30.0)
    assert cut.area == 50.0 * 40.0


def test_stitch_line_follows_finished_boundary():
    r = rect(30, 20)
    line = stitch_line(r)
    assert line.is_ring
    assert line.bounds == r.bounds


def test_move_translates():
    moved = move(rect(30, 20), 5, -3)
    assert moved.bounds == (5.0, -3.0, 35.0, 17.0)


def test_notch_points_outward_with_expected_length():
    n = notch((0, 100), (0, 1), length=4)
    assert list(n.coords) == [(0.0, 100.0), (0.0, 104.0)]


def test_notch_normalizes_direction():
    n = notch((50, 0), (0, -7), length=4)
    assert list(n.coords) == [(50.0, 0.0), (50.0, -4.0)]


def test_arrow_tip_points_along_tail_to_tip():
    tip = arrow_tip((0, 0), (10, 0), size=4)
    assert tip[0] == (10, 0)
    # base of the triangle sits 4mm back from the tip
    assert abs(tip[1][0] - 6.0) < 1e-9
    assert abs(tip[2][0] - 6.0) < 1e-9
