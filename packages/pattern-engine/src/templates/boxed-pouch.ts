import { applyConstruction, constructionRules } from "../construction";
import { grainlineFor, notchAt, polygonEdges } from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Pattern, PatternPiece, Point } from "../types";
import { assertValidPattern } from "../validation";

type BoxedPouchConfiguration = ConfigurationFor<"boxed-pouch">;

export function generateBoxedPouchPattern(config: BoxedPouchConfiguration): Pattern {
  const pattern: Pattern = {
    name: config.name,
    template: "boxed-pouch",
    unit: "mm",
    configuration: config,
    pieces: [panel("front", "Front", config), panel("back", "Back", config)],
  };
  assertValidPattern(pattern);
  return pattern;
}

/**
 * One panel covers the face, half of each side, and half of the base. On the
 * sewing line that is (width + depth) x (height + depth/2), less a depth/2
 * square at each bottom corner. Offsetting by the seam allowance keeps the
 * cut-out square at depth/2 from the raw corner.
 *
 * Each corner's horizontal and vertical notch edges are sewn to each other
 * when the corner is pinched flat, so they share a seam id.
 */
function panel(id: "front" | "back", name: string, config: BoxedPouchConfiguration): PatternPiece {
  const rules = constructionRules(config);
  const sa = rules.seamAllowanceMm;
  const top = rules.allowanceFor("raw");
  const box = config.depthMm / 2;
  const width = config.widthMm + config.depthMm;
  const height = config.heightMm + box;
  const sideHeight = config.heightMm;

  const stitch: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: sideHeight },
    { x: width - box, y: sideHeight },
    { x: width - box, y: height },
    { x: box, y: height },
    { x: box, y: sideHeight },
    { x: 0, y: sideHeight },
  ];
  const cut: Point[] = [
    { x: -sa, y: -top },
    { x: width + sa, y: -top },
    { x: width + sa, y: sideHeight + sa },
    { x: width - box + sa, y: sideHeight + sa },
    { x: width - box + sa, y: height + sa },
    { x: box - sa, y: height + sa },
    { x: box - sa, y: sideHeight + sa },
    { x: -sa, y: sideHeight + sa },
  ];

  const piece: PatternPiece = {
    id,
    name,
    quantity: 1,
    material: config.material,
    finishedSize: { width, height },
    seamAllowance: { amountMm: sa },
    component: "body",
    thicknessMm: null,
    edgeFinish: null,
    cutPath: cut,
    stitchPaths: [{ points: stitch, closed: true }],
    foldPaths: [],
    edges: polygonEdges(stitch, [
      { id: "top", kind: "raw", allowanceMm: top },
      { id: "right", kind: "sew", seamId: "right", allowanceMm: sa },
      { id: "box-right-top", kind: "sew", seamId: `${id}-box-right`, allowanceMm: sa },
      { id: "box-right-side", kind: "sew", seamId: `${id}-box-right`, allowanceMm: sa },
      { id: "bottom", kind: "sew", seamId: "bottom", allowanceMm: sa },
      { id: "box-left-side", kind: "sew", seamId: `${id}-box-left`, allowanceMm: sa },
      { id: "box-left-top", kind: "sew", seamId: `${id}-box-left`, allowanceMm: sa },
      { id: "left", kind: "sew", seamId: "left", allowanceMm: sa },
    ]),
    markings: [
      notchAt({ x: width / 2, y: -top }, { x: 0, y: -1 }, undefined, "opening centre"),
      notchAt({ x: width / 2, y: height + sa }, { x: 0, y: 1 }, undefined, "bottom"),
      notchAt({ x: -sa, y: sideHeight / 2 }, { x: -1, y: 0 }, undefined, "left"),
      notchAt({ x: width + sa, y: sideHeight / 2 }, { x: 1, y: 0 }, undefined, "right"),
    ],
    grainline: grainlineFor(width, height, "vertical"),
    notes: `cut ${box} x ${box} squares from the bottom corners; sew sides and bottom, then pinch each corner so the side seam meets the bottom seam and sew across at ${sa} mm (finished depth ${config.depthMm})`,
  };
  return applyConstruction(piece, "body", rules);
}
