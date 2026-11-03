import { edgeBand } from "./geometry";
import type { BagConfiguration, EdgeFinish } from "./schema";
import type { Component, EdgeKind, Marking, PatternPiece } from "./types";

/**
 * Material-specific construction rules, derived once per configuration and
 * passed to every piece builder. Fabric keeps the original behaviour (every
 * edge carries the seam allowance, exposed edges are hemmed). Leather follows
 * the leather construction guide (.opencode/skills/leather-bag-construction):
 *
 * - thickness is set per component, never once for the whole bag;
 * - painted, burnished and raw edges are cut on the finished line (no
 *   allowance); folded edges carry a turn-in;
 * - seam allowances and turned edges are skived, and the zones are marked;
 * - folds that wrap a stack gain (π/2) × stack thickness.
 */
export interface ConstructionRules {
  leather: boolean;
  seamAllowanceMm: number;
  edgeFinish: EdgeFinish | null;
  /** Allowance on an edge of the given kind. */
  allowanceFor(kind: EdgeKind): number;
  /** Leather thickness for a component; null for fabric or unstitched fillers. */
  thicknessOf(component: Component): number | null;
  skive: { widthMm: number; toMm: number } | null;
}

/** Extra length for a 180° fold around a stack of total thickness `stackMm`. */
export function wrapAllowance(stackMm: number): number {
  return (Math.PI / 2) * stackMm;
}

export function constructionRules(config: BagConfiguration): ConstructionRules {
  const sa = config.seamAllowanceMm;
  if (config.material !== "leather") {
    return {
      leather: false,
      seamAllowanceMm: sa,
      edgeFinish: null,
      allowanceFor: () => sa,
      thicknessOf: () => null,
      skive: null,
    };
  }

  const exposed = config.edgeFinish === "folded" ? config.turnInMm : 0;
  const thickness: Record<Component, number | null> = {
    body: config.leatherBodyMm,
    flap: config.leatherBodyMm,
    pocket: config.leatherBodyMm,
    base: config.leatherBaseMm,
    gusset: config.leatherGussetMm,
    strap: config.leatherStrapMm,
    filler: null,
  };
  return {
    leather: true,
    seamAllowanceMm: sa,
    edgeFinish: config.edgeFinish,
    allowanceFor: (kind) => (kind === "sew" ? sa : exposed),
    thicknessOf: (component) => thickness[component],
    skive: { widthMm: config.skiveWidthMm, toMm: config.skiveToMm },
  };
}

const FINISH_NOTE: Record<EdgeFinish, string> = {
  painted: "paint exposed edges",
  burnished: "burnish exposed edges",
  raw: "leave exposed edges raw",
  folded: "fold exposed edges under at the turn line",
};

/**
 * Stamp a piece with its component, thickness, and edge finish, and mark skive
 * zones: every seam allowance (so seams lie flat) and, for folded edges, the
 * turn-in plus the rest of the skive width.
 */
export function applyConstruction(
  piece: PatternPiece,
  component: Component,
  rules: ConstructionRules,
): PatternPiece {
  const thicknessMm = rules.thicknessOf(component);
  if (!rules.leather || thicknessMm === null) {
    return { ...piece, component, thicknessMm, edgeFinish: rules.edgeFinish };
  }

  const skive = rules.skive;
  const zones: Marking[] = [];
  if (skive) {
    for (const edge of piece.edges) {
      if (edge.kind === "sew" && edge.allowanceMm > 0) {
        zones.push({
          kind: "zone",
          zone: "skive",
          points: edgeBand(edge, 0, edge.allowanceMm),
          label: `skive seam allowance to ${skive.toMm} mm`,
        });
      } else if (edge.kind !== "sew" && rules.edgeFinish === "folded" && edge.allowanceMm > 0) {
        const inside = Math.max(0, skive.widthMm - edge.allowanceMm);
        zones.push({
          kind: "zone",
          zone: "skive",
          points: edgeBand(edge, inside, edge.allowanceMm),
          label: `skive turned edge to ${skive.toMm} mm`,
        });
      }
    }
  }

  const spec = `${thicknessMm} mm leather; ${FINISH_NOTE[rules.edgeFinish ?? "raw"]}`;
  return {
    ...piece,
    component,
    thicknessMm,
    edgeFinish: rules.edgeFinish,
    markings: [...piece.markings, ...zones],
    notes: piece.notes ? `${piece.notes}. ${spec}` : spec,
  };
}

/** A reinforcement rectangle centred on `x`, from `y` for `height` mm. */
export function reinforceZone(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
): Marking {
  return {
    kind: "zone",
    zone: "reinforce",
    points: [
      { x: x - width / 2, y },
      { x: x + width / 2, y },
      { x: x + width / 2, y: y + height },
      { x: x - width / 2, y: y + height },
    ],
    label,
  };
}

export function punch(x: number, y: number, diameterMm: number, label: string): Marking {
  return { kind: "punch", at: { x, y }, diameterMm, label };
}
