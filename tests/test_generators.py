from math import hypot, pi

import pytest
from shapely.geometry import Point

from exporters.layout import arrange
from generators import REGISTRY, get


def build(bag_type: str, **overrides):
    gen = get(bag_type)
    params = {**gen.default_params(), **overrides}
    return gen.generate(gen.resolve(params))


def size(piece) -> tuple[float, float]:
    minx, miny, maxx, maxy = piece.cut.bounds
    return (round(maxx - minx, 6), round(maxy - miny, 6))


def test_all_types_registered_with_schemas():
    assert set(REGISTRY) == {
        "tote",
        "zip-pouch",
        "boxed-pouch",
        "tapered-tote",
        "drawstring",
        "birkin",
    }
    for spec in REGISTRY.values():
        schema = spec.schema()
        assert schema["label"] and schema["sections"]
        assert all(f["affects"] or True for s in schema["sections"] for f in s["fields"])


def test_unknown_type_is_rejected():
    with pytest.raises(ValueError):
        get("backpack")


def test_zip_pouch_panels():
    pattern = build("zip-pouch", width=200, height=150, seam_allowance=10)
    assert [p.id for p in pattern.pieces] == ["front", "back"]
    front = pattern.piece("Front")
    assert front.finished_size == (200, 150)
    assert size(front) == (220, 170)
    assert len(front.stitch) == 1


def test_boxed_pouch_cut_formula():
    depth, sa = 80.0, 10.0
    pattern = build(
        "boxed-pouch", width=200, height=120, depth=depth, seam_allowance=sa
    )
    front = pattern.piece("Front")
    raw_w = 200 + depth + 2 * sa
    raw_h = 120 + depth / 2 + sa
    assert size(front) == (raw_w, raw_h)
    assert front.finished_size == (200, 120)
    # the bottom corners are cut away, the middle is present
    assert not front.cut.contains(Point(1, raw_h - 1))
    assert not front.cut.contains(Point(raw_w - 1, raw_h - 1))
    assert front.cut.contains(Point(raw_w / 2, raw_h / 2))


def test_tapered_tote_gusset_length_matches_slanted_sides():
    top, bottom, height = 340.0, 260.0, 250.0
    pattern = build(
        "tapered-tote", top_width=top, bottom_width=bottom, height=height
    )
    assert [p.id for p in pattern.pieces] == [
        "front",
        "back",
        "gusset",
        "handle-1",
        "handle-2",
    ]
    side = hypot(height, (bottom - top) / 2)
    gusset = pattern.piece("Gusset")
    assert gusset.finished_size[0] == pytest.approx(2 * side + bottom)
    # panel finished width is the wider edge; the cut adds seam allowance
    assert pattern.piece("Front").finished_size == (max(top, bottom), height)
    assert size(pattern.piece("Front"))[0] > max(top, bottom)


def test_drawstring_casing_and_lines():
    pattern = build("drawstring", width=200, height=250, casing=25, seam_allowance=10)
    front = pattern.piece("Front")
    assert front.finished_size == (200, 250)
    assert size(front) == (220, 250 + 25 + 20)
    assert len(front.fold) == 1 and len(front.stitch) == 1
    assert len(front.notches) == 2


@pytest.mark.parametrize(
    "bag_type",
    ["tote", "zip-pouch", "boxed-pouch", "tapered-tote", "drawstring", "birkin"],
)
def test_pieces_are_valid_and_do_not_overlap(bag_type):
    pattern = build(bag_type)
    for piece in pattern.pieces:
        assert piece.cut.is_valid
        assert piece.cut.area > 0
    placements, content_w, content_h = arrange(pattern.pieces)
    boxes = [
        (tx + p.cut.bounds[0], ty + p.cut.bounds[1], tx + p.cut.bounds[2], ty + p.cut.bounds[3])
        for p, tx, ty in placements
    ]
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            overlap = a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
            assert not overlap
    assert content_w > 0 and content_h > 0


def test_bad_dimensions_raise():
    with pytest.raises(ValueError):
        build("drawstring", casing=300, height=250)
    with pytest.raises(ValueError):
        build("tapered-tote", handle_inset=500, top_width=340)
    with pytest.raises(ValueError):
        build("zip-pouch", zipper_margin=200, width=200)


def test_birkin_piece_set_and_box_dimensions():
    pattern = build("birkin", width=300, height=240, depth=140)
    assert [p.id for p in pattern.pieces] == [
        "front",
        "back",
        "base",
        "gusset-left",
        "gusset-right",
        "flap",
        "strap-1",
        "strap-2",
        "handle-1-wrap",
        "handle-1-core",
        "handle-2-wrap",
        "handle-2-core",
    ]
    assert size(pattern.piece("Front")) == (320, 260)
    assert pattern.piece("Base").finished_size == (300, 140)
    assert pattern.piece("Gusset left").finished_size == (140, 240)


def test_birkin_flap_length_and_rounded_corners():
    pattern = build("birkin", width=300, depth=140, flap_height=140, flap_radius=20)
    flap = pattern.piece("Flap")
    assert flap.finished_size == (300, 280)  # depth + flap_height
    # bottom corners rounded -> just inside a bottom corner is outside the cut
    minx, miny, maxx, maxy = flap.cut.bounds
    assert not flap.cut.contains(Point(minx + 1, maxy - 1))
    assert not flap.cut.contains(Point(maxx - 1, maxy - 1))
    # top corners stay square
    assert flap.cut.contains(Point(minx + 1, miny + 1))


def test_birkin_handle_wrap_width_is_tube_circumference():
    gen = get("birkin")
    params = {**gen.default_params(), "handle_diameter": 20, "seam_allowance": 10}
    pattern = gen.generate(gen.resolve(params))
    wrap = pattern.piece("Handle 1 wrap")
    assert wrap.finished_size[0] == 320
    assert wrap.finished_size[1] == pytest.approx(pi * 20)
    assert len(wrap.stitch) == 2


def test_rounded_rect_helper():
    from geometry.operations import rounded_rect

    r = rounded_rect(100, 50, 10, corners=("bl", "br"))
    assert r.is_valid and r.area > 0
    minx, miny, maxx, maxy = r.bounds
    assert (round(minx), round(miny), round(maxx), round(maxy)) == (0, 0, 100, 50)
    assert r.contains(Point(50, 25))
    with pytest.raises(ValueError):
        rounded_rect(100, 50, 10, corners=("nope",))
