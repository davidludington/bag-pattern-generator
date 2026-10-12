"""Pattern representation: sits between the bag model and any exporter."""

from __future__ import annotations

from dataclasses import dataclass, field

from shapely.geometry import LineString, Polygon

CUT = "cut"
STITCH = "stitch"
FOLD = "fold"


@dataclass
class PatternPiece:
    """One physical pattern piece.

    id     - stable identifier used by exporters and UIs ("front", "handle-1", ...)
    cut    - the cut outline as a polygon (finished shape outset by seam allowance)
    stitch - stitch lines (the finished seam lines), drawn dashed
    fold   - fold lines, drawn dotted
    notches- short match-mark ticks crossing the cut line, drawn solid
    grain  - grainline: LineString whose end point is the arrow tip
    """

    id: str
    name: str
    cut: Polygon
    finished_size: tuple[float, float]
    stitch: list[LineString] = field(default_factory=list)
    fold: list[LineString] = field(default_factory=list)
    notches: list[LineString] = field(default_factory=list)
    grain: LineString | None = None
    material: str = "outer"
    notes: str = ""


@dataclass
class Pattern:
    name: str
    pieces: list[PatternPiece]

    def piece(self, name: str) -> PatternPiece:
        for p in self.pieces:
            if p.name == name:
                return p
        raise KeyError(name)
