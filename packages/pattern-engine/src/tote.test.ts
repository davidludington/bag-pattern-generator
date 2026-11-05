import { describe, expect, it } from "vitest";
import {
  bagConfigurationSchema,
  boundsOf,
  defaultToteConfiguration,
  generateTotePattern,
  layoutPieces,
  validatePattern,
} from "./index";
import type { Pattern, PatternPiece, ToteConfiguration } from "./index";

function piece(pattern: Pattern, id: string): PatternPiece {
  const found = pattern.pieces.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing piece ${id}`);
  return found;
}

function cutSize(patternPiece: PatternPiece): { width: number; height: number } {
  const bounds = boundsOf(patternPiece.cutPath);
  return { width: bounds.width, height: bounds.height };
}

function config(overrides: Partial<ToteConfiguration> = {}): ToteConfiguration {
  return { ...defaultToteConfiguration(), ...overrides };
}

describe("generateTotePattern", () => {
  it("generates the required piece set and quantities", () => {
    const pattern = generateTotePattern(config());
    expect(pattern.template).toBe("tote");
    expect(pattern.unit).toBe("mm");
    expect(pattern.pieces.map((p) => p.id)).toEqual([
      "front",
      "back",
      "bottom",
      "gusset-left",
      "gusset-right",
      "strap",
    ]);
    expect(piece(pattern, "strap").quantity).toBe(2);
    expect(piece(pattern, "front").quantity).toBe(1);
  });

  it("uses finished dimensions for sewing and adds seam allowance to cutting", () => {
    const pattern = generateTotePattern(config({ seamAllowanceMm: 10 }));
    const front = piece(pattern, "front");
    expect(front.finishedSize).toEqual({ width: 300, height: 250 });
    expect(cutSize(front)).toEqual({ width: 320, height: 270 });
    expect(front.seamAllowance.amountMm).toBe(10);

    const bottom = piece(pattern, "bottom");
    expect(bottom.finishedSize).toEqual({ width: 300, height: 100 });
    expect(cutSize(bottom)).toEqual({ width: 320, height: 120 });

    const gusset = piece(pattern, "gusset-left");
    expect(gusset.finishedSize).toEqual({ width: 100, height: 250 });
    expect(cutSize(gusset)).toEqual({ width: 120, height: 270 });
  });

  it("does not add allowance when seam allowance is zero", () => {
    const pattern = generateTotePattern(config({ seamAllowanceMm: 0 }));
    for (const p of pattern.pieces) {
      expect(cutSize(p)).toEqual(p.finishedSize);
    }
  });

  it("regenerates dimensions when bag dimensions change", () => {
    const pattern = generateTotePattern(
      config({ widthMm: 420, heightMm: 320, depthMm: 140, seamAllowanceMm: 0 }),
    );
    expect(piece(pattern, "front").finishedSize).toEqual({ width: 420, height: 320 });
    expect(piece(pattern, "bottom").finishedSize).toEqual({ width: 420, height: 140 });
    expect(piece(pattern, "gusset-right").finishedSize).toEqual({
      width: 140,
      height: 320,
    });
    expect(piece(pattern, "strap").finishedSize).toEqual({ width: 600, height: 30 });
  });

  it("adds pocket pieces only when enabled", () => {
    const withoutPockets = generateTotePattern(config());
    expect(withoutPockets.pieces.some((p) => p.id.includes("pocket"))).toBe(false);

    const withPockets = generateTotePattern(config({ interiorPocket: true, exteriorPocket: true }));
    expect(withPockets.pieces.map((p) => p.id)).toContain("interior-pocket");
    expect(withPockets.pieces.map((p) => p.id)).toContain("exterior-pocket");
  });

  it("propagates material to every piece", () => {
    const pattern = generateTotePattern(config({ material: "leather" }));
    expect(pattern.pieces.every((p) => p.material === "leather")).toBe(true);
  });

  it("keeps every seam pair compatible", () => {
    const pattern = generateTotePattern(config({ interiorPocket: true, exteriorPocket: true }));
    expect(validatePattern(pattern)).toEqual([]);
  });

  it("lays pieces out without overlapping", () => {
    const pattern = generateTotePattern(config({ interiorPocket: true }));
    const layout = layoutPieces(pattern.pieces);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);

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
        const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe("bagConfigurationSchema", () => {
  it("accepts the default configuration", () => {
    expect(bagConfigurationSchema.safeParse(defaultToteConfiguration()).success).toBe(true);
  });

  it("rejects invalid dimensions and unknown keys", () => {
    expect(bagConfigurationSchema.safeParse(config({ widthMm: 10 })).success).toBe(false);
    expect(bagConfigurationSchema.safeParse(config({ seamAllowanceMm: -1 })).success).toBe(false);
    expect(
      bagConfigurationSchema.safeParse({
        ...defaultToteConfiguration(),
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("marks strap anchors at the inset and rejects an inset past the centre", () => {
    const front = piece(generateTotePattern(config({ strapInsetMm: 80 })), "front");
    const xs = front.markings.flatMap((m) =>
      m.kind === "notch" && m.label === "strap" ? [Math.round(m.at.x)] : [],
    );
    expect(xs).toEqual([80, 220]);
    expect(bagConfigurationSchema.safeParse(config({ strapInsetMm: 150 })).success).toBe(false);
  });

  it("builds rolled handles as a wrap and a core instead of a flat strap", () => {
    const pattern = generateTotePattern(config({ handleStyle: "rolled", handleDiameterMm: 20 }));
    expect(pattern.pieces.map((p) => p.id)).toEqual(
      expect.arrayContaining(["handle-1-wrap", "handle-1-core", "handle-2-wrap", "handle-2-core"]),
    );
    expect(pattern.pieces.some((p) => p.id === "strap")).toBe(false);
    expect(piece(pattern, "handle-1-wrap").finishedSize.height).toBeCloseTo(Math.PI * 20, 5);
    expect(validatePattern(pattern)).toEqual([]);
  });
});
