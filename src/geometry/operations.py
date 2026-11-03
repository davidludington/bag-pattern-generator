"""Thin wrappers over Shapely for the operations the generators need."""

from __future__ import annotations

from math import cos, radians, sin

from shapely.affinity import translate as _translate
from shapely.geometry import LineString, Polygon


def rect(width: float, height: float, x: float = 0.0, y: float = 0.0) -> Polygon:
    """Axis-aligned rectangle with corner (x, y) at the top-left (SVG-style, y grows down)."""
    return Polygon(
        [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    )


CORNER_ANGLES = {
    "tl": (180.0, 270.0),
    "tr": (270.0, 360.0),
    "br": (0.0, 90.0),
    "bl": (90.0, 180.0),
}


def rounded_rect(
    width: float,
    height: float,
    radius: float,
    x: float = 0.0,
    y: float = 0.0,
    corners: tuple[str, ...] = ("tl", "tr", "br", "bl"),
    segments: int = 8,
) -> Polygon:
    """Rectangle with selected corners rounded (SVG-style, y grows down)."""
    if radius < 0:
        raise ValueError("radius must be >= 0")
    unknown = set(corners) - set(CORNER_ANGLES)
    if unknown:
        raise ValueError(f"unknown corner(s): {', '.join(sorted(unknown))}")
    r = min(radius, width / 2, height / 2)

    def arc(cx: float, cy: float, a0: float, a1: float) -> list[tuple[float, float]]:
        return [
            (
                cx + r * cos(radians(a0 + (a1 - a0) * i / segments)),
                cy + r * sin(radians(a0 + (a1 - a0) * i / segments)),
            )
            for i in range(segments + 1)
        ]

    centers = {
        "tl": (x + r, y + r),
        "tr": (x + width - r, y + r),
        "br": (x + width - r, y + height - r),
        "bl": (x + r, y + height - r),
    }
    sharp = {
        "tl": (x, y),
        "tr": (x + width, y),
        "br": (x + width, y + height),
        "bl": (x, y + height),
    }
    pts: list[tuple[float, float]] = []
    for key in ("tl", "tr", "br", "bl"):
        if key in corners and r > 0:
            pts.extend(arc(*centers[key], *CORNER_ANGLES[key]))
        else:
            pts.append(sharp[key])
    return Polygon(pts)



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
