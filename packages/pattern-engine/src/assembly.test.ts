import { describe, expect, it } from "vitest";
import {
  assemble,
  defaultConfiguration,
  framePolygon,
  generatePattern,
  TEMPLATE_IDS,
  validateAssembly,
} from "./index";

describe("assemble", () => {
  it.each(TEMPLATE_IDS)("%s seams coincide in 3D", (template) => {
    const config = {
      ...defaultConfiguration(template),
      interiorPocket: true,
      exteriorPocket: true,
    };
    const pattern = generatePattern(config);
    const assembly = assemble(pattern);
    expect(assembly).not.toBeNull();
    expect(assembly!.frames.length).toBeGreaterThan(1);
    expect(validateAssembly(pattern, assembly!)).toEqual([]);
  });

  it("draws the finished size, not the seam allowance", () => {
    const pattern = generatePattern(defaultConfiguration("tote"));
    const frame = assemble(pattern)!.frames.find((f) => f.pieceId === "front")!;
    const xs = framePolygon(
      pattern.pieces.find((p) => p.id === "front")!,
      frame,
    ).map((p) => p.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(300);
  });
});
