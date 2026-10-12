import type { Pt } from "../model/Pattern";

export function pathD(pts: Pt[], close = false): string {
  const body = pts.map(([x, y]) => `${x},${y}`).join(" L ");
  return `M ${body}${close ? " Z" : ""}`;
}

export function boundsOf(pts: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Triangle vertices (as an SVG points attribute) for an arrowhead at tip. */
export function arrowPoints(tail: Pt, tip: Pt, size = 4): string {
  const dx = tip[0] - tail[0];
  const dy = tip[1] - tail[1];
  const norm = Math.hypot(dx, dy);
  if (norm === 0) return "";
  const ux = dx / norm;
  const uy = dy / norm;
  const px = -uy;
  const py = ux;
  const baseX = tip[0] - ux * size;
  const baseY = tip[1] - uy * size;
  const half = size * 0.4;
  const p1: Pt = [tip[0], tip[1]];
  const p2: Pt = [baseX + px * half, baseY + py * half];
  const p3: Pt = [baseX - px * half, baseY - py * half];
  return [p1, p2, p3].map(([x, y]) => `${x},${y}`).join(" ");
}

export function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
