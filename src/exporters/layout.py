"""Piece arrangement: greedy shelf packing onto a virtual sheet, in millimeters.

Shared by the SVG and JSON exporters so both see identical placement.
"""

from __future__ import annotations

from model.pattern import PatternPiece

GAP = 15.0  # gap between pieces, mm
MARGIN = 20.0  # sheet margin, mm
LABEL_H = 19.0  # space reserved under each piece for its label, mm
MAX_ROW_W = 1500.0


def arrange(
    pieces: list[PatternPiece],
) -> tuple[list[tuple[PatternPiece, float, float]], float, float]:
    """Returns (piece, tx, ty) placing each cut box on the sheet, plus content size."""
    items = []
    for p in pieces:
        minx, miny, maxx, maxy = p.cut.bounds
        items.append((p, maxx - minx, maxy - miny))
    items.sort(key=lambda it: -it[2])  # tallest first

    placements = []
    x = y = 0.0
    row_h = 0.0
    content_w = 0.0
    for piece, w, h in items:
        box_h = h + LABEL_H
        if x > 0 and x + w > MAX_ROW_W:
            y += row_h + GAP
            x, row_h = 0.0, 0.0
        minx, miny, _, _ = piece.cut.bounds
        placements.append((piece, MARGIN + x - minx, MARGIN + y - miny))
        x += w + GAP
        row_h = max(row_h, box_h)
        content_w = max(content_w, x - GAP)
    content_h = y + row_h
    return placements, content_w, content_h
