import { constructionRules } from "../construction";
import { notchForSide } from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Pattern, PatternPiece } from "../types";
import { assertValidPattern } from "../validation";
import { BOX_BODY_EDGES, rectPiece } from "./shared";

type ToteConfiguration = ConfigurationFor<"tote">;

function pocketSize(
  config: ToteConfiguration,
  kind: "interior" | "exterior",
): { width: number; height: number } {
  const widthRatio = kind === "interior" ? 0.7 : 0.6;
  const heightRatio = kind === "interior" ? 0.55 : 0.45;
  const maxHeight = kind === "interior" ? 180 : 140;
  return {
    width: Math.max(40, Math.min(config.widthMm * widthRatio, 220)),
    height: Math.max(40, Math.min(config.heightMm * heightRatio, maxHeight)),
  };
}

/**
 * Straightforward tote construction: front, back, separate bottom, and two
 * side gussets. All dimensions are finished millimeters; the cut boundary adds
 * the seam allowance on seamed edges and the material's exposed-edge allowance
 * (hem for fabric, none or a turn-in for leather) on the opening and straps.
 *
 * Seams follow BOX_BODY_EDGES.
 */
export function generateTotePattern(config: ToteConfiguration): Pattern {
  const rules = constructionRules(config);
  // the opening is an exposed edge: hemmed on fabric, finished on leather
  const opening = rules.allowanceFor("raw");
  const { widthMm: width, heightMm: height, depthMm: depth } = config;

  const front = rectPiece({
    id: "front",
    name: "Front",
    width,
    height,
    material: config.material,
    rules,
    component: "body",
    edges: BOX_BODY_EDGES.front,
    grainline: "vertical",
    notes: "Top edge is the bag opening; sides and bottom are sewn.",
    extraNotches: [notchForSide("top", width, height, opening, undefined, "opening")],
  });

  const back = rectPiece({
    id: "back",
    name: "Back",
    width,
    height,
    material: config.material,
    rules,
    component: "body",
    edges: BOX_BODY_EDGES.back,
    grainline: "vertical",
    notes: "Top edge is the bag opening; sides and bottom are sewn.",
    extraNotches: [notchForSide("top", width, height, opening, undefined, "opening")],
  });

  const bottom = rectPiece({
    id: "bottom",
    name: "Bottom",
    width,
    height: depth,
    material: config.material,
    rules,
    component: "base",
    edges: BOX_BODY_EDGES.base,
    grainline: "horizontal",
    notes: "Sews to the front, back, and both side gussets.",
  });

  const leftGusset = rectPiece({
    id: "gusset-left",
    name: "Left Gusset",
    width: depth,
    height,
    material: config.material,
    rules,
    component: "gusset",
    edges: BOX_BODY_EDGES.gussetLeft,
    grainline: "vertical",
    notes: "Links the front, back, and bottom on the left side.",
    extraNotches: [notchForSide("top", depth, height, opening, undefined, "opening")],
  });

  const rightGusset = rectPiece({
    id: "gusset-right",
    name: "Right Gusset",
    width: depth,
    height,
    material: config.material,
    rules,
    component: "gusset",
    edges: BOX_BODY_EDGES.gussetRight,
    grainline: "vertical",
    notes: "Links the front, back, and bottom on the right side.",
    extraNotches: [notchForSide("top", depth, height, opening, undefined, "opening")],
  });

  const strap = rectPiece({
    id: "strap",
    name: "Strap",
    width: config.strapLengthMm,
    height: config.strapWidthMm,
    quantity: 2,
    material: config.material,
    rules,
    component: "strap",
    edges: {
      top: { kind: "fold" },
      right: { kind: "fold" },
      bottom: { kind: "fold" },
      left: { kind: "fold" },
    },
    grainline: "horizontal",
    line: "fold",
    notes: rules.leather
      ? "Cut 2. Single layer; skive the ends where they fold onto the bag."
      : "Cut 2. Fold all four edges under at the seam lines; raw edges meet at the back.",
  });

  const pieces: PatternPiece[] = [front, back, bottom, leftGusset, rightGusset, strap];

  if (config.interiorPocket) {
    const pocket = pocketSize(config, "interior");
    pieces.push(
      rectPiece({
        id: "interior-pocket",
        name: "Interior Pocket",
        width: pocket.width,
        height: pocket.height,
        material: config.material,
        rules,
        component: "pocket",
        edges: {
          top: { kind: "fold" },
          right: { kind: "sew" },
          bottom: { kind: "sew" },
          left: { kind: "sew" },
        },
        grainline: "vertical",
        notes: "Patch pocket. Hem the top edge; sew sides and bottom to the bag lining.",
      }),
    );
  }

  if (config.exteriorPocket) {
    const pocket = pocketSize(config, "exterior");
    pieces.push(
      rectPiece({
        id: "exterior-pocket",
        name: "Exterior Pocket",
        width: pocket.width,
        height: pocket.height,
        material: config.material,
        rules,
        component: "pocket",
        edges: {
          top: { kind: "fold" },
          right: { kind: "sew" },
          bottom: { kind: "sew" },
          left: { kind: "sew" },
        },
        grainline: "vertical",
        notes: "Patch pocket. Hem the top edge; sew sides and bottom to the bag exterior.",
      }),
    );
  }

  const pattern: Pattern = {
    name: config.name,
    template: "tote",
    unit: "mm",
    configuration: config,
    pieces,
  };
  assertValidPattern(pattern);
  return pattern;
}
