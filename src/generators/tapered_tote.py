"""Tapered tote generator: trapezoid front/back with a continuous gusset.

Construction (finished dimensions):
  - Front/back: horizontal trapezoids, bottom edge ``bottom_width`` and top
    edge ``top_width``, both centred.
  - Gusset: one continuous strip (left side + bottom + right side). The side
    runs follow the slanted panel edges, so their length is the trapezoid side
    ``sqrt(height^2 + ((bottom_width - top_width)/2)^2)``.
  - Handles: two straight strips on the top edges, like the plain tote.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import hypot

from shapely.geometry import LineString, Polygon

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch, rect, seam_outline, stitch_line
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0


@dataclass(frozen=True)
class TaperedTote:
    top_width: float
    bottom_width: float
    height: float
    depth: float
    handle_length: float = 600.0
    handle_width: float = 30.0
    handle_inset: float = 60.0
    seam_allowance: float = 10.0
    name: str = "tapered-tote"

    def __post_init__(self) -> None:
        for field in ("top_width", "bottom_width", "height", "depth",
                      "handle_length", "handle_width"):
            if getattr(self, field) <= 0:
                raise ValueError(f"{field} must be positive")
        if self.seam_allowance < 0:
            raise ValueError("seam_allowance must be >= 0")
        if self.handle_inset < 0:
            raise ValueError("handle_inset must be >= 0")
        if 2 * self.handle_inset >= self.top_width:
            raise ValueError("handle_inset too large for the top width")

    @property
    def side(self) -> float:
        return hypot(self.height, (self.bottom_width - self.top_width) / 2)


def generate(p: TaperedTote) -> Pattern:
    return Pattern(
        name=p.name,
        pieces=[
            _panel("front", "Front", p),
            _panel("back", "Back", p),
            _gusset(p),
            _handle("handle-1", "Handle 1", p),
            _handle("handle-2", "Handle 2", p),
        ],
    )


def _trapezoid(top_w: float, bottom_w: float, height: float) -> Polygon:
    c = max(top_w, bottom_w) / 2
    return Polygon(
        [
            (c - top_w / 2, 0),
            (c + top_w / 2, 0),
            (c + bottom_w / 2, height),
            (c - bottom_w / 2, height),
        ]
    )


def _panel(piece_id: str, name: str, p: TaperedTote) -> PatternPiece:
    sa = p.seam_allowance
    c = max(p.top_width, p.bottom_width) / 2
    finished = _trapezoid(p.top_width, p.bottom_width, p.height)
    cut = seam_outline(finished, sa)

    notches = [
        # bottom edge joins the gusset (both corners + centre)
        notch((c - p.bottom_width / 2, p.height + sa), (0, 1), NOTCH),
        notch((c, p.height + sa), (0, 1), NOTCH),
        notch((c + p.bottom_width / 2, p.height + sa), (0, 1), NOTCH),
        # top edge: centre and the two handle ends
        notch((c, -sa), (0, -1), NOTCH),
        notch((c - p.top_width / 2 + p.handle_inset, -sa), (0, -1), NOTCH),
        notch((c + p.top_width / 2 - p.handle_inset, -sa), (0, -1), NOTCH),
    ]
    inset = min(15.0, p.height / 4)
    grain = LineString([(c, sa + inset), (c, p.height + sa - inset)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(max(p.top_width, p.bottom_width), p.height),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=grain,
        notes=(
            f"trapezoid: top {p.top_width:g}, bottom {p.bottom_width:g}; "
            f"handles attach between the top notches (inset {p.handle_inset:g} mm)"
        ),
    )


def _gusset(p: TaperedTote) -> PatternPiece:
    sa = p.seam_allowance
    side = p.side
    length = 2 * side + p.bottom_width
    finished = rect(length, p.depth)
    cut = seam_outline(finished, sa)

    corner_a = side
    corner_b = side + p.bottom_width
    notches = [
        notch((corner_a, p.depth + sa), (0, 1), NOTCH),
        notch((corner_a, -sa), (0, -1), NOTCH),
        notch((corner_b, p.depth + sa), (0, 1), NOTCH),
        notch((corner_b, -sa), (0, -1), NOTCH),
        notch((corner_a + p.bottom_width / 2, p.depth + sa), (0, 1), NOTCH),
    ]
    inset = min(15.0, length / 4)
    grain = LineString([(sa + inset, p.depth / 2), (length + sa - inset, p.depth / 2)])
    return PatternPiece(
        id="gusset",
        name="Gusset",
        cut=cut,
        finished_size=(length, p.depth),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=grain,
        notes=(
            f"runs up the left side ({side:.1f}), across the bottom "
            f"({p.bottom_width:g}), up the right side ({side:.1f}); depth {p.depth:g}"
        ),
    )


def _handle(piece_id: str, name: str, p: TaperedTote) -> PatternPiece:
    sa = p.seam_allowance
    w, h = p.handle_length, p.handle_width
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
    type="tapered-tote",
    label="Tapered tote",
    sections=(
        Section(
            "Bag",
            (
                Field("top_width", "Top width", 340, affects=("front", "back", "gusset")),
                Field("bottom_width", "Bottom width", 260, affects=("front", "back", "gusset")),
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
    generate=lambda params: generate(
        TaperedTote(
            top_width=params["top_width"],
            bottom_width=params["bottom_width"],
            height=params["height"],
            depth=params["depth"],
            handle_length=params["handle_length"],
            handle_width=params["handle_width"],
            handle_inset=params["handle_inset"],
            seam_allowance=params["seam_allowance"],
            name=params["name"],
        )
    ),
)
