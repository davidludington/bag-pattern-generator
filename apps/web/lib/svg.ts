import {
  boundsOf,
  layoutPieces,
  rotatePoint,
  type Pattern,
  type PatternPiece,
  type Point,
} from "@bag-patterns/pattern-engine";
import {
  arrowHead,
  notchPath,
  num,
  pathD,
  pieceDimensions,
  pieceTitle,
  punchCross,
  SHEET_LAYOUT,
  splitMarkings,
  wrapText,
} from "./pattern-draw";
import { emptyTransform, type PieceTransform } from "./projects";

const FOOTER_HEIGHT = 50;
const MARGIN = 20;
const MIN_CONTENT_WIDTH = 620;
const LABEL_HEIGHT = SHEET_LAYOUT.labelHeight ?? 28;
const FONT = 'font-family="Helvetica, Arial, sans-serif"';

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pieceSvg(piece: PatternPiece): string[] {
  const out: string[] = [];
  out.push(`<path class="cut" d="${pathD(piece.cutPath, true)}"/>`);
  for (const line of piece.stitchPaths) {
    out.push(`<path class="sew" d="${pathD(line.points, line.closed)}"/>`);
  }
  for (const line of piece.foldPaths) {
    out.push(`<path class="fold" d="${pathD(line.points, line.closed)}"/>`);
  }
  const { notches, zones, punches } = splitMarkings(piece.markings);
  for (const zone of zones) {
    out.push(
      `<path class="${zone.zone}" d="${pathD(zone.points, true)}"><title>${escapeXml(zone.label)}</title></path>`,
    );
  }
  for (const marking of notches) {
    out.push(`<path class="notch" d="${notchPath(marking)}"/>`);
  }
  for (const marking of punches) {
    out.push(
      `<g class="punch"><title>${escapeXml(marking.label)}</title><circle cx="${num(marking.at.x)}" cy="${num(marking.at.y)}" r="${num(marking.diameterMm / 2)}"/><path d="${punchCross(marking)}"/></g>`,
    );
  }
  if (piece.grainline) {
    const { start, end } = piece.grainline;
    out.push(`<path class="grain" d="${pathD([start, end])}"/>`);
    out.push(`<polygon class="grain-head" points="${arrowHead(start, end)}"/>`);
  }

  const bounds = boundsOf(piece.cutPath);
  out.push(
    `<text x="${num(bounds.minX)}" y="${num(bounds.maxY + 7)}" font-size="6" font-weight="bold" ${FONT}>${escapeXml(pieceTitle(piece))}</text>`,
  );
  out.push(
    `<text x="${num(bounds.minX)}" y="${num(bounds.maxY + 12.5)}" font-size="4" ${FONT}>${escapeXml(pieceDimensions(piece))}</text>`,
  );
  if (piece.notes) {
    // ~1.8 mm per character at 3.5 mm Helvetica
    const maxChars = Math.max(24, Math.floor(bounds.width / 1.8));
    const lines = wrapText(piece.notes, maxChars);
    const spans = lines
      .map(
        (line, index) =>
          `<tspan x="${num(bounds.minX)}" dy="${index === 0 ? 0 : 4.2}">${escapeXml(line)}</tspan>`,
      )
      .join("");
    out.push(
      `<text x="${num(bounds.minX)}" y="${num(bounds.maxY + 17.5)}" font-size="3.5" fill="#555555" ${FONT}>${spans}</text>`,
    );
  }
  return out;
}

function footerSvg(pattern: Pattern, width: number, y: number): string[] {
  const out: string[] = [];
  out.push(`<text x="${MARGIN}" y="${num(y + 6)}" font-size="4" ${FONT}>Scale check</text>`);
  out.push(
    `<path d="M ${MARGIN} ${num(y + 14)} L ${MARGIN + 100} ${num(y + 14)}" fill="none" stroke="#000000" stroke-width="0.6"/>`,
  );
  for (const tick of [MARGIN, MARGIN + 100]) {
    out.push(
      `<path d="M ${tick} ${num(y + 11)} L ${tick} ${num(y + 17)}" fill="none" stroke="#000000" stroke-width="0.6"/>`,
    );
  }
  out.push(
    `<text x="${MARGIN}" y="${num(y + 23)}" font-size="4" ${FONT}>100 mm — print at 100%, verify with a ruler</text>`,
  );

  const legend: [string, string][] = [
    ["cut", "CUT line"],
    ["sew", "SEWING line"],
    ["fold", "FOLD line"],
    ["notch", "notch / match mark"],
    ["grain", "grainline"],
  ];
  if (pattern.configuration.material === "leather") {
    legend.push(["skive", "skive zone"], ["reinforce", "reinforce"], ["punch", "punch / hardware"]);
  }
  let lx = MARGIN;
  for (const [className, label] of legend) {
    const swatch =
      className === "skive" || className === "reinforce"
        ? `<rect class="${className}" x="${num(lx)}" y="${num(y + 30)}" width="22" height="4"/>`
        : className === "punch"
          ? `<circle class="punch" cx="${num(lx + 11)}" cy="${num(y + 32)}" r="1.5"/>`
          : `<path class="${className}" d="M ${num(lx)} ${num(y + 32)} L ${num(lx + 22)} ${num(y + 32)}"/>`;
    out.push(swatch);
    out.push(`<text x="${num(lx)}" y="${num(y + 40)}" font-size="4" ${FONT}>${label}</text>`);
    lx += 75;
  }

  out.push(
    `<text x="${num(width - MARGIN)}" y="${num(y + 6)}" font-size="6" font-weight="bold" text-anchor="end" ${FONT}>${escapeXml(pattern.name)} pattern</text>`,
  );
  out.push(
    `<text x="${num(width - MARGIN)}" y="${num(y + 12)}" font-size="4" text-anchor="end" ${FONT}>units: mm · pieces: ${pattern.pieces.length} · seam allowance: ${num(pattern.configuration.seamAllowanceMm)} mm</text>`,
  );
  out.push(
    `<text x="${num(width - MARGIN)}" y="${num(y + 17.5)}" font-size="4" text-anchor="end" fill="#555555" ${FONT}>${pattern.configuration.material === "leather" ? `leather: ${pattern.configuration.edgeFinish} edges (cut on the line unless folded); thickness per piece label` : "each cut line includes that piece's seam allowance (see piece labels)"}</text>`,
  );
  return out;
}

interface PlacedPiece {
  piece: PatternPiece;
  /** Translation of the piece's local origin on the sheet. */
  x: number;
  y: number;
  rotation: number;
  center: Point;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Place pieces with the shared layout plus any workspace moves and rotations,
 * and measure each piece (with its label block) on the sheet.
 */
function placePieces(pattern: Pattern, transforms: Record<string, PieceTransform>): PlacedPiece[] {
  return layoutPieces(pattern.pieces, SHEET_LAYOUT).placements.map((placement) => {
    const transform = transforms[placement.piece.id] ?? emptyTransform();
    const local = boundsOf(placement.piece.cutPath);
    const center = { x: local.minX + local.width / 2, y: local.minY + local.height / 2 };
    const corners = [
      { x: local.minX, y: local.minY },
      { x: local.maxX, y: local.minY },
      { x: local.maxX, y: local.maxY + LABEL_HEIGHT },
      { x: local.minX, y: local.maxY + LABEL_HEIGHT },
    ].map((corner) => rotatePoint(corner, transform.rotation, center));
    const rotated = boundsOf(corners);
    const x = placement.x + transform.x;
    const y = placement.y + transform.y;
    return {
      piece: placement.piece,
      x,
      y,
      rotation: transform.rotation,
      center,
      bounds: {
        minX: x + rotated.minX,
        minY: y + rotated.minY,
        maxX: x + rotated.maxX,
        maxY: y + rotated.maxY,
      },
    };
  });
}

/**
 * Printable SVG at true millimetre scale. Pieces keep the arrangement from the
 * workspace (moves and rotations); the sheet grows to fit them.
 */
export function renderPatternSvg(
  pattern: Pattern,
  transforms: Record<string, PieceTransform> = {},
): string {
  const placed = placePieces(pattern, transforms);
  const minX = Math.min(...placed.map((p) => p.bounds.minX));
  const minY = Math.min(...placed.map((p) => p.bounds.minY));
  const maxX = Math.max(...placed.map((p) => p.bounds.maxX));
  const maxY = Math.max(...placed.map((p) => p.bounds.maxY));
  const shiftX = MARGIN - minX;
  const shiftY = MARGIN - minY;

  const width = Math.max(MIN_CONTENT_WIDTH, maxX - minX) + 2 * MARGIN;
  const footerY = maxY - minY + 2 * MARGIN;
  const height = footerY + FOOTER_HEIGHT;

  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="0 0 ${num(width)} ${num(height)}">`,
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="#ffffff"/>`,
    `<rect x="0.5" y="0.5" width="${num(width - 1)}" height="${num(height - 1)}" fill="none" stroke="#bbbbbb" stroke-width="0.5"/>`,
    "<style>",
    ".cut { fill: none; stroke: #000000; stroke-width: 0.6; }",
    ".sew { fill: none; stroke: #b91c1c; stroke-width: 0.45; stroke-dasharray: 5 2.5; }",
    ".fold { fill: none; stroke: #1d4ed8; stroke-width: 0.45; stroke-dasharray: 1 2; }",
    ".notch { fill: none; stroke: #000000; stroke-width: 0.7; }",
    ".grain { fill: none; stroke: #000000; stroke-width: 0.45; }",
    ".grain-head { fill: #000000; stroke: none; }",
    ".skive { fill: #f59e0b; fill-opacity: 0.22; stroke: #b45309; stroke-width: 0.25; stroke-dasharray: 1.5 1; }",
    ".reinforce { fill: #2563eb; fill-opacity: 0.12; stroke: #1d4ed8; stroke-width: 0.3; stroke-dasharray: 3 1.5; }",
    ".punch { fill: none; stroke: #000000; stroke-width: 0.35; }",
    "</style>",
  ];

  for (const p of placed) {
    const rotate = p.rotation
      ? ` rotate(${num(p.rotation)} ${num(p.center.x)} ${num(p.center.y)})`
      : "";
    out.push(
      `<g data-piece="${escapeXml(p.piece.id)}" transform="translate(${num(p.x + shiftX)} ${num(p.y + shiftY)})${rotate}">`,
    );
    out.push(...pieceSvg(p.piece));
    out.push("</g>");
  }

  out.push(...footerSvg(pattern, width, footerY));
  out.push("</svg>");
  return `${out.join("\n")}\n`;
}
