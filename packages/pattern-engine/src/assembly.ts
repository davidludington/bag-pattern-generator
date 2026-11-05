import type { ConfigurationFor } from "./schema";
import type { Pattern, PatternPiece, Point } from "./types";

export type Vec3 = [number, number, number];

/** Part of a piece (2D mm, y down) the frame covers; unset sides are open. */
export interface Clip {
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
}

/** Maps a piece's 2D point into bag space: origin + x*xAxis + y*yAxis. */
export interface PieceFrame {
  pieceId: string;
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  /** A folded piece gets one frame per flat segment, each clipped to its part. */
  clip?: Clip;
}

/** A piece bent along a path: a round tube (size = diameter) or a flat ribbon (size = width along dir). */
export interface Sweep {
  pieceId: string;
  kind: "tube" | "ribbon";
  path: Vec3[];
  size: number;
  dir: Vec3;
}

export interface Assembly {
  frames: PieceFrame[];
  sweeps: Sweep[];
  /** Layer offsets (thickness) mean seams only meet to within this. */
  toleranceMm: number;
}

/**
 * Bag space: x = width, y = up, z = depth (front at +z). Pieces without a
 * frame or sweep (fillers) are not shown.
 */
export function assemble(pattern: Pattern): Assembly | null {
  const ids = new Set(pattern.pieces.map((p) => p.id));
  const built = build(pattern);
  if (!built) return null;
  return {
    ...built,
    frames: built.frames.filter((f) => ids.has(f.pieceId)),
    sweeps: built.sweeps.filter((s) => ids.has(s.pieceId)),
  };
}

function build(pattern: Pattern): Assembly | null {
  switch (pattern.template) {
    case "tote":
      return tote(pattern);
    case "birkin":
      return birkin(pattern);
    case "tapered-tote":
      return taperedTote(pattern);
    case "zip-pouch":
      return flatPouch(pattern, 0);
    case "drawstring":
      return flatPouch(pattern, casingFoldY(pattern));
    case "boxed-pouch":
      return boxedPouch(pattern);
    default:
      return null;
  }
}

export function pieceThicknessMm(piece: PatternPiece): number {
  return piece.thicknessMm ?? 1;
}

export function toBagSpace(frame: PieceFrame, p: Point): Vec3 {
  const at = (i: 0 | 1 | 2) => frame.origin[i] + p.x * frame.xAxis[i] + p.y * frame.yAxis[i];
  return [at(0), at(1), at(2)];
}

/** The finished (sewn) outline: the stitch or fold loop, else the edge bounds. */
function outlineOf(piece: PatternPiece): Point[] {
  const loop = [...piece.stitchPaths, ...piece.foldPaths].find((p) => p.closed);
  if (loop) return loop.points;
  const xs = piece.edges.flatMap((e) => [e.start.x, e.end.x]);
  const ys = piece.edges.flatMap((e) => [e.start.y, e.end.y]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** What the frame shows of its piece: the finished outline cut to the frame's clip. */
export function framePolygon(piece: PatternPiece, frame: PieceFrame): Point[] {
  const { x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity } = frame.clip ?? {};
  // Sutherland–Hodgman against the four sides of the clip rectangle
  const sides: [(p: Point) => number, number][] = [
    [(p) => p.x - x0, 0],
    [(p) => x1 - p.x, 0],
    [(p) => p.y - y0, 0],
    [(p) => y1 - p.y, 0],
  ];
  let poly = outlineOf(piece);
  for (const [dist] of sides) {
    const next: Point[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const [da, db] = [dist(a), dist(b)];
      if (da >= 0) next.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        next.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    });
    poly = next;
  }
  return poly;
}

// --- builders -------------------------------------------------------------

const UP: Vec3 = [0, -1, 0]; // piece y (down) -> bag y (up)
const X: Vec3 = [1, 0, 0];

const frame = (
  pieceId: string,
  origin: Vec3,
  xAxis: Vec3,
  yAxis: Vec3,
  clip?: Clip,
): PieceFrame => ({ pieceId, origin, xAxis, yAxis, ...(clip ? { clip } : {}) });

function mirrorZ(f: PieceFrame, pieceId: string): PieceFrame {
  const m = ([x, y, z]: Vec3): Vec3 => [x, y, -z];
  return { ...f, pieceId, origin: m(f.origin), xAxis: m(f.xAxis), yAxis: m(f.yAxis) };
}

const pieceOf = (pattern: Pattern, id: string) => pattern.pieces.find((p) => p.id === id);
const thicknessOf = (pattern: Pattern, id: string) => {
  const piece = pieceOf(pattern, id);
  return piece ? pieceThicknessMm(piece) : 1;
};

/** Five-panel box (tote, Birkin): front/back at +-D/2, gussets at +-W/2, base at y = 0. */
function boxBody(
  pattern: Pattern,
): { frames: PieceFrame[]; W: number; H: number; D: number } | null {
  const front = pieceOf(pattern, "front");
  const gusset = pieceOf(pattern, "gusset-left");
  if (!front || !gusset) return null;
  const { width: W, height: H } = front.finishedSize;
  const D = gusset.finishedSize.width;
  return {
    W,
    H,
    D,
    frames: [
      frame("front", [-W / 2, H, D / 2], X, UP),
      frame("back", [-W / 2, H, -D / 2], X, UP),
      frame("gusset-left", [-W / 2, H, D / 2], [0, 0, -1], UP),
      frame("gusset-right", [W / 2, H, D / 2], [0, 0, -1], UP),
      // tote calls the base "bottom", Birkin "base"
      ...["bottom", "base"].map((id) => frame(id, [-W / 2, 0, D / 2], X, [0, 0, -1])),
    ],
  };
}

/** Circular arc from a to b (same height) of the given length, bulging up; straight if too short. */
function arcPath(a: Vec3, b: Vec3, length: number): Vec3[] {
  const chord = Math.abs(b[0] - a[0]);
  if (length <= chord * 1.0001) return [a, b];
  // half-angle h solves h / sin(h) = length / chord (increasing on (0, pi))
  let [lo, hi] = [1e-6, Math.PI - 1e-6];
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (mid / Math.sin(mid) < length / chord) lo = mid;
    else hi = mid;
  }
  const h = (lo + hi) / 2;
  const R = chord / (2 * Math.sin(h));
  const cy = a[1] - R * Math.cos(h);
  const mx = (a[0] + b[0]) / 2;
  return Array.from({ length: 25 }, (_, i) => {
    const phi = -h + (2 * h * i) / 24;
    return [mx + R * Math.sin(phi), cy + R * Math.cos(phi), a[2]] as Vec3;
  });
}

function loop(
  pieceId: string,
  kind: Sweep["kind"],
  x0: number,
  x1: number,
  y: number,
  z: number,
  length: number,
  size: number,
): Sweep {
  return { pieceId, kind, path: arcPath([x0, y, z], [x1, y, z], length), size, dir: [0, 0, 1] };
}

function tote(pattern: Pattern): Assembly | null {
  const box = boxBody(pattern);
  if (!box) return null;
  const { W, H, D } = box;
  const c = pattern.configuration as ConfigurationFor<"tote">;
  const frames = [...box.frames];

  // Pocket sizes are not on the piece; use its finished size. Placement is a
  // shortcut: centred, 15% of the height above the base.
  const place = (id: string, z: number) => {
    const p = pieceOf(pattern, id);
    if (!p) return;
    const { width: w, height: h } = p.finishedSize;
    frames.push(frame(id, [-w / 2, 0.15 * H + h, z], X, UP));
  };
  place("exterior-pocket", D / 2 + thicknessOf(pattern, "exterior-pocket"));
  place("interior-pocket", -D / 2 + thicknessOf(pattern, "interior-pocket"));

  const x0 = -W / 2 + c.strapInsetMm;
  const sweeps = [D / 2, -D / 2].map((z, i) =>
    c.handleStyle === "rolled"
      ? loop(`handle-${i + 1}-wrap`, "tube", x0, -x0, H, z, c.strapLengthMm, c.handleDiameterMm)
      : loop("strap", "ribbon", x0, -x0, H, z, c.strapLengthMm, c.strapWidthMm),
  );
  return { frames, sweeps, toleranceMm: 0.01 };
}

function birkin(pattern: Pattern): Assembly | null {
  const box = boxBody(pattern);
  const flap = pieceOf(pattern, "flap");
  if (!box || !flap) return null;
  const { W, H, D } = box;
  const c = pattern.configuration as ConfigurationFor<"birkin">;
  const t = thicknessOf(pattern, "flap");
  const frames = [...box.frames];

  // top part lies over the opening from the back, then the front part hangs
  // down the front; leather wrap allowance between the two is not drawn
  const fold = flap.finishedSize.height - c.flapHeightMm;
  frames.push(
    frame("flap", [-W / 2, H + t, -D / 2], X, [0, 0, 1], { y1: D }),
    frame("flap", [-W / 2, H + fold + t, D / 2 + t], X, UP, { y0: fold }),
  );

  const x0 = -W / 2 + c.handleInsetMm;
  const sweeps = [D / 2, -D / 2].map((z, i) =>
    loop(`handle-${i + 1}-wrap`, "tube", x0, -x0, H + t, z, c.handleLengthMm, c.handleDiameterMm),
  );
  return { frames, sweeps, toleranceMm: 0.01 + t };
}

function taperedTote(pattern: Pattern): Assembly | null {
  const front = pieceOf(pattern, "front");
  const gusset = pieceOf(pattern, "gusset");
  if (!front || !gusset) return null;
  const c = pattern.configuration as ConfigurationFor<"tapered-tote">;
  const { topWidthMm: top, bottomWidthMm: bottom, heightMm: H, depthMm: D } = c;
  const width = front.finishedSize.width;
  const side = Math.hypot(H, (bottom - top) / 2);

  // left side runs down the slanted edge, the bottom across, the right side back up
  const down: Vec3 = [(top - bottom) / 2 / side, -H / side, 0];
  const upRight: Vec3 = [(top - bottom) / 2 / side, H / side, 0];
  const Y: Vec3 = [0, 0, -1];
  const frames = [
    frame("front", [-width / 2, H, D / 2], X, UP),
    frame("back", [-width / 2, H, -D / 2], X, UP),
    frame("gusset", [-top / 2, H, D / 2], down, Y, { x1: side }),
    frame("gusset", [-bottom / 2 - side, 0, D / 2], X, Y, { x0: side, x1: side + bottom }),
    frame(
      "gusset",
      [bottom / 2 - (side + bottom) * upRight[0], -(side + bottom) * upRight[1], D / 2],
      upRight,
      Y,
      { x0: side + bottom },
    ),
  ];

  const x0 = -top / 2 + c.handleInsetMm;
  const sweeps = [D / 2, -D / 2].map((z, i) =>
    c.handleStyle === "rolled"
      ? loop(`handle-${i + 1}-wrap`, "tube", x0, -x0, H, z, c.handleLengthMm, c.handleDiameterMm)
      : loop(`handle-${i + 1}`, "ribbon", x0, -x0, H, z, c.handleLengthMm, c.handleWidthMm),
  );
  return { frames, sweeps, toleranceMm: 0.01 };
}

/** y of the casing fold line on a drawstring panel; 0 for everything else. */
function casingFoldY(pattern: Pattern): number {
  return pieceOf(pattern, "front")?.foldPaths[0]?.points[0]?.y ?? 0;
}

/** Two layers side by side (zip pouch, drawstring); drawstring panels show only below the fold. */
function flatPouch(pattern: Pattern, fold: number): Assembly | null {
  const front = pieceOf(pattern, "front");
  if (!front) return null;
  const t = thicknessOf(pattern, "front");
  const width = front.finishedSize.width;
  const maxY = outlineOf(front).reduce((m, p) => Math.max(m, p.y), 0);
  const f = frame("front", [-width / 2, maxY, t], X, UP, { y0: fold });
  const back = { ...f, pieceId: "back", origin: [f.origin[0], f.origin[1], 0] as Vec3 };
  return { frames: [f, back], sweeps: [], toleranceMm: 0.01 + t };
}

/** One panel = face + half of each side + half of the base, folded at the pinched corners. */
function boxedPouch(pattern: Pattern): Assembly | null {
  const c = pattern.configuration as ConfigurationFor<"boxed-pouch">;
  const { widthMm: W, heightMm: H, depthMm: D } = c;
  const b = D / 2;
  const t = thicknessOf(pattern, "front");
  const front: PieceFrame[] = [
    frame("front", [-W / 2 - b, H, D / 2], X, UP, { x0: b, x1: b + W, y1: H }),
    frame("front", [-W / 2, H, 0], [0, 0, 1], UP, { x1: b, y1: H }),
    frame("front", [W / 2, H, D / 2 + b + W], [0, 0, -1], UP, { x0: b + W, y1: H }),
    frame("front", [-W / 2 - b, 0, D / 2 + H], X, [0, 0, -1], { x0: b, x1: b + W, y0: H }),
  ];
  const back = front.map((f) => mirrorZ(f, "back"));
  return { frames: [...front, ...back], sweeps: [], toleranceMm: 0.01 + t };
}

// --- validation -----------------------------------------------------------

const inClip = (p: Point, { x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity }: Clip) =>
  p.x >= x0 - 1e-6 && p.x <= x1 + 1e-6 && p.y >= y0 - 1e-6 && p.y <= y1 + 1e-6;

/** Both edges of every seam must land on the same 3D segment (edges spanning a fold are skipped). */
export function validateAssembly(pattern: Pattern, assembly: Assembly): string[] {
  const bySeam = new Map<string, [Vec3, Vec3][]>();
  for (const piece of pattern.pieces) {
    const frames = assembly.frames.filter((f) => f.pieceId === piece.id);
    for (const edge of piece.edges) {
      if (!edge.seamId) continue;
      const f = frames.find(
        (fr) => inClip(edge.start, fr.clip ?? {}) && inClip(edge.end, fr.clip ?? {}),
      );
      if (!f) continue;
      const segs = bySeam.get(edge.seamId) ?? [];
      segs.push([toBagSpace(f, edge.start), toBagSpace(f, edge.end)]);
      bySeam.set(edge.seamId, segs);
    }
  }
  const near = (a: Vec3, b: Vec3) =>
    a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) <= assembly.toleranceMm);
  const errors: string[] = [];
  for (const [seamId, [first, second, ...rest]] of bySeam) {
    if (!first || !second || rest.length) continue; // partner has no frame yet
    const [[a1, a2], [b1, b2]] = [first, second];
    if (!((near(a1, b1) && near(a2, b2)) || (near(a1, b2) && near(a2, b1)))) {
      errors.push(`seam ${seamId} does not coincide in 3D`);
    }
  }
  return errors;
}
