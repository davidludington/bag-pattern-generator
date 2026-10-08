"""SVG exporter: Pattern -> printable SVG.

The SVG uses millimeter user units (width/height in mm, viewBox in the same
numbers), so it prints at true scale when printed at 100%.
"""

from __future__ import annotations

import datetime as _dt
from pathlib import Path
from xml.sax.saxutils import escape

from geometry.operations import arrow_tip
from model.pattern import Pattern, PatternPiece

# visual conventions
STYLE = {
    "cut": 'fill="none" stroke="#000000" stroke-width="0.6"',
    "stitch": 'fill="none" stroke="#cc0000" stroke-width="0.45" stroke-dasharray="5 2.5"',
    "fold": 'fill="none" stroke="#0055cc" stroke-width="0.45" stroke-dasharray="1 2"',
    "notch": 'fill="none" stroke="#000000" stroke-width="0.7"',
    "grain": 'fill="none" stroke="#000000" stroke-width="0.45"',
    "grain_head": 'fill="#000000" stroke="none"',
}
FONT = 'font-family="Helvetica, Arial, sans-serif"'

GAP = 15.0  # gap between pieces, mm
MARGIN = 20.0  # sheet margin, mm
LABEL_H = 19.0  # space reserved under each piece for its label, mm
FOOTER_H = 42.0  # legend + scale bar strip, mm
MIN_CONTENT_W = 620.0  # keeps the footer row on one line
MAX_ROW_W = 1500.0


def export_svg(pattern: Pattern, path: str | Path) -> None:
    placements, content_w, content_h = _arrange(pattern.pieces)
    width = max(content_w, MIN_CONTENT_W) + 2 * MARGIN
    height = MARGIN + content_h + 10.0 + FOOTER_H + MARGIN
    footer_y = MARGIN + content_h + 10.0

    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.2f}mm" '
        f'height="{height:.2f}mm" viewBox="0 0 {width:.2f} {height:.2f}">',
        f'<rect x="0" y="0" width="{width:.2f}" height="{height:.2f}" fill="#ffffff"/>',
        f'<rect x="0.5" y="0.5" width="{width - 1:.2f}" height="{height - 1:.2f}" '
        'fill="none" stroke="#bbbbbb" stroke-width="0.5"/>',
    ]
    for piece, tx, ty in placements:
        out.append(f'<g transform="translate({tx:.2f} {ty:.2f})">')
        out.extend(_piece_svg(piece))
        out.append("</g>")
    out.extend(_footer_svg(pattern, width, footer_y))
    out.append("</svg>")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def _arrange(pieces: list[PatternPiece]) -> tuple[list[tuple[PatternPiece, float, float]], float, float]:
    """Greedy shelf packing. Returns (piece, tx, ty) translating each cut box to (0,0)."""
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


def _path(coords, close: bool = False) -> str:
    points = " L ".join(f"{px:.2f},{py:.2f}" for px, py in coords)
    return f"M {points}" + (" Z" if close else "")


def _piece_svg(piece: PatternPiece) -> list[str]:
    svg = [f'<path d="{_path(piece.cut.exterior.coords, close=True)}" {STYLE["cut"]}/>']
    for line in piece.stitch:
        svg.append(f'<path d="{_path(line.coords)}" {STYLE["stitch"]}/>')
    for line in piece.fold:
        svg.append(f'<path d="{_path(line.coords)}" {STYLE["fold"]}/>')
    for line in piece.notches:
        svg.append(f'<path d="{_path(line.coords)}" {STYLE["notch"]}/>')
    if piece.grain is not None:
        coords = list(piece.grain.coords)
        svg.append(f'<path d="{_path(coords)}" {STYLE["grain"]}/>')
        tip = arrow_tip(coords[-2], coords[-1])
        pts = " ".join(f"{px:.2f},{py:.2f}" for px, py in tip)
        svg.append(f'<polygon points="{pts}" {STYLE["grain_head"]}/>')

    minx, miny, maxx, maxy = piece.cut.bounds
    cut_w, cut_h = maxx - minx, maxy - miny
    fw, fh = piece.finished_size
    svg.append(
        f'<text x="0" y="{maxy + 7:.2f}" font-size="6" font-weight="bold" {FONT}>'
        f"{escape(piece.name)}</text>"
    )
    svg.append(
        f'<text x="0" y="{maxy + 12.5:.2f}" font-size="4" {FONT}>'
        f"finished {fw:g} &#215; {fh:g} mm &#183; cut {cut_w:.0f} &#215; {cut_h:.0f} mm"
        "</text>"
    )
    if piece.notes:
        svg.append(
            f'<text x="0" y="{maxy + 17:.2f}" font-size="3.5" fill="#555555" {FONT}>'
            f"{escape(piece.notes)}</text>"
        )
    return svg


def _footer_svg(pattern: Pattern, width: float, y: float) -> list[str]:
    svg = []
    x = MARGIN

    # scale reference: an exact 100 mm bar
    svg.append(f'<text x="{x:.2f}" y="{y + 6:.2f}" font-size="4" {FONT}>Scale check</text>')
    svg.append(
        f'<path d="M {x:.2f} {y + 14:.2f} L {x + 100:.2f} {y + 14:.2f}" '
        'stroke="#000000" stroke-width="0.6" fill="none"/>'
    )
    for tick_x in (x, x + 100):
        svg.append(
            f'<path d="M {tick_x:.2f} {y + 11:.2f} L {tick_x:.2f} {y + 17:.2f}" '
            'stroke="#000000" stroke-width="0.6" fill="none"/>'
        )
    svg.append(
        f'<text x="{x:.2f}" y="{y + 23:.2f}" font-size="4" {FONT}>'
        "100 mm &#8212; print at 100%, verify with a ruler</text>"
    )

    # legend
    lx = x + 150
    items = [
        ("cut", "CUT line"),
        ("stitch", "STITCH line"),
        ("fold", "FOLD line"),
        ("notch", "notch / match mark"),
    ]
    for key, label in items:
        svg.append(
            f'<path d="M {lx:.2f} {y + 14:.2f} L {lx + 22:.2f} {y + 14:.2f}" {STYLE[key]}/>'
        )
        svg.append(f'<text x="{lx:.2f}" y="{y + 23:.2f}" font-size="4" {FONT}>{label}</text>')
        lx += 70
    # grainline swatch with arrow
    svg.append(
        f'<path d="M {lx:.2f} {y + 18:.2f} L {lx + 22:.2f} {y + 18:.2f}" {STYLE["grain"]}/>'
    )
    tip = arrow_tip((lx, y + 18), (lx + 22, y + 18))
    pts = " ".join(f"{px:.2f},{py:.2f}" for px, py in tip)
    svg.append(f'<polygon points="{pts}" {STYLE["grain_head"]}/>')
    svg.append(f'<text x="{lx:.2f}" y="{y + 23:.2f}" font-size="4" {FONT}>grainline</text>')

    # title block, right-aligned
    svg.append(
        f'<text x="{width - MARGIN:.2f}" y="{y + 6:.2f}" font-size="6" font-weight="bold" '
        f'text-anchor="end" {FONT}>{escape(pattern.name)} pattern</text>'
    )
    svg.append(
        f'<text x="{width - MARGIN:.2f}" y="{y + 12:.2f}" font-size="4" text-anchor="end" {FONT}>'
        f"units: mm &#183; pieces: {len(pattern.pieces)} &#183; "
        f"generated {_dt.date.today().isoformat()}</text>"
    )
    svg.append(
        f'<text x="{width - MARGIN:.2f}" y="{y + 17.5:.2f}" font-size="4" text-anchor="end" '
        f'fill="#555555" {FONT}>seam lines are shown inside the cut line by the seam allowance</text>'
    )
    return svg
