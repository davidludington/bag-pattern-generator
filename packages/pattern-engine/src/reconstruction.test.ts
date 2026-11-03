import { describe, expect, it } from "vitest";
import {
  bagConfigurationSchema,
  generatePattern,
  observationToConfiguration,
  validatePattern,
  type BagObservation,
} from "./index";

function observation(overrides: Partial<BagObservation> = {}): BagObservation {
  return {
    template: "tote",
    confidence: "high",
    proportions: { width: 4, height: 3.5, depth: 1.2 },
    bottomToTopWidth: null,
    strapDropToHeight: 1.8,
    material: "canvas",
    exteriorPocket: true,
    closure: "open",
    visiblePanels: ["front", "gusset"],
    notes: [],
    ...overrides,
  };
}

describe("observationToConfiguration", () => {
  it("scales proportions from one real measurement", () => {
    const { configuration } = observationToConfiguration(observation(), {
      axis: "width",
      valueMm: 400,
    });
    expect(configuration).toMatchObject({
      template: "tote",
      widthMm: 400,
      heightMm: 350,
      depthMm: 120,
      strapLengthMm: 630,
      exteriorPocket: true,
      interiorPocket: false,
      material: "canvas",
    });
  });

  it("scales from height or depth just as well", () => {
    const fromHeight = observationToConfiguration(observation(), { axis: "height", valueMm: 350 });
    const fromDepth = observationToConfiguration(observation(), { axis: "depth", valueMm: 120 });
    expect(fromHeight.configuration).toMatchObject({ widthMm: 400, depthMm: 120 });
    expect(fromDepth.configuration).toMatchObject({ widthMm: 400, heightMm: 350 });
  });

  it("always returns a configuration the engine accepts", () => {
    const { configuration } = observationToConfiguration(observation(), {
      axis: "width",
      valueMm: 400,
    });
    expect(bagConfigurationSchema.safeParse(configuration).success).toBe(true);
    expect(validatePattern(generatePattern(configuration))).toEqual([]);
  });

  it("reports what it assumed", () => {
    const { assumptions } = observationToConfiguration(
      observation({ material: null, confidence: "low" }),
      { axis: "width", valueMm: 400 },
    );
    expect(assumptions.join("\n")).toMatch(/Material defaults to canvas/);
    expect(assumptions.join("\n")).toMatch(/Interior pocket is off/);
    expect(assumptions.join("\n")).toMatch(/low confidence/);
  });

  it("clamps out-of-range values and says so", () => {
    const { configuration, assumptions } = observationToConfiguration(
      observation({ proportions: { width: 10, height: 1, depth: 0.1 } }),
      { axis: "width", valueMm: 500 },
    );
    expect(configuration).toMatchObject({ widthMm: 500, heightMm: 100, depthMm: 20 });
    expect(assumptions.some((line) => line.startsWith("Height was 50 mm"))).toBe(true);
  });

  it("applies a taper to the tapered tote", () => {
    const { configuration } = observationToConfiguration(
      observation({ template: "tapered-tote", bottomToTopWidth: 0.75 }),
      { axis: "width", valueMm: 400 },
    );
    expect(configuration).toMatchObject({ topWidthMm: 400, bottomWidthMm: 300 });
  });

  it("shrinks insets that no longer fit a small bag, keeping the measured size", () => {
    // default handle inset 60 mm cannot fit a 100 mm top width
    const { configuration, assumptions } = observationToConfiguration(
      observation({ template: "tapered-tote", proportions: { width: 1, height: 1, depth: 0.5 } }),
      { axis: "width", valueMm: 100 },
    );
    expect(configuration).toMatchObject({ topWidthMm: 100, heightMm: 100, handleInsetMm: 30 });
    expect(assumptions.some((line) => line.includes("Reduced handleInsetMm"))).toBe(true);
  });

  it("falls back to defaults when the reference axis is missing", () => {
    const { configuration, assumptions } = observationToConfiguration(
      observation({ proportions: { width: 4, height: 3, depth: 0 } }),
      { axis: "depth", valueMm: 100 },
    );
    expect(configuration).toMatchObject({ widthMm: 300, heightMm: 250 });
    expect(assumptions[0]).toMatch(/no usable depth/);
  });
});
