"""Thin wrappers over Shapely for the operations the generators need."""

from __future__ import annotations

from shapely.affinity import translate as _translate
from shapely.geometry import LineString, Polygon


def rect(width: float, height: float, x: float = 0.0, y: float = 0.0) -> Polygon:
    """Axis-aligned rectangle with corner (x, y) at the top-left (SVG-style, y grows down)."""
    return Polygon(
        [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    )


def seam_outline(finished: Polygon, seam_allowance: float) -> Polygon:
    """Cut outline: finished shape outset by the seam allowance, mitred corners."""
    return finished.buffer(seam_allowance, join_style="mitre")


def stitch_line(finished: Polygon) -> LineString:
    """Closed stitch line following the finished seam boundary."""
    return LineString(finished.exterior.coords)


def move(geom, dx: float, dy: float):
    return _translate(geom, xoff=dx, yoff=dy)


def notch(center: tuple[float, float], outward: tuple[float, float], length: float = 4.0) -> LineString:
    """Match-mark tick starting on the cut line, pointing outward (perpendicular to the edge)."""
    (cx, cy), (ox, oy) = center, outward
    norm = (ox * ox + oy * oy) ** 0.5
    if norm == 0:
        raise ValueError("outward must be non-zero")
    ux, uy = ox / norm, oy / norm
    return LineString([(cx, cy), (cx + ux * length, cy + uy * length)])


def arrow_tip(tail: tuple[float, float], tip: tuple[float, float], size: float = 4.0) -> list[tuple[float, float]]:
    """Triangle vertices for an arrowhead at `tip`, pointing along tail -> tip."""
    dx, dy = tip[0] - tail[0], tip[1] - tail[1]
    norm = (dx * dx + dy * dy) ** 0.5
    if norm == 0:
        raise ValueError("arrow needs a non-zero length")
    ux, uy = dx / norm, dy / norm
    px, py = -uy, ux
    base = (tip[0] - ux * size, tip[1] - uy * size)
    half = size * 0.4
    return [
        tip,
        (base[0] + px * half, base[1] + py * half),
        (base[0] - px * half, base[1] - py * half),
    ]
