import {
  boundsOf,
  type LayoutOptions,
  type Marking,
  type PatternPiece,
  type Point,
} from "@bag-patterns/pattern-engine";
import { formatMm } from "./units";

/**
 * Presentation helpers shared by the on-screen canvas and the SVG exporter.
 * They only format engine geometry; they never compute pattern geometry.
 */

/** Layout used by both the workspace and the export, so placements match. */
export const SHEET_LAYOUT: LayoutOptions = { labelHeight: 28 };

export function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function pathD(points: Point[], close = false): string {
  const [first, ...rest] = points;
  if (!first) return "";
  const body = rest.map((p) => `L ${num(p.x)},${num(p.y)}`).join(" ");
  return `M ${num(first.x)},${num(first.y)} ${body}${close ? " Z" : ""}`;
}

export function arrowHead(start: Point, end: Point, size = 4): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return "";
  const ux = dx / length;
  const uy = dy / length;
  const baseX = end.x - ux * size;
  const baseY = end.y - uy * size;
  const half = size * 0.4;
  return [
    end,
    { x: baseX - uy * half, y: baseY + ux * half },
    { x: baseX + uy * half, y: baseY - ux * half },
  ]
    .map((p) => `${num(p.x)},${num(p.y)}`)
    .join(" ");
}

export type NotchMarking = Extract<Marking, { kind: "notch" }>;
export type ZoneMarking = Extract<Marking, { kind: "zone" }>;
export type PunchMarking = Extract<Marking, { kind: "punch" }>;

export function splitMarkings(markings: Marking[]): {
  notches: NotchMarking[];
  zones: ZoneMarking[];
  punches: PunchMarking[];
} {
  return {
    notches: markings.filter((m): m is NotchMarking => m.kind === "notch"),
    zones: markings.filter((m): m is ZoneMarking => m.kind === "zone"),
    punches: markings.filter((m): m is PunchMarking => m.kind === "punch"),
  };
}

/** Cross-hair through a punch mark, so the centre is findable once printed. */
export function punchCross(marking: PunchMarking): string {
  const r = marking.diameterMm / 2 + 1.5;
  const { x, y } = marking.at;
  return `${pathD([
    { x: x - r, y },
    { x: x + r, y },
  ])} ${pathD([
    { x, y: y - r },
    { x, y: y + r },
  ])}`;
}

export function notchPath(marking: NotchMarking): string {
  return pathD([
    marking.at,
    {
      x: marking.at.x + marking.direction.x * marking.length,
      y: marking.at.y + marking.direction.y * marking.length,
    },
  ]);
}

export function pieceTitle(piece: PatternPiece): string {
  return piece.quantity > 1 ? `${piece.name} (cut ${piece.quantity})` : piece.name;
}

export function pieceDimensions(piece: PatternPiece): string {
  const cut = boundsOf(piece.cutPath);
  const leather = piece.thicknessMm === null ? "" : ` · ${formatMm(piece.thicknessMm)} mm leather`;
  return `finished ${formatMm(piece.finishedSize.width)} × ${formatMm(piece.finishedSize.height)} mm · cut ${formatMm(cut.width)} × ${formatMm(cut.height)} mm${leather}`;
}

/** Greedy word wrap. Long notes are capped at `maxLines` with an ellipsis. */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}
