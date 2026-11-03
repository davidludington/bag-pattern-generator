import { constructionRules } from "../construction";
import { notchAt } from "../geometry";
import type { ConfigurationFor } from "../schema";
import type { Marking, Pattern, PatternPiece } from "../types";
import { assertValidPattern } from "../validation";
import { rectPiece } from "./shared";

type ZipPouchConfiguration = ConfigurationFor<"zip-pouch">;

export function generateZipPouchPattern(config: ZipPouchConfiguration): Pattern {
  const pattern: Pattern = {
    name: config.name,
    template: "zip-pouch",
    unit: "mm",
    configuration: config,
    pieces: [panel("front", "Front", config), panel("back", "Back", config)],
  };
  assertValidPattern(pattern);
  return pattern;
}

function panel(id: string, name: string, config: ZipPouchConfiguration): PatternPiece {
  const rules = constructionRules(config);
  // zipper edge: hem/turn allowance on fabric, finished edge on painted leather
  const top = rules.allowanceFor("raw");
  const width = config.widthMm;
  const height = config.heightMm;
  const opening = width - 2 * config.zipperMarginMm;

  const zipperNotches: Marking[] = [
    notchAt({ x: width / 2, y: -top }, { x: 0, y: -1 }, undefined, "zipper centre"),
  ];
  if (config.zipperMarginMm > 0) {
    zipperNotches.push(
      notchAt({ x: config.zipperMarginMm, y: -top }, { x: 0, y: -1 }, undefined, "zipper end"),
      notchAt(
        { x: width - config.zipperMarginMm, y: -top },
        { x: 0, y: -1 },
        undefined,
        "zipper end",
      ),
    );
  }

  return rectPiece({
    id,
    name,
    width,
    height,
    material: config.material,
    rules,
    component: "body",
    edges: {
      top: { kind: "raw" },
      right: { kind: "sew", seamId: "right" },
      bottom: { kind: "sew", seamId: "bottom" },
      left: { kind: "sew", seamId: "left" },
    },
    grainline: "vertical",
    extraNotches: zipperNotches,
    notes: rules.leather
      ? `zipper along the top edge: opening ${opening} mm; the finished leather edge sits beside the teeth (about 4 mm each side for a #5 zip), stitched through the tape`
      : `zipper along the top edge: opening ${opening} mm (zipper about ${width} mm); join front to back at the side and bottom seams`,
  });
}
