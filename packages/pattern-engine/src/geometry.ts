import type { Edge, EdgeKind, Marking, Point } from "./types";

export const ORIGIN: Point = { x: 0, y: 0 };

/** Depth of a notch cut into the seam allowance. */
export const NOTCH_LENGTH_MM = 4;

export type Side = "top" | "right" | "bottom" | "left";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function point(x: number, y: number): Point {
  return { x, y };
}

export function rectPath(width: number, height: number, origin: Point = ORIGIN): Point[] {
  const { x, y } = origin;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export type SideAllowances = Record<Side, number>;

export function uniformSides(amount: number): SideAllowances {
  return { top: amount, right: amount, bottom: amount, left: amount };
}

/** Cut boundary for an axis-aligned finished rectangle, per-side allowance. */
export function offsetRectPath(
  width: number,
  height: number,
  allowance: number | SideAllowances,
): Point[] {
  const a = typeof allowance === "number" ? uniformSides(allowance) : allowance;
  return [
    { x: -a.left, y: -a.top },
    { x: width + a.right, y: -a.top },
    { x: width + a.right, y: height + a.bottom },
    { x: -a.left, y: height + a.bottom },
  ];
}

export type Corner = "tl" | "tr" | "br" | "bl";

const CORNER_ANGLES: Record<Corner, [number, number]> = {
  tl: [180, 270],
  tr: [270, 360],
  br: [0, 90],
  bl: [90, 180],
};

/**
 * Expand a convex polygon outward, keeping sharp corners. `distanceMm` is one
 * distance for every edge, or one per edge (edge i runs from vertex i to i + 1).
 */
export function offsetConvexPath(points: Point[], distanceMm: number | number[]): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const distances = points.map((_, index) =>
    typeof distanceMm === "number" ? distanceMm : (distanceMm[index] ?? 0),
  );

  const area = signedArea(points);
  const direction = area >= 0 ? 1 : -1;
  const lines = points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    if (!end) throw new Error("invalid polygon");
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = direction * (dy / length);
    const ny = direction * (-dx / length);
    const d = distances[index] ?? 0;
    return {
      start: { x: start.x + nx * d, y: start.y + ny * d },
      end: { x: end.x + nx * d, y: end.y + ny * d },
    };
  });

  return points.map((_, index) => {
    const previous = lines[(index - 1 + lines.length) % lines.length];
    const current = lines[index];
    if (!previous || !current) throw new Error("invalid polygon");
    return (
      lineIntersection(previous.start, previous.end, current.start, current.end) ?? {
        ...current.start,
      }
    );
  });
}

export function roundedRectPath(
  width: number,
  height: number,
  radius: number,
  corners: Corner[] = ["tl", "tr", "br", "bl"],
  segments = 8,
  origin: Point = ORIGIN,
): Point[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const { x, y } = origin;
  const centers: Record<Corner, Point> = {
    tl: { x: x + r, y: y + r },
    tr: { x: x + width - r, y: y + r },
    br: { x: x + width - r, y: y + height - r },
    bl: { x: x + r, y: y + height - r },
  };
  const sharp: Record<Corner, Point> = {
    tl: { x, y },
    tr: { x: x + width, y },
    br: { x: x + width, y: y + height },
    bl: { x, y: y + height },
  };

  const points: Point[] = [];
  for (const corner of ["tl", "tr", "br", "bl"] as Corner[]) {
    if (r > 0 && corners.includes(corner)) {
      const [start, end] = CORNER_ANGLES[corner];
      const center = centers[corner];
      for (let i = 0; i <= segments; i += 1) {
        const angle = start + ((end - start) * i) / segments;
        const radians = (angle * Math.PI) / 180;
        points.push({
          x: center.x + r * Math.cos(radians),
          y: center.y + r * Math.sin(radians),
        });
      }
    } else {
      points.push(sharp[corner]);
    }
  }
  return points;
}

function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (current && next) sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const determinantA = a1.x * a2.y - a1.y * a2.x;
  const determinantB = b1.x * b2.y - b1.y * b2.x;
  return {
    x: (determinantA * (b1.x - b2.x) - (a1.x - a2.x) * determinantB) / denominator,
    y: (determinantA * (b1.y - b2.y) - (a1.y - a2.y) * determinantB) / denominator,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(points: Point[], close = false): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    if (prev && current) total += distance(prev, current);
  }
  if (close && points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first && last) total += distance(last, first);
  }
  return total;
}

export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (current && next) sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function boundsOf(points: Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function rotatePoint(p: Point, degrees: number, origin: Point): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export interface RectEdgeSpec {
  kind?: EdgeKind;
  seamId?: string;
  allowanceMm?: number;
}

export interface RectEdgesSpec {
  top?: RectEdgeSpec;
  right?: RectEdgeSpec;
  bottom?: RectEdgeSpec;
  left?: RectEdgeSpec;
}

export function makeEdge(
  id: string,
  start: Point,
  end: Point,
  kind: EdgeKind = "raw",
  seamId?: string,
  allowanceMm = 0,
): Edge {
  return {
    id,
    start,
    end,
    length: distance(start, end),
    kind,
    allowanceMm,
    ...(seamId ? { seamId } : {}),
  };
}

/** Unit outward normal of an edge (edges run clockwise on screen). */
export function edgeNormal(edge: Pick<Edge, "start" | "end">): Point {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dy / length, y: -dx / length };
}

/**
 * Band alongside an edge as a closed polygon: from `inner` mm inside the
 * sewing line to `outer` mm outside it (negative values move inward).
 */
export function edgeBand(edge: Pick<Edge, "start" | "end">, inner: number, outer: number): Point[] {
  const n = edgeNormal(edge);
  const at = (p: Point, d: number) => ({ x: p.x + n.x * d, y: p.y + n.y * d });
  return [at(edge.start, -inner), at(edge.end, -inner), at(edge.end, outer), at(edge.start, outer)];
}

export function rectEdges(width: number, height: number, spec: RectEdgesSpec = {}): Edge[] {
  const sides: Record<Side, { start: Point; end: Point }> = {
    top: { start: point(0, 0), end: point(width, 0) },
    right: { start: point(width, 0), end: point(width, height) },
    bottom: { start: point(width, height), end: point(0, height) },
    left: { start: point(0, height), end: point(0, 0) },
  };

  return (Object.keys(sides) as Side[]).map((side) => {
    const segment = sides[side];
    const config = spec[side] ?? {};
    return makeEdge(
      side,
      segment.start,
      segment.end,
      config.kind ?? "raw",
      config.seamId,
      config.allowanceMm ?? 0,
    );
  });
}

/**
 * Edges between consecutive vertices of a closed sewing polygon. `specs[i]`
 * describes the edge from vertex i to vertex i + 1.
 */
export function polygonEdges(points: Point[], specs: (RectEdgeSpec & { id: string })[]): Edge[] {
  return specs.map((spec, index) => {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) throw new Error(`polygon has no edge ${index}`);
    return makeEdge(spec.id, start, end, spec.kind ?? "raw", spec.seamId, spec.allowanceMm ?? 0);
  });
}

const OUTWARD: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function cutEdgeMidpoint(
  side: Side,
  width: number,
  height: number,
  seamAllowance: number,
): Point {
  switch (side) {
    case "top":
      return { x: width / 2, y: -seamAllowance };
    case "right":
      return { x: width + seamAllowance, y: height / 2 };
    case "bottom":
      return { x: width / 2, y: height + seamAllowance };
    case "left":
      return { x: -seamAllowance, y: height / 2 };
  }
}

export function notchAt(
  at: Point,
  direction: Point,
  length = NOTCH_LENGTH_MM,
  label?: string,
): Marking {
  const magnitude = Math.hypot(direction.x, direction.y) || 1;
  return {
    kind: "notch",
    at,
    direction: {
      x: direction.x / magnitude,
      y: direction.y / magnitude,
    },
    length,
    ...(label ? { label } : {}),
  };
}

export function notchForSide(
  side: Side,
  width: number,
  height: number,
  seamAllowance: number,
  length = NOTCH_LENGTH_MM,
  label?: string,
): Marking {
  return notchAt(cutEdgeMidpoint(side, width, height, seamAllowance), OUTWARD[side], length, label);
}

export function grainlineFor(
  width: number,
  height: number,
  orientation: "vertical" | "horizontal",
): { start: Point; end: Point } {
  if (orientation === "vertical") {
    const inset = Math.min(20, Math.max(1, height * 0.2));
    return {
      start: { x: width / 2, y: inset },
      end: { x: width / 2, y: Math.max(inset + 1, height - inset) },
    };
  }
  const inset = Math.min(20, Math.max(1, width * 0.2));
  return {
    start: { x: inset, y: height / 2 },
    end: { x: Math.max(inset + 1, width - inset), y: height / 2 },
  };
}
