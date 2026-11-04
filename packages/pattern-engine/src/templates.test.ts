import { describe, expect, it } from "vitest";
import {
  bagConfigurationSchema,
  boundsOf,
  defaultConfiguration,
  generateBirkinPattern,
  generateBoxedPouchPattern,
  generateDrawstringPattern,
  generatePattern,
  generateTaperedTotePattern,
  generateZipPouchPattern,
  layoutPieces,
  TEMPLATE_IDS,
  validatePattern,
  type BirkinConfiguration,
  type BoxedPouchConfiguration,
  type DrawstringConfiguration,
  type Pattern,
  type PatternPiece,
  type TaperedToteConfiguration,
  type ZipPouchConfiguration,
} from "./index";

function piece(pattern: Pattern, id: string): PatternPiece {
  const found = pattern.pieces.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing piece ${id}`);
  return found;
}

function cutSize(patternPiece: PatternPiece): { width: number; height: number } {
  const bounds = boundsOf(patternPiece.cutPath);
  return { width: bounds.width, height: bounds.height };
}

function expectNoOverlap(pattern: Pattern): void {
  const layout = layoutPieces(pattern.pieces);
  const boxes = layout.placements.map((placement) => ({
    minX: placement.x,
    minY: placement.y,
    maxX: placement.x + placement.width,
    maxY: placement.y + placement.height,
  }));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      expect(a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY).toBe(false);
    }
  }
}

function zipConfig(overrides: Partial<ZipPouchConfiguration> = {}): ZipPouchConfiguration {
  return { ...defaultConfiguration("zip-pouch"), ...overrides };
}

function boxedConfig(overrides: Partial<BoxedPouchConfiguration> = {}): BoxedPouchConfiguration {
  return { ...defaultConfiguration("boxed-pouch"), ...overrides };
}

function taperedConfig(
  overrides: Partial<TaperedToteConfiguration> = {},
): TaperedToteConfiguration {
  return { ...defaultConfiguration("tapered-tote"), ...overrides };
}

function drawstringConfig(
  overrides: Partial<DrawstringConfiguration> = {},
): DrawstringConfiguration {
  return { ...defaultConfiguration("drawstring"), ...overrides };
}

function birkinConfig(overrides: Partial<BirkinConfiguration> = {}): BirkinConfiguration {
  return { ...defaultConfiguration("birkin"), ...overrides };
}

describe("zip pouch", () => {
  it("builds two panels with a top zipper opening", () => {
    const pattern = generateZipPouchPattern(zipConfig());
    expect(pattern.pieces.map((p) => p.id)).toEqual(["front", "back"]);
    const front = piece(pattern, "front");
    expect(front.finishedSize).toEqual({ width: 200, height: 150 });
    expect(cutSize(front)).toEqual({ width: 220, height: 170 });
    expect(front.stitchPaths[0]?.closed).toBe(true);
    // zipper centre + one centre notch per seamed side
    expect(front.markings.map((m) => m.label)).toEqual([
      "right",
      "bottom",
      "left",
      "zipper centre",
    ]);
    expect(validatePattern(pattern)).toEqual([]);
    expectNoOverlap(pattern);
  });

  it("adds zipper end notches when the zipper is inset", () => {
    const front = piece(generateZipPouchPattern(zipConfig({ zipperMarginMm: 20 })), "front");
    expect(front.markings.filter((m) => m.label === "zipper end")).toHaveLength(2);
  });

  it("rejects an inset that consumes the whole width", () => {
    expect(bagConfigurationSchema.safeParse(zipConfig({ zipperMarginMm: 100 })).success).toBe(
      false,
    );
  });
});

describe("boxed pouch", () => {
  it("sews (width + depth) x (height + depth/2) and cuts depth/2 corner squares", () => {
    const pattern = generateBoxedPouchPattern(boxedConfig());
    const front = piece(pattern, "front");
    // width 200 + depth 80; height 120 + depth/2 40
    expect(front.finishedSize).toEqual({ width: 280, height: 160 });
    // raw panel: w + depth + 2sa  x  h + depth/2 + 2sa (opening and bottom)
    expect(cutSize(front)).toEqual({ width: 300, height: 180 });
    const cut = front.cutPath;
    const rawRight = Math.max(...cut.map((p) => p.x));
    const rawBottom = Math.max(...cut.map((p) => p.y));
    // the corner square measured from the raw corner is depth / 2
    expect(cut).toContainEqual({ x: rawRight - 40, y: rawBottom });
    expect(cut).toContainEqual({ x: rawRight, y: rawBottom - 40 });
    expect(front.stitchPaths[0]?.points).toHaveLength(8);
    expect(validatePattern(pattern)).toEqual([]);
    expectNoOverlap(pattern);
  });

  it("pairs each pinched corner's two edges at depth / 2", () => {
    const front = piece(generateBoxedPouchPattern(boxedConfig({ depthMm: 60 })), "front");
    const corner = front.edges.filter((edge) => edge.seamId === "front-box-left");
    expect(corner.map((edge) => edge.length)).toEqual([30, 30]);
  });

  it("rejects a depth below the minimum", () => {
    expect(bagConfigurationSchema.safeParse(boxedConfig({ depthMm: 5 })).success).toBe(false);
  });
});

describe("tapered tote", () => {
  it("builds trapezoid panels, one continuous gusset, and two handles", () => {
    const pattern = generateTaperedTotePattern(taperedConfig());
    expect(pattern.pieces.map((p) => p.id)).toEqual([
      "front",
      "back",
      "gusset",
      "handle-1",
      "handle-2",
    ]);
    expect(piece(pattern, "front").finishedSize).toEqual({
      width: 340,
      height: 250,
    });
    expect(piece(pattern, "gusset").finishedSize.width).toBeCloseTo(
      2 * Math.hypot(250, 40) + 260,
      5,
    );
    expect(piece(pattern, "handle-1").foldPaths).toHaveLength(1);
    expect(validatePattern(pattern)).toEqual([]);
    expectNoOverlap(pattern);
  });

  it("rejects a handle inset that crosses the centre", () => {
    expect(bagConfigurationSchema.safeParse(taperedConfig({ handleInsetMm: 200 })).success).toBe(
      false,
    );
  });
});

describe("drawstring", () => {
  it("adds the folded casing to the cut height and emits open lines", () => {
    const pattern = generateDrawstringPattern(drawstringConfig());
    const front = piece(pattern, "front");
    expect(front.finishedSize).toEqual({ width: 200, height: 250 });
    expect(cutSize(front)).toEqual({ width: 220, height: 295 });
    expect(front.stitchPaths[0]?.points[0]?.y).toBe(50);
    // the side and bottom seams are drawn too, not only the casing line
    expect(front.stitchPaths[1]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 275 },
      { x: 200, y: 275 },
      { x: 200, y: 0 },
    ]);
    expect(front.foldPaths[0]?.points[0]?.y).toBe(25);
    expect(validatePattern(pattern)).toEqual([]);
    expectNoOverlap(pattern);
  });

  it("rejects a casing deeper than the bag", () => {
    expect(bagConfigurationSchema.safeParse(drawstringConfig({ casingMm: 250 })).success).toBe(
      false,
    );
  });
});

describe("birkin", () => {
  it("builds the five-panel body, flap, and rolled handles (fabric)", () => {
    const pattern = generateBirkinPattern(
      birkinConfig({ material: "canvas", seamAllowanceMm: 10 }),
    );
    expect(pattern.pieces).toHaveLength(10);
    const flap = piece(pattern, "flap");
    expect(flap.finishedSize).toEqual({ width: 300, height: 280 });
    expect(cutSize(flap)).toEqual({ width: 320, height: 300 });
    expect(flap.cutPath.length).toBeGreaterThan(4);
    const wrap = piece(pattern, "handle-1-wrap");
    expect(wrap.finishedSize.height).toBeCloseTo(Math.PI * 20, 5);
    // both long edges are sewn to each other, so each gets a full allowance
    expect(cutSize(wrap).height).toBeCloseTo(Math.PI * 20 + 20, 5);
    const core = piece(pattern, "handle-1-core");
    expect(core.seamAllowance.amountMm).toBe(0);
    expect(cutSize(core)).toEqual({ width: 320, height: 18 });
    expect(validatePattern(pattern)).toEqual([]);
    expectNoOverlap(pattern);
  });

  it("rejects a radius that does not fit", () => {
    expect(bagConfigurationSchema.safeParse(birkinConfig({ flapRadiusMm: 200 })).success).toBe(
      false,
    );
  });

  it("rejects a flap that hangs below the bag", () => {
    const result = bagConfigurationSchema.safeParse(
      birkinConfig({ heightMm: 200, flapHeightMm: 300 }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["flapHeightMm"]);
  });
});

describe("template registry", () => {
  it("generates every default template", () => {
    for (const template of TEMPLATE_IDS) {
      const configuration = defaultConfiguration(template);
      expect(bagConfigurationSchema.safeParse(configuration).success).toBe(true);
      const pattern = generatePattern(configuration);
      expect(pattern.template).toBe(template);
      expect(pattern.pieces.length).toBeGreaterThan(0);
      expect(validatePattern(pattern)).toEqual([]);
    }
  });
});
