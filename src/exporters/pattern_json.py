"""JSON serializer: Pattern -> pattern model (the API contract for the frontend).

Geometry is in millimeters, in each piece's own local coordinates; `transform`
places the piece on the sheet. The SVG and JSON exporters share `arrange()`,
so both see identical placement.
"""

from __future__ import annotations

from model.pattern import Pattern, PatternPiece
from exporters.layout import MARGIN, arrange


def pattern_to_dict(pattern: Pattern) -> dict:
    placements, content_w, content_h = arrange(pattern.pieces)
    return {
        "name": pattern.name,
        "sheet": {
            "width": round(content_w + 2 * MARGIN, 3),
            "height": round(content_h + 2 * MARGIN, 3),
        },
        "pieces": [
            _piece_to_dict(piece, tx, ty) for piece, tx, ty in placements
        ],
    }


def _piece_to_dict(piece: PatternPiece, tx: float, ty: float) -> dict:
    minx, miny, maxx, maxy = piece.cut.bounds
    ring = list(piece.cut.exterior.coords)
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    fw, fh = piece.finished_size
    return {
        "id": piece.id,
        "name": piece.name,
        "material": piece.material,
        "notes": piece.notes,
        "finished": [fw, fh],
        "cutSize": [round(maxx - minx, 3), round(maxy - miny, 3)],
        "transform": {"x": round(tx, 3), "y": round(ty, 3)},
        "cut": [[round(x, 3), round(y, 3)] for x, y in ring],
        "stitch": [_polyline(line) for line in piece.stitch],
        "fold": [_polyline(line) for line in piece.fold],
        "notches": [_polyline(line) for line in piece.notches],
        "grain": _polyline(piece.grain) if piece.grain is not None else None,
    }


def _polyline(line) -> list[list[float]]:
    return [[round(x, 3), round(y, 3)] for x, y in line.coords]
