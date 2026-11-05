import { applyConstruction, type ConstructionRules } from "../construction";
import {
  grainlineFor,
  notchForSide,
  offsetRectPath,
  rectEdges,
  rectPath,
  type RectEdgesSpec,
  type Side,
  type SideAllowances,
} from "../geometry";
import type { Material } from "../schema";
import type { Component, Marking, PatternPiece } from "../types";

const SIDES: Side[] = ["top", "right", "bottom", "left"];

/**
 * Seams of the five-panel box body (tote, Birkin): front/back sides to the
 * gusset verticals, front/back bottoms to the base long edges, gusset bottoms
 * to the base short edges. Top edges are the opening.
 */
export const BOX_BODY_EDGES = {
  front: {
    top: { kind: "raw" },
    right: { kind: "sew", seamId: "right-front" },
    bottom: { kind: "sew", seamId: "bottom-front" },
    left: { kind: "sew", seamId: "left-front" },
  },
  back: {
    top: { kind: "raw" },
    right: { kind: "sew", seamId: "right-back" },
    bottom: { kind: "sew", seamId: "bottom-back" },
    left: { kind: "sew", seamId: "left-back" },
  },
  base: {
    top: { kind: "sew", seamId: "bottom-front" },
    right: { kind: "sew", seamId: "bottom-right" },
    bottom: { kind: "sew", seamId: "bottom-back" },
    left: { kind: "sew", seamId: "bottom-left" },
  },
  gussetLeft: {
    top: { kind: "raw" },
    right: { kind: "sew", seamId: "left-back" },
    bottom: { kind: "sew", seamId: "bottom-left" },
    left: { kind: "sew", seamId: "left-front" },
  },
  gussetRight: {
    top: { kind: "raw" },
    right: { kind: "sew", seamId: "right-back" },
    bottom: { kind: "sew", seamId: "bottom-right" },
    left: { kind: "sew", seamId: "right-front" },
  },
} as const satisfies Record<string, RectEdgesSpec>;

export interface RectPieceOptions {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity?: number;
  material: Material;
  component: Component;
  rules: ConstructionRules;
  /** Unspecified sides are exposed ("raw") edges. */
  edges: RectEdgesSpec;
  grainline: "vertical" | "horizontal";
  notes?: string;
  extraNotches?: Marking[];
  /** Override the allowance on every side (e.g. 0 for a cut-to-size filler). */
  allowanceMm?: number;
  /** What the finished outline is drawn as. "none" for unstitched fillers. */
  line?: "stitch" | "fold" | "none";
}

/** Allowance on each side of a rect piece, from its edge kinds and the rules. */
export function sideAllowances(
  edges: RectEdgesSpec,
  rules: ConstructionRules,
  override?: number,
): SideAllowances {
  const of = (side: Side) => override ?? rules.allowanceFor(edges[side]?.kind ?? "raw");
  return { top: of("top"), right: of("right"), bottom: of("bottom"), left: of("left") };
}

/**
 * Axis-aligned piece: finished rectangle at the origin, cut line offset by
 * each side's allowance, and a centre notch on every side that carries a seam.
 */
export function rectPiece(options: RectPieceOptions): PatternPiece {
  const { width, height, rules } = options;
  const allowances = sideAllowances(options.edges, rules, options.allowanceMm);
  const edges: RectEdgesSpec = {};
  for (const side of SIDES) {
    edges[side] = { kind: "raw", ...options.edges[side], allowanceMm: allowances[side] };
  }

  const markings: Marking[] = [];
  for (const side of SIDES) {
    const spec = edges[side];
    if (spec?.seamId) {
      markings.push(notchForSide(side, width, height, allowances[side], undefined, spec.seamId));
    }
  }
  markings.push(...(options.extraNotches ?? []));

  // A fold line on an edge with no allowance would sit on the cut line.
  const hasTurn = SIDES.some((side) => allowances[side] > 0);
  const line = options.line === "fold" && !hasTurn ? "none" : (options.line ?? "stitch");
  const outline = { points: rectPath(width, height), closed: true };

  const piece: PatternPiece = {
    id: options.id,
    name: options.name,
    quantity: options.quantity ?? 1,
    material: options.material,
    finishedSize: { width, height },
    seamAllowance: { amountMm: options.allowanceMm ?? rules.seamAllowanceMm },
    component: options.component,
    thicknessMm: null,
    edgeFinish: null,
    cutPath: offsetRectPath(width, height, allowances),
    stitchPaths: line === "stitch" ? [outline] : [],
    foldPaths: line === "fold" ? [outline] : [],
    edges: rectEdges(width, height, edges),
    markings,
    grainline: grainlineFor(width, height, options.grainline),
    ...(options.notes ? { notes: options.notes } : {}),
  };
  return applyConstruction(piece, options.component, rules);
}

/** Filler width for a rolled handle when the config has no explicit core width. */
export const coreWidthFor = (diameterMm: number): number => Math.max(1, diameterMm - 2);

export interface RolledHandleOptions {
  id: string;
  name: string;
  lengthMm: number;
  diameterMm: number;
  coreWidthMm: number;
  material: Material;
  rules: ConstructionRules;
}

/**
 * A rolled handle: the wrap rolls into a tube around a filler core. The wrap's
 * finished height is the tube circumference; its two long edges are sewn to
 * each other, so each carries a full seam allowance and they share one seam id.
 * Leather bends about its mid-thickness, so the circumference is taken at
 * diameter - thickness.
 */
export function rolledHandlePieces(o: RolledHandleOptions): PatternPiece[] {
  const { id, name, lengthMm, diameterMm, rules, material } = o;
  const thickness = rules.thicknessOf("strap") ?? 0;
  const wrap = rectPiece({
    id: `${id}-wrap`,
    name: `${name} wrap`,
    width: lengthMm,
    height: Math.PI * (diameterMm - thickness),
    material,
    component: "strap",
    rules,
    edges: {
      top: { kind: "sew", seamId: `${id}-tube` },
      right: { kind: "raw" },
      bottom: { kind: "sew", seamId: `${id}-tube` },
      left: { kind: "raw" },
    },
    grainline: "horizontal",
    notes:
      `roll into a ${diameterMm} mm tube; join the two long edges at the stitch lines, ends taper into the top` +
      (thickness > 0
        ? `; circumference measured at the leather's mid-thickness (${thickness} mm leather)`
        : ""),
  });
  const core = rectPiece({
    id: `${id}-core`,
    name: `${name} core`,
    width: lengthMm,
    height: o.coreWidthMm,
    material,
    component: "filler",
    rules,
    allowanceMm: 0,
    edges: {},
    grainline: "horizontal",
    line: "none",
    notes: "inner filler for the rolled handle (hidden inside the wrap); cut to size, no allowance",
  });
  return [wrap, core];
}
