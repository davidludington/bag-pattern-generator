"""Tote generator: Bag -> Pattern.

Construction (finished dimensions):
  - Front/back: width x height rectangles.
  - Gusset: one continuous strip of width = depth, length = 2*height + width.
    It forms left side + bottom + right side. Its two long edges sew to the
    front's and back's left + bottom + right edges.
  - Handles: two straight strips, finished length x finished width, attached
    at both ends to the top edge of a panel (front gets one, back gets one).
  - Every piece: cut outline = finished shape + seam allowance on every edge.
"""

from __future__ import annotations

from shapely.geometry import LineString

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch, rect, seam_outline, stitch_line
from model.bag import Bag
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0  # match-mark tick length, mm


def generate(bag: Bag) -> Pattern:
    pieces = [
        _panel("front", "Front", bag),
        _panel("back", "Back", bag),
        _gusset(bag),
        _handle("handle-1", "Handle 1", bag),
        _handle("handle-2", "Handle 2", bag),
    ]
    return Pattern(name=bag.name, pieces=pieces)


def _panel(piece_id: str, name: str, bag: Bag) -> PatternPiece:
    sa = bag.seam_allowance
    w, h = bag.width, bag.height
    finished = rect(w, h)
    cut = seam_outline(finished, sa)

    notches = [
        # bottom edge: joins the gusset (corners where side meets bottom, plus center)
        notch((0, h + sa), (0, 1), NOTCH),
        notch((w / 2, h + sa), (0, 1), NOTCH),
        notch((w, h + sa), (0, 1), NOTCH),
        # top edge: center, and where the two handle ends attach
        notch((w / 2, -sa), (0, -1), NOTCH),
        notch((bag.handle_inset, -sa), (0, -1), NOTCH),
        notch((w - bag.handle_inset, -sa), (0, -1), NOTCH),
    ]
    grain = LineString([(w / 2, sa + 15), (w / 2, h + sa - 15)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, h),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=grain,
        notes=f"handles attach between the top notches (inset {bag.handle_inset:g} mm)",
    )


def _gusset(bag: Bag) -> PatternPiece:
    sa = bag.seam_allowance
    length = 2 * bag.height + bag.width
    # x runs: left side (0..height) -> bottom (height..height+width) -> right side
    finished = rect(length, bag.depth)
    cut = seam_outline(finished, sa)

    corner_a = bag.height
    corner_b = bag.height + bag.width
    notches = [
        # corners: where the bag's side seams meet the bottom, marked on both long edges
        notch((corner_a, bag.depth + sa), (0, 1), NOTCH),
        notch((corner_a, -sa), (0, -1), NOTCH),
        notch((corner_b, bag.depth + sa), (0, 1), NOTCH),
        notch((corner_b, -sa), (0, -1), NOTCH),
        # center of the bottom run, on the front-facing edge
        notch((corner_a + bag.width / 2, bag.depth + sa), (0, 1), NOTCH),
    ]
    grain = LineString([(sa + 15, bag.depth / 2), (length + sa - 15, bag.depth / 2)])
    return PatternPiece(
        id="gusset",
        name="Gusset",
        cut=cut,
        finished_size=(length, bag.depth),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=grain,
        notes=(
            f"runs up the left side ({bag.height:g}), across the bottom ({bag.width:g}), "
            f"up the right side ({bag.height:g}); depth {bag.depth:g}"
        ),
    )


def _handle(piece_id: str, name: str, bag: Bag) -> PatternPiece:
    sa = bag.seam_allowance
    w, h = bag.handle_length, bag.handle_width
    finished = rect(w, h)
    cut = seam_outline(finished, sa)
    grain = LineString([(sa + 15, h / 2), (w + sa - 15, h / 2)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, h),
        fold=[stitch_line(finished)],
        grain=grain,
        notes="fold all four edges under at the lines; raw edges meet at the back",
    )


SPEC = GeneratorSpec(
    type="tote",
    label="Rectangular gusseted tote",
    sections=(
        Section(
            "Bag",
            (
                Field("width", "Width", 300, affects=("front", "back", "gusset")),
                Field("height", "Height", 250, affects=("front", "back", "gusset")),
                Field("depth", "Depth", 100, affects=("gusset",)),
            ),
        ),
        Section(
            "Handles",
            (
                Field("handle_length", "Length", 600, affects=("handle-1", "handle-2")),
                Field("handle_width", "Width", 30, affects=("handle-1", "handle-2")),
                Field(
                    "handle_inset",
                    "Placement (inset)",
                    60,
                    min=0,
                    affects=("handle-1", "handle-2"),
                ),
            ),
        ),
    ),
    generate=lambda params: generate(Bag.from_params(params)),
)
