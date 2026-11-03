import { boundsOf } from "./geometry";
import type { PatternPiece } from "./types";

export interface PiecePlacement {
  piece: PatternPiece;
  /** Top-left of the piece's cut bounds on the sheet. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetLayout {
  placements: PiecePlacement[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  gap?: number;
  margin?: number;
  labelHeight?: number;
  maxWidth?: number;
  minWidth?: number;
}

/** Greedy shelf packing shared by the editor, SVG export, and tests. */
export function layoutPieces(pieces: PatternPiece[], options: LayoutOptions = {}): SheetLayout {
  const gap = options.gap ?? 15;
  const margin = options.margin ?? 20;
  const labelHeight = options.labelHeight ?? 19;
  const maxWidth = options.maxWidth ?? 1400;
  const minWidth = options.minWidth ?? 0;

  const items = pieces.map((piece) => {
    const bounds = boundsOf(piece.cutPath);
    return { piece, bounds };
  });
  items.sort((a, b) => b.bounds.height - a.bounds.height);

  const placements: PiecePlacement[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let contentWidth = 0;

  for (const item of items) {
    const { piece, bounds } = item;
    if (x > 0 && x + bounds.width > maxWidth) {
      y += rowHeight + gap;
      x = 0;
      rowHeight = 0;
    }
    placements.push({
      piece,
      x: margin + x - bounds.minX,
      y: margin + y - bounds.minY,
      width: bounds.width,
      height: bounds.height,
    });
    x += bounds.width + gap;
    rowHeight = Math.max(rowHeight, bounds.height + labelHeight);
    contentWidth = Math.max(contentWidth, x - gap);
  }

  const contentHeight = y + rowHeight;
  return {
    placements,
    width: Math.max(minWidth, contentWidth) + 2 * margin,
    height: contentHeight + 2 * margin,
  };
}
