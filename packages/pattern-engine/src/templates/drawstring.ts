import { applyConstruction, constructionRules, wrapAllowance } from "../construction";
import { grainlineFor, notchAt, offsetRectPath, rectEdges } from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Pattern, PatternPiece } from "../types";
import { assertValidPattern } from "../validation";

type DrawstringConfiguration = ConfigurationFor<"drawstring">;

export function generateDrawstringPattern(config: DrawstringConfiguration): Pattern {
  const pattern: Pattern = {
    name: config.name,
    template: "drawstring",
    unit: "mm",
    configuration: config,
    pieces: [panel("front", "Front", config), panel("back", "Back", config)],
  };
  assertValidPattern(pattern);
  return pattern;
}

function panel(id: string, name: string, config: DrawstringConfiguration): PatternPiece {
  const rules = constructionRules(config);
  const sa = rules.seamAllowanceMm;
  const top = rules.allowanceFor("raw");
  const width = config.widthMm;
  // Leather is too thick to fold flat: the flap above the fold line gains the
  // wrap allowance for bending 180° around one layer of itself.
  const thickness = rules.thicknessOf("body");
  const foldExtra = thickness === null ? 0 : wrapAllowance(thickness);
  const casingDepth = config.casingMm + foldExtra;
  const cutHeight = config.heightMm + casingDepth;
  const allowances = { top, right: sa, bottom: sa, left: sa };

  const piece: PatternPiece = {
    id,
    name,
    quantity: 1,
    material: config.material,
    finishedSize: { width, height: config.heightMm },
    seamAllowance: { amountMm: sa },
    component: "body",
    thicknessMm: null,
    edgeFinish: null,
    cutPath: offsetRectPath(width, cutHeight, allowances),
    stitchPaths: [
      {
        points: [
          { x: 0, y: casingDepth + config.casingMm },
          { x: width, y: casingDepth + config.casingMm },
        ],
        closed: false,
      },
    ],
    foldPaths: [
      {
        points: [
          { x: 0, y: casingDepth },
          { x: width, y: casingDepth },
        ],
        closed: false,
      },
    ],
    edges: rectEdges(width, cutHeight, {
      top: { kind: "raw", allowanceMm: top },
      right: { kind: "sew", seamId: "right", allowanceMm: sa },
      bottom: { kind: "sew", seamId: "bottom", allowanceMm: sa },
      left: { kind: "sew", seamId: "left", allowanceMm: sa },
    }),
    markings: [
      notchAt({ x: -sa, y: casingDepth }, { x: -1, y: 0 }, undefined, "fold"),
      notchAt({ x: width + sa, y: casingDepth }, { x: 1, y: 0 }, undefined, "fold"),
    ],
    grainline: grainlineFor(width, cutHeight, "vertical"),
    notes:
      `fold the top edge down at the fold line, stitch along the casing line; thread ${config.cordLengthMm} mm of cord` +
      (foldExtra > 0
        ? `; casing includes ${foldExtra.toFixed(1)} mm wrap allowance for the leather fold`
        : ""),
  };
  return applyConstruction(piece, "body", rules);
}
