import {
  applyConstruction,
  constructionRules,
  punch,
  reinforceZone,
  type ConstructionRules,
} from "../construction";
import { grainlineFor, makeEdge, notchAt, offsetConvexPath, polygonEdges } from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Edge, Marking, Pattern, PatternPiece } from "../types";
import { assertValidPattern } from "../validation";
import { coreWidthFor, rectPiece, rolledHandlePieces } from "./shared";

type TaperedToteConfiguration = ConfigurationFor<"tapered-tote">;

/** Leather handles are riveted: anchor zone and rivet position on each end. */
const ANCHOR = { width: 30, height: 40, rivetFromEdge: 15, rivetMm: 3 };

export function generateTaperedTotePattern(config: TaperedToteConfiguration): Pattern {
  const rules = constructionRules(config);
  const pattern: Pattern = {
    name: config.name,
    template: "tapered-tote",
    unit: "mm",
    configuration: config,
    pieces: [
      panel("front", "Front", config, rules),
      panel("back", "Back", config, rules),
      gusset(config, rules),
      ...[1, 2].flatMap((n) =>
        config.handleStyle === "rolled"
          ? rolledHandlePieces({
              id: `handle-${n}`,
              name: `Handle ${n}`,
              lengthMm: config.handleLengthMm,
              diameterMm: config.handleDiameterMm,
              coreWidthMm: coreWidthFor(config.handleDiameterMm),
              material: config.material,
              rules,
            })
          : [handle(`handle-${n}`, `Handle ${n}`, config, rules)],
      ),
    ],
  };
  assertValidPattern(pattern);
  return pattern;
}

function trapezoid(topWidth: number, bottomWidth: number, height: number) {
  const center = Math.max(topWidth, bottomWidth) / 2;
  return [
    { x: center - topWidth / 2, y: 0 },
    { x: center + topWidth / 2, y: 0 },
    { x: center + bottomWidth / 2, y: height },
    { x: center - bottomWidth / 2, y: height },
  ];
}

function sideLength(config: TaperedToteConfiguration): number {
  return Math.hypot(config.heightMm, (config.bottomWidthMm - config.topWidthMm) / 2);
}

function panel(
  id: "front" | "back",
  name: string,
  config: TaperedToteConfiguration,
  rules: ConstructionRules,
): PatternPiece {
  const sa = rules.seamAllowanceMm;
  const top = rules.allowanceFor("raw");
  const width = Math.max(config.topWidthMm, config.bottomWidthMm);
  const center = width / 2;
  const finished = trapezoid(config.topWidthMm, config.bottomWidthMm, config.heightMm);
  const bottomY = config.heightMm + sa;
  const anchors = [
    center - config.topWidthMm / 2 + config.handleInsetMm,
    center + config.topWidthMm / 2 - config.handleInsetMm,
  ];

  const markings: Marking[] = [
    notchAt(
      { x: center - config.bottomWidthMm / 2, y: bottomY },
      { x: 0, y: 1 },
      undefined,
      "gusset corner",
    ),
    notchAt({ x: center, y: bottomY }, { x: 0, y: 1 }, undefined, "bottom centre"),
    notchAt(
      { x: center + config.bottomWidthMm / 2, y: bottomY },
      { x: 0, y: 1 },
      undefined,
      "gusset corner",
    ),
    notchAt({ x: center, y: -top }, { x: 0, y: -1 }, undefined, "top centre"),
    ...anchors.map((x) => notchAt({ x, y: -top }, { x: 0, y: -1 }, undefined, "handle")),
  ];
  if (rules.leather) {
    for (const x of anchors) {
      markings.push(
        reinforceZone(x, 0, ANCHOR.width, ANCHOR.height, "reinforce handle anchor"),
        punch(x, ANCHOR.rivetFromEdge, ANCHOR.rivetMm, "handle rivet"),
      );
    }
  }

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
    cutPath: offsetConvexPath(finished, [top, sa, sa, sa]),
    stitchPaths: [{ points: finished, closed: true }],
    foldPaths: [],
    edges: polygonEdges(finished, [
      { id: "top", kind: "raw", allowanceMm: top },
      { id: "right", kind: "sew", seamId: `${id}-right`, allowanceMm: sa },
      { id: "bottom", kind: "sew", seamId: `${id}-bottom`, allowanceMm: sa },
      { id: "left", kind: "sew", seamId: `${id}-left`, allowanceMm: sa },
    ]),
    markings,
    grainline: grainlineFor(width, config.heightMm, "vertical"),
    notes: `trapezoid: top ${config.topWidthMm}, bottom ${config.bottomWidthMm}; handles attach between the top notches (inset ${config.handleInsetMm} mm)`,
  };
  return applyConstruction(piece, "body", rules);
}

/**
 * One strip runs up the left side, across the bottom, and up the right side.
 * Each long edge is split at the corner notches so every segment pairs with
 * one panel edge: the top edge sews to the front, the bottom edge to the back.
 */
function gusset(config: TaperedToteConfiguration, rules: ConstructionRules): PatternPiece {
  const sa = rules.seamAllowanceMm;
  const end = rules.allowanceFor("raw");
  const side = sideLength(config);
  const length = 2 * side + config.bottomWidthMm;
  const depth = config.depthMm;
  const cornerA = side;
  const cornerB = side + config.bottomWidthMm;

  const piece = rectPiece({
    id: "gusset",
    name: "Gusset",
    width: length,
    height: depth,
    material: config.material,
    component: "gusset",
    rules,
    edges: { top: { kind: "sew" }, bottom: { kind: "sew" } },
    grainline: "horizontal",
    notes: `runs up the left side (${side.toFixed(1)}), across the bottom (${config.bottomWidthMm}), up the right side (${side.toFixed(1)}); depth ${depth}`,
  });

  // Front segments run left to right along the top; back segments run right
  // to left along the bottom, keeping the outline clockwise.
  const sew = (id: string, x1: number, y: number, x2: number) =>
    makeEdge(id, { x: x1, y }, { x: x2, y }, "sew", id, sa);
  return {
    ...piece,
    edges: [
      makeEdge("end-left", { x: 0, y: depth }, { x: 0, y: 0 }, "raw", undefined, end),
      sew("front-left", 0, 0, cornerA),
      sew("front-bottom", cornerA, 0, cornerB),
      sew("front-right", cornerB, 0, length),
      makeEdge("end-right", { x: length, y: 0 }, { x: length, y: depth }, "raw", undefined, end),
      sew("back-right", length, depth, cornerB),
      sew("back-bottom", cornerB, depth, cornerA),
      sew("back-left", cornerA, depth, 0),
    ] satisfies Edge[],
    markings: [
      notchAt({ x: cornerA, y: -sa }, { x: 0, y: -1 }, undefined, "front corner"),
      notchAt({ x: cornerB, y: -sa }, { x: 0, y: -1 }, undefined, "front corner"),
      notchAt({ x: cornerA, y: depth + sa }, { x: 0, y: 1 }, undefined, "back corner"),
      notchAt({ x: cornerB, y: depth + sa }, { x: 0, y: 1 }, undefined, "back corner"),
      notchAt({ x: length / 2, y: depth + sa }, { x: 0, y: 1 }, undefined, "bottom centre"),
      // keep the skive zones applyConstruction added along both seams
      ...piece.markings,
    ],
  };
}

function handle(
  id: string,
  name: string,
  config: TaperedToteConfiguration,
  rules: ConstructionRules,
): PatternPiece {
  const length = config.handleLengthMm;
  const width = config.handleWidthMm;
  return rectPiece({
    id,
    name,
    width: length,
    height: width,
    material: config.material,
    component: "strap",
    rules,
    edges: {
      top: { kind: "fold" },
      right: { kind: "fold" },
      bottom: { kind: "fold" },
      left: { kind: "fold" },
    },
    grainline: "horizontal",
    line: "fold",
    extraNotches: rules.leather
      ? [
          punch(ANCHOR.rivetFromEdge, width / 2, ANCHOR.rivetMm, "handle rivet"),
          punch(length - ANCHOR.rivetFromEdge, width / 2, ANCHOR.rivetMm, "handle rivet"),
        ]
      : [],
    notes: rules.leather
      ? "single layer; rivet each end to the panel at the handle notches"
      : "fold all four edges under at the lines; raw edges meet at the back",
  });
}
