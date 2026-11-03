import { describe, expect, it } from "vitest";
import {
  bagConfigurationSchema,
  boundsOf,
  constructionRules,
  defaultConfiguration,
  generatePattern,
  validatePattern,
  withField,
  wrapAllowance,
  type BagConfiguration,
  type Pattern,
  type PatternPiece,
} from "./index";

function piece(pattern: Pattern, id: string): PatternPiece {
  const found = pattern.pieces.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing piece ${id}`);
  return found;
}

const cutSize = (p: PatternPiece) => {
  const b = boundsOf(p.cutPath);
  return { width: b.width, height: b.height };
};

function leatherTote(
  overrides: Partial<Record<string, number | string | boolean>> = {},
): BagConfiguration {
  let configuration: BagConfiguration = withField(
    defaultConfiguration("tote"),
    "material",
    "leather",
  );
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) configuration = withField(configuration, key, value);
  }
  return configuration;
}

describe("construction rules", () => {
  it("leave fabric unchanged: every edge carries the seam allowance", () => {
    const rules = constructionRules(defaultConfiguration("tote"));
    expect(rules.leather).toBe(false);
    expect(rules.allowanceFor("sew")).toBe(10);
    expect(rules.allowanceFor("raw")).toBe(10);
    expect(rules.thicknessOf("body")).toBeNull();
  });

  it("cut painted, burnished, and raw leather edges on the finished line", () => {
    for (const edgeFinish of ["painted", "burnished", "raw"]) {
      const rules = constructionRules(leatherTote({ edgeFinish }));
      expect(rules.allowanceFor("raw")).toBe(0);
      expect(rules.allowanceFor("fold")).toBe(0);
      expect(rules.allowanceFor("sew")).toBe(10);
    }
  });

  it("give folded leather edges the turn-in", () => {
    const rules = constructionRules(leatherTote({ edgeFinish: "folded", turnInMm: 12 }));
    expect(rules.allowanceFor("raw")).toBe(12);
  });

  it("assign thickness per component", () => {
    const rules = constructionRules(leatherTote());
    expect(rules.thicknessOf("body")).toBe(1.1);
    expect(rules.thicknessOf("base")).toBe(1.6);
    expect(rules.thicknessOf("gusset")).toBe(0.9);
    expect(rules.thicknessOf("strap")).toBe(2.2);
    expect(rules.thicknessOf("filler")).toBeNull();
  });

  it("compute the wrap allowance as (π/2) × stack", () => {
    expect(wrapAllowance(2)).toBeCloseTo(Math.PI, 10);
  });
});

describe("leather tote", () => {
  const pattern = generatePattern(leatherTote());

  it("cuts the painted opening on the finished line and seams with allowance", () => {
    // 300 x 250: sides and bottom +10 each, opening +0
    expect(cutSize(piece(pattern, "front"))).toEqual({ width: 320, height: 260 });
    expect(boundsOf(piece(pattern, "front").cutPath).minY).toBeCloseTo(0, 10);
  });

  it("cuts painted straps to their finished size with no fold lines", () => {
    const strap = piece(pattern, "strap");
    expect(cutSize(strap)).toEqual({ width: 600, height: 30 });
    expect(strap.foldPaths).toEqual([]);
  });

  it("records thickness and edge finish on every piece", () => {
    expect(piece(pattern, "front")).toMatchObject({
      component: "body",
      thicknessMm: 1.1,
      edgeFinish: "painted",
    });
    expect(piece(pattern, "bottom")).toMatchObject({ component: "base", thicknessMm: 1.6 });
    expect(piece(pattern, "gusset-left")).toMatchObject({ component: "gusset", thicknessMm: 0.9 });
    expect(piece(pattern, "strap")).toMatchObject({ component: "strap", thicknessMm: 2.2 });
    expect(piece(pattern, "front").notes).toMatch(/1\.1 mm leather; paint exposed edges/);
  });

  it("marks a skive zone over each seam allowance", () => {
    const front = piece(pattern, "front");
    const skives = front.markings.filter((m) => m.kind === "zone" && m.zone === "skive");
    // right, bottom, left seams; the painted opening is not skived
    expect(skives).toHaveLength(3);
    const bottom = skives.find((m) => m.kind === "zone" && m.points.every((p) => p.y >= 250));
    expect(bottom && bottom.kind === "zone" && boundsOf(bottom.points)).toMatchObject({
      minY: 250,
      maxY: 260,
      width: 300,
    });
  });

  it("adds a turn-in and a skived turn band on folded edges", () => {
    const folded = generatePattern(
      leatherTote({ edgeFinish: "folded", turnInMm: 10, skiveWidthMm: 15 }),
    );
    const front = piece(folded, "front");
    expect(cutSize(front)).toEqual({ width: 320, height: 270 });
    const turn = front.markings.find(
      (m) => m.kind === "zone" && m.label.startsWith("skive turned edge"),
    );
    // from the cut line (-10) to 5 mm inside the finished edge
    expect(turn && turn.kind === "zone" && boundsOf(turn.points)).toMatchObject({
      minY: -10,
      maxY: 5,
    });
    expect(piece(folded, "strap").foldPaths).toHaveLength(1);
  });

  it("does not add leather markings to fabric", () => {
    const fabric = generatePattern(defaultConfiguration("tote"));
    for (const p of fabric.pieces) {
      expect(
        p.markings.every((m) => m.kind === "notch"),
        p.id,
      ).toBe(true);
      expect(p.thicknessMm).toBeNull();
    }
  });
});

describe("leather birkin", () => {
  const configuration = defaultConfiguration("birkin");
  const pattern = generatePattern(configuration);
  const stack = configuration.leatherBodyMm * 2; // flap + front panel

  it("lengthens the flap by the wrap allowance at the front fold", () => {
    const flap = piece(pattern, "flap");
    expect(flap.finishedSize.height).toBeCloseTo(140 + 140 + wrapAllowance(stack), 6);
    expect(flap.notes).toMatch(/wrap allowance/);
  });

  it("measures the handle wrap at the leather's mid-thickness", () => {
    const wrap = piece(pattern, "handle-1-wrap");
    expect(wrap.finishedSize.height).toBeCloseTo(Math.PI * (20 - configuration.leatherStrapMm), 6);
  });

  it("marks hardware and reinforcement", () => {
    const labels = (id: string) =>
      piece(pattern, id)
        .markings.filter((m) => m.kind !== "notch")
        .map((m) => m.label);
    expect(labels("front")).toEqual(
      expect.arrayContaining(["handle rivet", "reinforce handle anchor", "reinforce turn-lock"]),
    );
    expect(labels("back")).toEqual(expect.arrayContaining(["reinforce sangle anchor"]));
    expect(labels("flap")).toEqual(
      expect.arrayContaining(["turn-lock hole", "reinforce flap fold"]),
    );
    expect(labels("strap-1")).toContain("turn-lock slot");
  });

  it("still validates", () => {
    expect(validatePattern(pattern)).toEqual([]);
  });
});

describe("leather tapered tote", () => {
  it("rivets the handles to reinforced anchors", () => {
    const pattern = generatePattern(
      withField(defaultConfiguration("tapered-tote"), "material", "leather"),
    );
    const punches = piece(pattern, "front").markings.filter((m) => m.kind === "punch");
    expect(punches).toHaveLength(2);
    expect(piece(pattern, "handle-1").markings.filter((m) => m.kind === "punch")).toHaveLength(2);
  });
});

describe("leather drawstring", () => {
  it("adds the fold's wrap allowance above the casing fold line", () => {
    const configuration = withField(defaultConfiguration("drawstring"), "material", "leather");
    const front = piece(generatePattern(configuration), "front");
    const extra = wrapAllowance(1.1);
    expect(front.foldPaths[0]?.points[0]?.y).toBeCloseTo(25 + extra, 6);
    expect(front.stitchPaths[0]?.points[0]?.y).toBeCloseTo(50 + extra, 6);
  });
});

describe("leather validation", () => {
  it("rejects a skive target thicker than the thinnest leather", () => {
    expect(bagConfigurationSchema.safeParse(leatherTote({ skiveToMm: 0.9 })).success).toBe(false);
    expect(bagConfigurationSchema.safeParse(leatherTote({ skiveToMm: 0.6 })).success).toBe(true);
  });

  it("requires a folded turn-in of at least twice the body thickness", () => {
    const thick = { edgeFinish: "folded", leatherBodyMm: 3, leatherBaseMm: 3, turnInMm: 5 };
    expect(bagConfigurationSchema.safeParse(leatherTote(thick)).success).toBe(false);
  });

  it("ignores leather fields for fabric", () => {
    const canvas = withField(defaultConfiguration("tote"), "skiveToMm", 1.9);
    expect(bagConfigurationSchema.safeParse(canvas).success).toBe(true);
  });
});
