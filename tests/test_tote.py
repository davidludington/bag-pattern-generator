import subprocess
import sys
from pathlib import Path

from exporters.layout import LABEL_H, arrange
from exporters.svg import export_svg
from generators.tote import generate
from model.bag import Bag

ROOT = Path(__file__).resolve().parent.parent


def example_bag(**overrides) -> Bag:
    base = dict(
        width=300,
        height=250,
        depth=100,
        seam_allowance=10,
        handle_length=600,
        handle_width=30,
        handle_inset=60,
    )
    base.update(overrides)
    return Bag(**base)


def size(piece) -> tuple[float, float]:
    minx, miny, maxx, maxy = piece.cut.bounds
    return (round(maxx - minx, 6), round(maxy - miny, 6))


# --- finished and cut dimensions of every piece ---------------------------

def test_front_and_back_dimensions():
    pattern = generate(example_bag())
    for name in ("Front", "Back"):
        piece = pattern.piece(name)
        assert piece.finished_size == (300, 250)
        assert size(piece) == (320, 270)  # finished + 2 * seam allowance
        assert len(piece.stitch) == 1
        assert piece.grain is not None


def test_gusset_dimensions():
    piece = generate(example_bag()).piece("Gusset")
    # continuous strip: left side + bottom + right side = 2*250 + 300
    assert piece.finished_size == (800, 100)
    assert size(piece) == (820, 120)


def test_handles():
    pattern = generate(example_bag())
    handle = pattern.piece("Handle 1")
    assert handle.finished_size == (600, 30)
    assert size(handle) == (620, 50)
    # handles use fold lines (fold at the stitch line), not stitch lines
    assert len(handle.fold) == 1
    assert handle.stitch == []
    assert pattern.piece("Handle 2").finished_size == (600, 30)


def test_piece_count():
    assert len(generate(example_bag()).pieces) == 5


# --- seam allowance and parameter propagation ------------------------------

def test_seam_allowance_changes_cut_not_finished():
    small = generate(example_bag(seam_allowance=5))
    big = generate(example_bag(seam_allowance=20))
    assert size(small.piece("Front")) == (310, 260)
    assert size(big.piece("Front")) == (340, 290)
    assert small.piece("Front").finished_size == big.piece("Front").finished_size
    assert size(small.piece("Gusset")) == (810, 110)
    assert size(small.piece("Handle 1")) == (610, 40)


def test_bag_width_change_propagates():
    narrow = generate(example_bag(width=200))
    wide = generate(example_bag(width=400))
    assert size(narrow.piece("Front")) == (220, 270)
    assert size(wide.piece("Front")) == (420, 270)
    # gusset length = 2*height + width, so it tracks width exactly
    assert size(narrow.piece("Gusset")) == (720, 120)
    assert size(wide.piece("Gusset")) == (920, 120)
    # gusset width follows bag depth, not bag width
    assert size(wide.piece("Gusset"))[1] == 120


def test_handle_placement_notches():
    front = generate(example_bag()).piece("Front")
    sa = 10
    top = sorted(
        (round(line.coords[0][0], 6), round(line.coords[0][1], 6))
        for line in front.notches
        if line.coords[0][1] < 0
    )
    assert top == [(60.0, -sa), (150.0, -sa), (240.0, -sa)]


def test_gusset_corner_notches_at_side_bottom_transitions():
    gusset = generate(example_bag()).piece("Gusset")
    starts = {(round(line.coords[0][0], 6), round(line.coords[0][1], 6)) for line in gusset.notches}
    # corners at height (250) and height+width (550), on both long edges; center at 400
    assert (250.0, -10.0) in starts
    assert (250.0, 110.0) in starts
    assert (550.0, -10.0) in starts
    assert (550.0, 110.0) in starts
    assert (400.0, 110.0) in starts


def test_config_validation():
    try:
        Bag(width=300, height=250, depth=100, handle_inset=200)
    except ValueError:
        pass
    else:
        raise AssertionError("handle_inset larger than the panel should be rejected")


# --- layout ----------------------------------------------------------------

def test_pieces_do_not_overlap_on_the_sheet():
    placements, content_w, content_h = arrange(generate(example_bag()).pieces)
    boxes = []
    for piece, tx, ty in placements:
        minx, miny, maxx, maxy = piece.cut.bounds
        # include the label strip reserved under each piece
        boxes.append((tx + minx, ty + miny, tx + maxx, ty + maxy + LABEL_H))
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            overlap = a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
            assert not overlap, f"pieces overlap: {a} vs {b}"
    assert content_w > 0 and content_h > 0


# --- SVG output ------------------------------------------------------------

def test_svg_contains_pieces_and_conventions(tmp_path):
    pattern = generate(example_bag())
    out = tmp_path / "tote.svg"
    export_svg(pattern, out)
    svg = out.read_text()

    for name in ("Front", "Back", "Gusset", "Handle 1", "Handle 2"):
        assert name in svg
    # millimeter page size + matching viewBox => prints at true scale
    assert 'width="' in svg and 'mm"' in svg and "viewBox=" in svg
    # scale reference
    assert "100 mm" in svg
    # line conventions: solid cut, dashed stitch, dotted fold
    assert "5 2.5" in svg  # stitch dash array
    assert "1 2" in svg  # fold dot array
    assert 'stroke="#000000" stroke-width="0.6"' in svg  # cut


def test_cli_generates_output(tmp_path):
    result = subprocess.run(
        [sys.executable, str(ROOT / "generate.py"), str(ROOT / "examples" / "tote.yaml")],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    out = tmp_path / "output" / "tote.svg"
    assert out.exists()
    assert "Front" in out.read_text()
