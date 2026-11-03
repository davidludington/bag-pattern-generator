import { describe, expect, it } from "vitest";
import {
  bagConfigurationSchema,
  boundsOf,
  defaultConfiguration,
  generatePattern,
  layoutPieces,
  LEATHER_SECTIONS,
  readField,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_IDS,
  validatePattern,
  withField,
  type BagConfiguration,
  edgeNormal,
  type Edge,
  type Marking,
  type Pattern,
  type Point,
} from "./index";

function seamGroups(pattern: Pattern): Map<string, Edge[]> {
  const groups = new Map<string, Edge[]>();
  for (const piece of pattern.pieces) {
    for (const edge of piece.edges) {
      if (!edge.seamId) continue;
      groups.set(edge.seamId, [...(groups.get(edge.seamId) ?? []), edge]);
    }
  }
  return groups;
}

/** Defaults with every bounded number scaled, clamped back into its range. */
function scaled(template: (typeof TEMPLATE_IDS)[number], factor: number): BagConfiguration {
  let configuration: BagConfiguration = defaultConfiguration(template);
  for (const section of TEMPLATE_DEFINITIONS[template].sections) {
    for (const field of section.fields) {
      if (field.kind !== "number") continue;
      const value = Number(readField(configuration, field.key));
      const next = Math.min(field.maxMm, Math.max(field.minMm, value * factor));
      configuration = withField(configuration, field.key, next);
    }
  }
  return configuration;
}

/** Distance from a point to the nearest segment of a closed polygon. */
function distanceToOutline(p: Point, outline: Point[]): number {
  let best = Infinity;
  outline.forEach((a, index) => {
    const b = outline[(index + 1) % outline.length] ?? a;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  });
  return best;
}

function markingPoints(marking: Marking): Point[] {
  return marking.kind === "zone" ? marking.points : [marking.at];
}

const MATERIAL_CASES = ["canvas", "leather"] as const;

describe.each(
  TEMPLATE_IDS.flatMap((template) =>
    MATERIAL_CASES.map((material) => [template, material] as const),
  ),
)("%s in %s", (template, material) => {
  const configuration = withField(defaultConfiguration(template), "material", material);
  const pattern = generatePattern(configuration);

  it("labels its seams, and every seam joins two equal-length edges", () => {
    const groups = seamGroups(pattern);
    expect(groups.size).toBeGreaterThan(0);
    for (const [seamId, edges] of groups) {
      expect(edges, seamId).toHaveLength(2);
      const [a, b] = edges;
      expect(a?.length, seamId).toBeCloseTo(b?.length ?? NaN, 6);
    }
  });

  it("keeps seams compatible when dimensions change", () => {
    for (const factor of [0.7, 1.3]) {
      const scaledConfiguration = withField(scaled(template, factor), "material", material);
      if (!bagConfigurationSchema.safeParse(scaledConfiguration).success) continue;
      expect(validatePattern(generatePattern(scaledConfiguration))).toEqual([]);
    }
  });

  it("keeps every marking and grainline within the cut piece", () => {
    for (const piece of pattern.pieces) {
      const cut = boundsOf(piece.cutPath);
      const markings = [...piece.markings.flatMap(markingPoints)];
      if (piece.grainline) markings.push(piece.grainline.start, piece.grainline.end);
      for (const point of markings) {
        expect(point.x, piece.id).toBeGreaterThanOrEqual(cut.minX - 1e-6);
        expect(point.x, piece.id).toBeLessThanOrEqual(cut.maxX + 1e-6);
        expect(point.y, piece.id).toBeGreaterThanOrEqual(cut.minY - 1e-6);
        expect(point.y, piece.id).toBeLessThanOrEqual(cut.maxY + 1e-6);
      }
    }
  });

  it("puts the cut line exactly each edge's allowance outside that edge", () => {
    for (const piece of pattern.pieces) {
      for (const edge of piece.edges) {
        const n = edgeNormal(edge);
        const mid = {
          x: (edge.start.x + edge.end.x) / 2 + n.x * edge.allowanceMm,
          y: (edge.start.y + edge.end.y) / 2 + n.y * edge.allowanceMm,
        };
        expect(distanceToOutline(mid, piece.cutPath), `${piece.id}.${edge.id}`).toBeLessThan(1e-6);
      }
    }
  });

  it("gives seamed edges the seam allowance", () => {
    for (const piece of pattern.pieces) {
      for (const edge of piece.edges) {
        if (edge.seamId)
          expect(edge.allowanceMm, `${piece.id}.${edge.id}`).toBe(configuration.seamAllowanceMm);
      }
    }
  });
});

describe("validatePattern", () => {
  const base = generatePattern(defaultConfiguration("tote"));

  it("flags duplicate piece ids", () => {
    const [first] = base.pieces;
    if (!first) throw new Error("no pieces");
    const issues = validatePattern({ ...base, pieces: [...base.pieces, first] });
    expect(issues.some((issue) => issue.message.includes("duplicate piece id"))).toBe(true);
  });

  it("flags a seam whose edges differ in length", () => {
    const pieces = base.pieces.map((piece) =>
      piece.id === "bottom"
        ? {
            ...piece,
            edges: piece.edges.map((edge) =>
              edge.seamId === "bottom-front" ? { ...edge, length: edge.length + 2 } : edge,
            ),
          }
        : piece,
    );
    expect(validatePattern({ ...base, pieces })).toEqual([
      expect.objectContaining({ seamId: "bottom-front" }),
    ]);
  });

  it("flags a seam with only one edge", () => {
    const pieces = base.pieces.filter((piece) => piece.id !== "gusset-left");
    const seams = validatePattern({ ...base, pieces }).map((issue) => issue.seamId);
    expect(seams).toEqual(expect.arrayContaining(["left-front", "left-back", "bottom-left"]));
  });

  it("flags a degenerate cut path", () => {
    const pieces = base.pieces.map((piece, index) =>
      index === 0 ? { ...piece, cutPath: piece.cutPath.slice(0, 2) } : piece,
    );
    expect(validatePattern({ ...base, pieces })[0]?.message).toMatch(/not a valid polygon/);
  });
});

describe("layoutPieces", () => {
  it("wraps to a new row instead of exceeding maxWidth", () => {
    const pattern = generatePattern(defaultConfiguration("tote"));
    const maxWidth = 500;
    const layout = layoutPieces(pattern.pieces, { maxWidth, margin: 0 });
    const rows = new Set(
      layout.placements.map((p) => Math.round(p.y + boundsOf(p.piece.cutPath).minY)),
    );
    expect(rows.size).toBeGreaterThan(1);
    for (const placement of layout.placements) {
      const left = placement.x + boundsOf(placement.piece.cutPath).minX;
      // a piece wider than maxWidth still gets its own row
      if (placement.width <= maxWidth) {
        expect(left + placement.width).toBeLessThanOrEqual(maxWidth + 1e-6);
      }
    }
  });
});

describe("registry", () => {
  it("uses the schema's bounds for every number field", () => {
    for (const template of TEMPLATE_IDS) {
      for (const section of TEMPLATE_DEFINITIONS[template].sections) {
        for (const field of section.fields) {
          if (field.kind !== "number") continue;
          const config = defaultConfiguration(template);
          const below = withField(config, field.key, field.minMm - 1);
          const above = withField(config, field.key, field.maxMm + 1);
          expect(bagConfigurationSchema.safeParse(below).success, `${template}.${field.key}`).toBe(
            false,
          );
          expect(bagConfigurationSchema.safeParse(above).success, `${template}.${field.key}`).toBe(
            false,
          );
        }
      }
    }
  });
});

describe("leather registry", () => {
  it("reads leather bounds from the schema", () => {
    for (const section of LEATHER_SECTIONS) {
      for (const field of section.fields) {
        if (field.kind !== "number") continue;
        const config = withField(defaultConfiguration("tote"), "material", "leather");
        expect(
          bagConfigurationSchema.safeParse(withField(config, field.key, field.maxMm + 1)).success,
        ).toBe(false);
      }
    }
  });
});
