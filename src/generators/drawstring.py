"""Drawstring bag generator: two body panels with a folded top casing.

Construction (finished dimensions):
  - Front/back: width x height rectangles.
  - The top ``casing`` mm folds to the back along the fold line to form the
    cord channel; the stitch line closes it. The cut piece carries an extra
    ``casing`` mm at the top for the fold.
  - A drawstring (bought cord) threads through both casings.
"""

from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import LineString

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch, rect, seam_outline, stitch_line
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0


@dataclass(frozen=True)
class Drawstring:
    width: float
    height: float
    casing: float
    cord_length: float = 700.0
    seam_allowance: float = 10.0
    name: str = "drawstring"

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError("width and height must be positive")
        if self.casing <= 0 or self.casing >= self.height:
            raise ValueError("casing must be positive and smaller than height")
        if self.cord_length <= 0:
            raise ValueError("cord_length must be positive")
        if self.seam_allowance < 0:
            raise ValueError("seam_allowance must be >= 0")


def generate(p: Drawstring) -> Pattern:
    return Pattern(
        name=p.name,
        pieces=[_panel("front", "Front", p), _panel("back", "Back", p)],
    )


def _panel(piece_id: str, name: str, p: Drawstring) -> PatternPiece:
    sa = p.seam_allowance
    w = p.width
    cut_h = p.height + p.casing  # extra fabric for the folded casing
    finished = rect(w, cut_h)
    cut = seam_outline(finished, sa)

    fold = LineString([(0, p.casing), (w, p.casing)])
    stitch = LineString([(0, 2 * p.casing), (w, 2 * p.casing)])
    notches = [
        notch((-sa, p.casing), (-1, 0), NOTCH),
        notch((w + sa, p.casing), (1, 0), NOTCH),
    ]
    inset = min(15.0, p.height / 4)
    grain = LineString([(w / 2, sa + inset), (w / 2, cut_h + sa - inset)])
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, p.height),
        stitch=[stitch],
        fold=[fold],
        notches=notches,
        grain=grain,
        notes=(
            f"fold the top edge down at the fold line, stitch along the casing "
            f"line; thread {p.cord_length:g} mm of cord"
        ),
    )


SPEC = GeneratorSpec(
    type="drawstring",
    label="Drawstring bag",
    sections=(
        Section(
            "Bag",
            (
                Field("width", "Width", 200, affects=("front", "back")),
                Field("height", "Height", 250, affects=("front", "back")),
                Field("casing", "Casing depth", 25, affects=("front", "back")),
            ),
        ),
        Section(
            "Drawstring",
            (Field("cord_length", "Cord length", 700, affects=("front", "back")),),
        ),
    ),
    generate=lambda params: generate(
        Drawstring(
            width=params["width"],
            height=params["height"],
            casing=params["casing"],
            cord_length=params["cord_length"],
            seam_allowance=params["seam_allowance"],
            name=params["name"],
        )
    ),
)
