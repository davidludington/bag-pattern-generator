import { describe, expect, it } from "vitest";
import {
  boundsOf,
  offsetConvexPath,
  offsetRectPath,
  polygonArea,
  rectEdges,
  rectPath,
  roundedRectPath,
} from "./index";

describe("geometry helpers", () => {
  it("builds a closed rectangle path", () => {
    const path = rectPath(300, 250);
    expect(path).toHaveLength(4);
    expect(polygonArea(path)).toBe(75000);
    expect(boundsOf(path)).toMatchObject({ width: 300, height: 250 });
  });

  it("offsets a rectangle by the seam allowance on every edge", () => {
    const cut = offsetRectPath(300, 250, 10);
    expect(boundsOf(cut)).toMatchObject({ width: 320, height: 270 });
    expect(boundsOf(cut).minX).toBe(-10);
    expect(boundsOf(cut).minY).toBe(-10);
  });

  it("offsets a convex trapezoid by the seam allowance", () => {
    const finished = [
      { x: 0, y: 0 },
      { x: 340, y: 0 },
      { x: 300, y: 250 },
      { x: 40, y: 250 },
    ];
    const cut = offsetConvexPath(finished, 10);
    const bounds = boundsOf(cut);
    expect(bounds.height).toBe(270);
    expect(bounds.width).toBeGreaterThan(360);
    expect(polygonArea(cut)).toBeGreaterThan(polygonArea(finished));
  });

  it("builds a rounded path with selected corners", () => {
    const path = roundedRectPath(300, 280, 20, ["bl", "br"]);
    const bounds = boundsOf(path);
    expect(path.length).toBeGreaterThan(4);
    expect(bounds.width).toBeCloseTo(300, 5);
    expect(bounds.height).toBeCloseTo(280, 5);
  });

  it("builds edges with the expected lengths", () => {
    const edges = rectEdges(300, 250, {
      top: { kind: "sew", seamId: "top" },
      right: { kind: "sew", seamId: "right" },
    });
    expect(edges).toHaveLength(4);
    expect(edges.find((e) => e.id === "top")?.length).toBe(300);
    expect(edges.find((e) => e.id === "right")?.length).toBe(250);
    expect(edges.find((e) => e.id === "bottom")?.kind).toBe("raw");
  });
});
