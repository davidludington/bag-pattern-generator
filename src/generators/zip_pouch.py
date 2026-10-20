"""Zip pouch generator: flat two-panel pouch with a top zipper.

Construction (finished dimensions):
  - Front/back: identical width x height rectangles.
  - A zipper is sewn into the top seam; the opening is centred and inset
    ``zipper_margin`` from each side edge (0 = full width).
  - Pieces are joined right sides together around the sides and bottom.
"""

from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import LineString

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch, rect, seam_outline, stitch_line
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0


@dataclass(frozen=True)
class ZipPouch:
    width: float
    height: float
    seam_allowance: float = 10.0
    zipper_margin: float = 0.0
    name: str = "zip-pouch"

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError("width and height must be positive")
        if self.seam_allowance < 0:
            raise ValueError("seam_allowance must be >= 0")
        if self.zipper_margin < 0:
            raise ValueError("zipper_margin must be >= 0")
        if 2 * self.zipper_margin >= self.width:
            raise ValueError("zipper_margin too large for width")


def generate(p: ZipPouch) -> Pattern:
    return Pattern(
        name=p.name,
        pieces=[_panel("front", "Front", p), _panel("back", "Back", p)],
    )


def _panel(piece_id: str, name: str, p: ZipPouch) -> PatternPiece:
    sa = p.seam_allowance
    w, h = p.width, p.height
    finished = rect(w, h)
    cut = seam_outline(finished, sa)

    opening = w - 2 * p.zipper_margin
    notches = [notch((w / 2, -sa), (0, -1), NOTCH)]
    if p.zipper_margin > 0:
        notches += [
            notch((p.zipper_margin, -sa), (0, -1), NOTCH),
            notch((w - p.zipper_margin, -sa), (0, -1), NOTCH),
        ]

    inset = min(15.0, h / 4)
    grain = LineString([(w / 2, sa + inset), (w / 2, h + sa - inset)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, h),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=grain,
        notes=(
            f"zipper along the top edge: opening {opening:g} mm "
            f"(zipper about {w:g} mm); join front to back at the side and bottom seams"
        ),
    )


SPEC = GeneratorSpec(
    type="zip-pouch",
    label="Zip pouch",
    sections=(
        Section(
            "Bag",
            (
                Field("width", "Width", 200, affects=("front", "back")),
                Field("height", "Height", 150, affects=("front", "back")),
                Field(
                    "zipper_margin",
                    "Zipper inset",
                    0,
                    min=0,
                    affects=("front", "back"),
                ),
            ),
        ),
    ),
    generate=lambda params: generate(
        ZipPouch(
            width=params["width"],
            height=params["height"],
            seam_allowance=params["seam_allowance"],
            zipper_margin=params["zipper_margin"],
            name=params["name"],
        )
    ),
)
