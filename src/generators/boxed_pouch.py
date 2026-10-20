"""Boxed pouch generator: two flat panels with the corners cut out and sewn.

Construction (finished bag dimensions), following the standard boxed-corner
formulas (see sew4home.com "How to box corners"):
  - Box cut  C = depth / 2                    (removed from each raw corner)
  - Raw width  RW = width  + depth + 2 * seam_allowance
  - Raw height RH = height + depth / 2 + seam_allowance
  - Cut a C x C square out of both bottom corners, then match the two cut
    edges and sew across at the seam allowance to form the box.
The seam allowance is baked into RW/RH, so the cut outline is built directly.
"""

from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import LineString, Polygon

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0


@dataclass(frozen=True)
class BoxedPouch:
    width: float
    height: float
    depth: float
    seam_allowance: float = 10.0
    name: str = "boxed-pouch"

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0 or self.depth <= 0:
            raise ValueError("width, height and depth must be positive")
        if self.seam_allowance < 0:
            raise ValueError("seam_allowance must be >= 0")
        if self.depth / 2 >= self.width + self.depth:
            raise ValueError("depth too large for width")

    @property
    def box(self) -> float:
        return self.depth / 2

    @property
    def raw_width(self) -> float:
        return self.width + self.depth + 2 * self.seam_allowance

    @property
    def raw_height(self) -> float:
        return self.height + self.box + self.seam_allowance


def generate(p: BoxedPouch) -> Pattern:
    return Pattern(
        name=p.name,
        pieces=[_panel("front", "Front", p), _panel("back", "Back", p)],
    )


def _panel(piece_id: str, name: str, p: BoxedPouch) -> PatternPiece:
    rw, rh, c = p.raw_width, p.raw_height, p.box
    cut = Polygon(
        [
            (0, 0),
            (rw, 0),
            (rw, rh - c),
            (rw - c, rh - c),
            (rw - c, rh),
            (c, rh),
            (c, rh - c),
            (0, rh - c),
        ]
    )

    notches = [
        # bottom edge: where the box cutout starts / ends
        notch((c, rh), (0, 1), NOTCH),
        notch((rw - c, rh), (0, 1), NOTCH),
        # side edges: top of each cutout
        notch((0, rh - c), (-1, 0), NOTCH),
        notch((rw, rh - c), (1, 0), NOTCH),
    ]
    grain = LineString([(rw / 2, 15), (rw / 2, rh - c - 15)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(p.width, p.height),
        notches=notches,
        grain=grain,
        notes=(
            f"cut {c:g} x {c:g} squares from the bottom corners; match the cut edges "
            f"and sew at {p.seam_allowance:g} mm to box (finished depth {p.depth:g})"
        ),
    )


SPEC = GeneratorSpec(
    type="boxed-pouch",
    label="Boxed pouch",
    sections=(
        Section(
            "Bag",
            (
                Field("width", "Width", 200, affects=("front", "back")),
                Field("height", "Height", 120, affects=("front", "back")),
                Field("depth", "Depth", 80, affects=("front", "back")),
            ),
        ),
    ),
    generate=lambda params: generate(
        BoxedPouch(
            width=params["width"],
            height=params["height"],
            depth=params["depth"],
            seam_allowance=params["seam_allowance"],
            name=params["name"],
        )
    ),
)
