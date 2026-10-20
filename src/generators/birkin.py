"""Birkin-style bag generator: box body, fold-over flap, sangles, rolled handles.

Construction (finished dimensions):
  - Body is a 5-panel box: front, back, base, and two side gussets.
  - Flap folds from the back top over the opening and down the front; the
    visible drop is ``flap_height``, so the flat piece is
    ``width x (depth + flap_height)`` with rounded bottom corners.
  - Two sangles (straps) run down the front over the flap to the turn-lock.
  - Two rolled handles: each is a wrap strip rolled into a tube over a core
    strip. The wrap is ``pi * diameter + seam allowance`` wide.
Hardware (turn-lock, grommets, feet) is bought, not cut.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import pi

from shapely.geometry import LineString

from generators.base import Field, GeneratorSpec, Section
from geometry.operations import notch, rect, rounded_rect, seam_outline, stitch_line
from model.pattern import Pattern, PatternPiece

NOTCH = 4.0


@dataclass(frozen=True)
class Birkin:
    width: float
    height: float
    depth: float
    flap_height: float
    flap_radius: float = 20.0
    strap_width: float = 30.0
    strap_inset: float = 60.0
    strap_length: float = 320.0
    handle_length: float = 320.0
    handle_diameter: float = 20.0
    handle_core_width: float = 18.0
    handle_inset: float = 60.0
    seam_allowance: float = 10.0
    name: str = "birkin"

    def __post_init__(self) -> None:
        positive = (
            "width", "height", "depth", "flap_height", "strap_width",
            "strap_length", "handle_length", "handle_diameter",
            "handle_core_width",
        )
        for field in positive:
            if getattr(self, field) <= 0:
                raise ValueError(f"{field} must be positive")
        for field in ("flap_radius", "strap_inset", "handle_inset"):
            if getattr(self, field) < 0:
                raise ValueError(f"{field} must be >= 0")
        if self.seam_allowance < 0:
            raise ValueError("seam_allowance must be >= 0")
        if self.flap_radius > min(self.width, self.depth + self.flap_height) / 2:
            raise ValueError("flap_radius too large for the flap")
        if 2 * self.strap_inset + self.strap_width > self.width:
            raise ValueError("strap_inset + strap_width too large for width")
        if 2 * self.handle_inset >= self.width:
            raise ValueError("handle_inset too large for width")

    @property
    def flap_height_total(self) -> float:
        return self.depth + self.flap_height

    @property
    def handle_wrap_width(self) -> float:
        return pi * self.handle_diameter + self.seam_allowance


def generate(p: Birkin) -> Pattern:
    return Pattern(
        name=p.name,
        pieces=[
            _box_panel("front", "Front", p.width, p.height, p),
            _box_panel("back", "Back", p.width, p.height, p),
            _box_panel("base", "Base", p.width, p.depth, p, horizontal=True),
            _box_panel("gusset-left", "Gusset left", p.depth, p.height, p),
            _box_panel("gusset-right", "Gusset right", p.depth, p.height, p),
            _flap(p),
            _sangle("strap-1", "Strap 1", p),
            _sangle("strap-2", "Strap 2", p),
            _wrap("handle-1-wrap", "Handle 1 wrap", p),
            _core("handle-1-core", "Handle 1 core", p),
            _wrap("handle-2-wrap", "Handle 2 wrap", p),
            _core("handle-2-core", "Handle 2 core", p),
        ],
    )


def _corner_notches(w: float, h: float, sa: float) -> list:
    return [
        notch((-sa, h + sa), (-1, 1), NOTCH),
        notch((w + sa, h + sa), (1, 1), NOTCH),
        notch((-sa, -sa), (-1, -1), NOTCH),
        notch((w + sa, -sa), (1, -1), NOTCH),
    ]


def _grain(horizontal: bool, w: float, h: float, sa: float) -> LineString:
    inset = min(15.0, (w if horizontal else h) / 4)
    if horizontal:
        return LineString([(sa + inset, h / 2), (w + sa - inset, h / 2)])
    return LineString([(w / 2, sa + inset), (w / 2, h + sa - inset)])


def _box_panel(
    piece_id: str,
    name: str,
    w: float,
    h: float,
    p: Birkin,
    horizontal: bool = False,
) -> PatternPiece:
    sa = p.seam_allowance
    finished = rect(w, h)
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=seam_outline(finished, sa),
        finished_size=(w, h),
        stitch=[stitch_line(finished)],
        notches=_corner_notches(w, h, sa),
        grain=_grain(horizontal, w, h, sa),
        notes="box panel: join to the gussets/base at the corner notches",
    )


def _flap(p: Birkin) -> PatternPiece:
    sa = p.seam_allowance
    w, h = p.width, p.flap_height_total
    finished = rounded_rect(w, h, p.flap_radius, corners=("bl", "br"))
    notches = [notch((w / 2, h + sa), (0, 1), NOTCH)]
    for x in (p.strap_inset, w - p.strap_inset):
        notches.append(notch((x, h + sa), (0, 1), NOTCH))
    for x in (p.handle_inset, w - p.handle_inset):
        notches.append(notch((x, -sa), (0, -1), NOTCH))
    return PatternPiece(
        id="flap",
        name="Flap",
        cut=seam_outline(finished, sa),
        finished_size=(w, h),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=_grain(False, w, h, sa),
        notes=(
            f"sewn to the back top edge; folds {p.depth:g} over the opening and "
            f"{p.flap_height:g} down the front; sangle notches on the bottom edge"
        ),
    )


def _sangle(piece_id: str, name: str, p: Birkin) -> PatternPiece:
    sa = p.seam_allowance
    w, h = p.strap_length, p.strap_width
    finished = rect(w, h)
    notches = [
        notch((sa, -sa), (0, -1), NOTCH),
        notch((w + sa, h + sa), (0, 1), NOTCH),
    ]
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=seam_outline(finished, sa),
        finished_size=(w, h),
        stitch=[stitch_line(finished)],
        notches=notches,
        grain=_grain(True, w, h, sa),
        notes=(
            f"runs from the back top, over the flap, to the turn-lock; "
            f"inset {p.strap_inset:g} mm from the side edge"
        ),
    )


def _wrap(piece_id: str, name: str, p: Birkin) -> PatternPiece:
    sa = p.seam_allowance
    w = p.handle_length
    h = p.handle_wrap_width  # pi * diameter + seam allowance
    cut = rect(w, h)
    stitch = [
        LineString([(0, sa), (w, sa)]),
        LineString([(0, h - sa), (w, h - sa)]),
    ]
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, h - sa),
        stitch=stitch,
        grain=_grain(True, w, h, 0.0),
        notes=(
            f"roll into a {p.handle_diameter:g} mm tube; join the two long edges "
            "at the stitch lines, ends taper into the top"
        ),
    )


def _core(piece_id: str, name: str, p: Birkin) -> PatternPiece:
    w, h = p.handle_length, p.handle_core_width
    cut = rect(w, h)
    return PatternPiece(
        id=piece_id,
        name=name,
        cut=cut,
        finished_size=(w, h),
        grain=_grain(True, w, h, 0.0),
        notes="inner filler for the rolled handle (hidden inside the wrap)",
    )


SPEC = GeneratorSpec(
    type="birkin",
    label="Birkin-style bag",
    sections=(
        Section(
            "Bag",
            (
                Field("width", "Width", 300, affects=("front", "back", "base", "flap")),
                Field("height", "Height", 240, affects=("front", "back", "gusset-left", "gusset-right")),
                Field("depth", "Depth", 140, affects=("base", "gusset-left", "gusset-right", "flap")),
            ),
        ),
        Section(
            "Flap",
            (
                Field("flap_height", "Flap drop", 140, affects=("flap",)),
                Field("flap_radius", "Corner radius", 20, min=0, affects=("flap",)),
            ),
        ),
        Section(
            "Straps",
            (
                Field("strap_width", "Width", 30, affects=("strap-1", "strap-2")),
                Field("strap_inset", "Inset", 60, min=0, affects=("strap-1", "strap-2")),
                Field("strap_length", "Length", 320, affects=("strap-1", "strap-2")),
            ),
        ),
        Section(
            "Handles",
            (
                Field("handle_length", "Length", 320, affects=(
                    "handle-1-wrap", "handle-1-core", "handle-2-wrap", "handle-2-core")),
                Field("handle_diameter", "Tube diameter", 20, affects=(
                    "handle-1-wrap", "handle-2-wrap")),
                Field("handle_core_width", "Core width", 18, affects=(
                    "handle-1-core", "handle-2-core")),
                Field("handle_inset", "Inset", 60, min=0, affects=("flap",)),
            ),
        ),
    ),
    generate=lambda params: generate(
        Birkin(
            width=params["width"],
            height=params["height"],
            depth=params["depth"],
            flap_height=params["flap_height"],
            flap_radius=params["flap_radius"],
            strap_width=params["strap_width"],
            strap_inset=params["strap_inset"],
            strap_length=params["strap_length"],
            handle_length=params["handle_length"],
            handle_diameter=params["handle_diameter"],
            handle_core_width=params["handle_core_width"],
            handle_inset=params["handle_inset"],
            seam_allowance=params["seam_allowance"],
            name=params["name"],
        )
    ),
)
