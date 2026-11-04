import {
  applyConstruction,
  constructionRules,
  punch,
  reinforceZone,
  wrapAllowance,
  type ConstructionRules,
} from "../construction";
import {
  grainlineFor,
  makeEdge,
  notchAt,
  notchForSide,
  roundedRectPath,
  type RectEdgesSpec,
} from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Component, Marking, Pattern, PatternPiece } from "../types";
import { assertValidPattern } from "../validation";
import { BOX_BODY_EDGES, rectPiece } from "./shared";

type BirkinConfiguration = ConfigurationFor<"birkin">;

/** Hardware placement. These are starting points: confirm against the parts. */
const HARDWARE = {
  rivetMm: 3,
  anchor: { width: 30, height: 40, rivetFromTop: 15 },
  /** Turn-lock centre above the flap tip, and its reinforcement square. */
  lockAboveTipMm: 25,
  lockZoneMm: 40,
  lockHoleMm: 12,
};

/**
 * Five-panel box body (front, back, base, two gussets; seams follow
 * BOX_BODY_EDGES) plus a flap sewn to the back top edge.
 *
 * In leather the flap gains a wrap allowance for bending over the front panel,
 * the rolled handle is shortened to its neutral axis, and hardware positions
 * (handle rivets, sangle anchors, turn-lock) are marked with reinforcement.
 */
export function generateBirkinPattern(config: BirkinConfiguration): Pattern {
  const rules = constructionRules(config);
  const { widthMm: width, heightMm: height, depthMm: depth } = config;
  const panel = (
    id: string,
    name: string,
    w: number,
    h: number,
    component: Component,
    edges: RectEdgesSpec,
    extra: Marking[] = [],
    grainline: "vertical" | "horizontal" = "vertical",
  ) =>
    rectPiece({
      id,
      name,
      width: w,
      height: h,
      material: config.material,
      component,
      rules,
      edges,
      grainline,
      extraNotches: extra,
      notes: "box panel: match the centre notches to the neighbouring panel",
    });

  const pattern: Pattern = {
    name: config.name,
    template: "birkin",
    unit: "mm",
    configuration: config,
    pieces: [
      panel(
        "front",
        "Front",
        width,
        height,
        "body",
        BOX_BODY_EDGES.front,
        rules.leather ? [...handleAnchors(config), ...turnLockBase(config)] : [],
      ),
      panel(
        "back",
        "Back",
        width,
        height,
        "body",
        { ...BOX_BODY_EDGES.back, top: { kind: "sew", seamId: "back-flap" } },
        rules.leather ? [...handleAnchors(config)] : [],
      ),
      panel("base", "Base", width, depth, "base", BOX_BODY_EDGES.base, [], "horizontal"),
      panel("gusset-left", "Gusset left", depth, height, "gusset", BOX_BODY_EDGES.gussetLeft),
      panel("gusset-right", "Gusset right", depth, height, "gusset", BOX_BODY_EDGES.gussetRight),
      flap(config, rules),
      // sangle("strap-1", "Strap 1", config, rules),
      // sangle("strap-2", "Strap 2", config, rules),
      wrap("handle-1", "Handle 1", config, rules),
      core("handle-1-core", "Handle 1 core", config, rules),
      wrap("handle-2", "Handle 2", config, rules),
      core("handle-2-core", "Handle 2 core", config, rules),
    ],
  };
  assertValidPattern(pattern);
  return pattern;
}

/** Handle ends are riveted through the top of the front and back panels. */
function handleAnchors(config: BirkinConfiguration): Marking[] {
  const { anchor, rivetMm } = HARDWARE;
  return [config.handleInsetMm, config.widthMm - config.handleInsetMm].flatMap((x) => [
    reinforceZone(x, 0, anchor.width, anchor.height, "reinforce handle anchor"),
    punch(x, anchor.rivetFromTop, rivetMm, "handle rivet"),
  ]);
}

/** Sangles start at the back top edge. */
// function sangleAnchors(config: BirkinConfiguration): Marking[] {
//   const centre = config.strapInsetMm + config.strapWidthMm / 2;
//   return [centre, config.widthMm - centre].map((x) =>
//     reinforceZone(
//       x,
//       0,
//       config.strapWidthMm + 10,
//       HARDWARE.anchor.height,
//       "reinforce sangle anchor",
//     ),
//   );
// }

/** The turn-lock base sits on the front, just above where the flap tip lands. */
function turnLockBase(config: BirkinConfiguration): Marking[] {
  const y = Math.max(HARDWARE.lockZoneMm / 2, config.flapHeightMm - HARDWARE.lockAboveTipMm);
  const half = HARDWARE.lockZoneMm / 2;
  return [
    reinforceZone(
      config.widthMm / 2,
      y - half,
      HARDWARE.lockZoneMm,
      HARDWARE.lockZoneMm,
      "reinforce turn-lock",
    ),
    punch(config.widthMm / 2, y, HARDWARE.rivetMm, "turn-lock base (confirm with hardware)"),
  ];
}

function flap(config: BirkinConfiguration, rules: ConstructionRules): PatternPiece {
  const sa = rules.seamAllowanceMm;
  const e = rules.allowanceFor("raw");
  const width = config.widthMm;
  // Bending over the front edge wraps the flap around itself plus the front
  // panel; (π/2) x stack is an upper bound, so confirm with a folded mock-up.
  const flapT = rules.thicknessOf("flap");
  const bodyT = rules.thicknessOf("body");
  const wrap = flapT !== null && bodyT !== null ? wrapAllowance(flapT + bodyT) : 0;
  const foldY = config.depthMm + wrap;
  const height = foldY + config.flapHeightMm;
  const radius = config.flapRadiusMm;

  const markings: Marking[] = [
    notchForSide("top", width, height, sa, undefined, "back-flap"),
    notchAt({ x: width / 2, y: height + e }, { x: 0, y: 1 }, undefined, "centre"),
    notchAt({ x: -e, y: foldY }, { x: -1, y: 0 }, undefined, "front fold"),
    notchAt({ x: width + e, y: foldY }, { x: 1, y: 0 }, undefined, "front fold"),
  ];
  for (const x of [config.strapInsetMm, width - config.strapInsetMm]) {
    markings.push(notchAt({ x, y: height + e }, { x: 0, y: 1 }, undefined, "strap"));
  }
  for (const x of [config.handleInsetMm, width - config.handleInsetMm]) {
    markings.push(notchAt({ x, y: -sa }, { x: 0, y: -1 }, undefined, "handle"));
  }
  if (radius > 0) {
    // Mark both ends of each corner arc, never mid-curve.
    markings.push(
      notchAt({ x: -e, y: height - radius }, { x: -1, y: 0 }, undefined, "arc"),
      notchAt({ x: radius, y: height + e }, { x: 0, y: 1 }, undefined, "arc"),
      notchAt({ x: width + e, y: height - radius }, { x: 1, y: 0 }, undefined, "arc"),
      notchAt({ x: width - radius, y: height + e }, { x: 0, y: 1 }, undefined, "arc"),
    );
  }
  if (rules.leather) {
    markings.push(
      reinforceZone(width / 2, foldY - 5, width - 20, 10, "reinforce flap fold"),
      punch(width / 2, height - HARDWARE.lockAboveTipMm, HARDWARE.lockHoleMm, "turn-lock hole"),
    );
  }

  const piece: PatternPiece = {
    id: "flap",
    name: "Flap",
    quantity: 1,
    material: config.material,
    finishedSize: { width, height },
    seamAllowance: { amountMm: sa },
    component: "flap",
    thicknessMm: null,
    edgeFinish: null,
    cutPath: roundedRectPath(width + 2 * e, height + sa + e, radius + e, ["bl", "br"], 8, {
      x: -e,
      y: -sa,
    }),
    stitchPaths: [{ points: roundedRectPath(width, height, radius, ["bl", "br"]), closed: true }],
    foldPaths: [],
    edges: [
      makeEdge("top", { x: 0, y: 0 }, { x: width, y: 0 }, "sew", "back-flap", sa),
      makeEdge("right", { x: width, y: 0 }, { x: width, y: height - radius }, "raw", undefined, e),
      makeEdge(
        "bottom",
        { x: width - radius, y: height },
        { x: radius, y: height },
        "raw",
        undefined,
        e,
      ),
      makeEdge("left", { x: 0, y: height - radius }, { x: 0, y: 0 }, "raw", undefined, e),
    ],
    markings,
    grainline: grainlineFor(width, height, "vertical"),
    notes:
      `sewn to the back top edge; folds ${config.depthMm} over the opening and ${config.flapHeightMm} down the front; sangle notches on the bottom edge` +
      (wrap > 0
        ? `; includes ${wrap.toFixed(1)} mm wrap allowance at the front fold (upper bound: check with a mock-up)`
        : ""),
  };
  return applyConstruction(piece, "flap", rules);
}

// function sangle(
//   id: string,
//   name: string,
//   config: BirkinConfiguration,
//   rules: ConstructionRules,
// ): PatternPiece {
//   const e = rules.allowanceFor("raw");
//   const width = config.strapLengthMm;
//   const height = config.strapWidthMm;
//   return rectPiece({
//     id,
//     name,
//     width,
//     height,
//     material: config.material,
//     component: "strap",
//     rules,
//     edges: {},
//     grainline: "horizontal",
//     extraNotches: [
//       notchForSide("left", width, height, e, undefined, "back top"),
//       notchForSide("right", width, height, e, undefined, "turn-lock"),
//       ...(rules.leather
//         ? [
//           punch(
//             width - HARDWARE.lockAboveTipMm,
//             height / 2,
//             HARDWARE.lockHoleMm,
//             "turn-lock slot",
//           ),
//         ]
//         : []),
//     ],
//     notes: `runs from the back top, over the flap, to the turn-lock; inset ${config.strapInsetMm} mm from the side edge`,
//   });
// }

/**
 * The wrap rolls into a tube around the core. Its finished height is the tube
 * circumference; the two long edges are sewn to each other, so each carries a
 * full seam allowance and they share one seam id. Leather bends about its
 * mid-thickness, so the circumference is taken at diameter - thickness.
 */
function wrap(
  id: string,
  name: string,
  config: BirkinConfiguration,
  rules: ConstructionRules,
): PatternPiece {
  const thickness = rules.thicknessOf("strap") ?? 0;
  const circumference = Math.PI * (config.handleDiameterMm - thickness);
  return rectPiece({
    id: `${id}-wrap`,
    name: `${name} wrap`,
    width: config.handleLengthMm,
    height: circumference,
    material: config.material,
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
      `roll into a ${config.handleDiameterMm} mm tube; join the two long edges at the stitch lines, ends taper into the top` +
      (thickness > 0
        ? `; circumference measured at the leather's mid-thickness (${thickness} mm leather)`
        : ""),
  });
}

function core(
  id: string,
  name: string,
  config: BirkinConfiguration,
  rules: ConstructionRules,
): PatternPiece {
  return rectPiece({
    id,
    name,
    width: config.handleLengthMm,
    height: config.handleCoreWidthMm,
    material: config.material,
    component: "filler",
    rules,
    allowanceMm: 0,
    edges: {},
    grainline: "horizontal",
    line: "none",
    notes: "inner filler for the rolled handle (hidden inside the wrap); cut to size, no allowance",
  });
}
