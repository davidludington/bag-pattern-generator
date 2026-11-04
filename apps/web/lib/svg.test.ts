import {
  boundsOf,
  defaultConfiguration,
  generatePattern,
  layoutPieces,
} from "@bag-patterns/pattern-engine";
import { describe, expect, it } from "vitest";
import { SHEET_LAYOUT, wrapText } from "./pattern-draw";
import { resolveTransforms } from "./projects";
import { renderPatternSvg } from "./svg";

function sheetSize(svg: string): { width: number; height: number } {
  const match = svg.match(
    /width="([0-9.]+)mm" height="([0-9.]+)mm" viewBox="0 0 ([0-9.]+) ([0-9.]+)"/,
  );
  if (!match) throw new Error("no sheet size");
  const [, width, height, viewWidth, viewHeight] = match.map(Number);
  // physical size and user units agree, so 1 user unit = 1 mm
  expect(width).toBe(viewWidth);
  expect(height).toBe(viewHeight);
  return { width: width ?? NaN, height: height ?? NaN };
}

function pieceTranslate(svg: string, id: string): { x: number; y: number } {
  const match = svg.match(
    new RegExp(`data-piece="${id}" transform="translate\\(([-0-9.]+) ([-0-9.]+)\\)`),
  );
  if (!match) throw new Error(`no piece ${id}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe("renderPatternSvg", () => {
  const tote = generatePattern(defaultConfiguration("tote"));

  it("exports a true-scale millimetre sheet that contains every piece", () => {
    const svg = renderPatternSvg(tote);
    const layout = layoutPieces(tote.pieces, SHEET_LAYOUT);
    const { width, height } = sheetSize(svg);
    expect(width).toBeGreaterThanOrEqual(layout.width);
    expect(height).toBeGreaterThan(layout.height);
    for (const piece of tote.pieces) expect(svg).toContain(`data-piece="${piece.id}"`);
    expect(svg).toContain("100 mm");
  });

  it("draws the front's cut line at its real size", () => {
    const svg = renderPatternSvg(tote);
    const front = svg.split('data-piece="front"')[1] ?? "";
    // 300 x 250 finished + 10 mm allowance on each side
    expect(front).toContain('class="cut" d="M -10,-10 L 310,-10 L 310,260 L -10,260 Z"');
  });

  it("keeps workspace moves and grows the sheet to fit them", () => {
    const base = renderPatternSvg(tote);
    const moved = renderPatternSvg(tote, { front: { x: 2000, y: 0, rotation: 0 } });
    const back = resolveTransforms(tote, {}).back;
    if (!back) throw new Error("no back");
    // front sits at its absolute placement; back keeps the automatic layout
    expect(pieceTranslate(moved, "front").x - pieceTranslate(moved, "back").x).toBeCloseTo(
      2000 - back.x,
      1,
    );
    expect(sheetSize(moved).width).toBeGreaterThan(sheetSize(base).width);
  });

  it("keeps rotations and fits the rotated piece on the sheet", () => {
    const svg = renderPatternSvg(tote, { strap: { x: 0, y: 0, rotation: 90 } });
    expect(svg).toMatch(/data-piece="strap" transform="translate\([^)]+\) rotate\(90 /);
    const strap = tote.pieces.find((piece) => piece.id === "strap");
    if (!strap) throw new Error("no strap");
    // a 620 mm strap stood on end needs a sheet at least that tall
    expect(sheetSize(svg).height).toBeGreaterThan(boundsOf(strap.cutPath).width);
  });

  it("moves pieces dragged above the sheet back inside the margin", () => {
    const svg = renderPatternSvg(tote, { front: { x: 0, y: -500, rotation: 0 } });
    expect(pieceTranslate(svg, "front").y).toBeGreaterThan(0);
  });

  it("includes optional pocket pieces", () => {
    const pattern = generatePattern({
      ...defaultConfiguration("tote"),
      interiorPocket: true,
      exteriorPocket: true,
    });
    const svg = renderPatternSvg(pattern);
    expect(svg).toContain('data-piece="interior-pocket"');
    expect(svg).toContain('data-piece="exterior-pocket"');
  });

  it("renders open stitch and fold lines", () => {
    const svg = renderPatternSvg(generatePattern(defaultConfiguration("drawstring")));
    expect(svg).toContain('class="sew" d="M 0,50 L 200,50"');
    expect(svg).toContain('class="fold"');
  });

  it("does not claim every sewing line is one allowance inside the cut line", () => {
    expect(renderPatternSvg(tote)).not.toContain("sewing lines sit inside");
  });
});

describe("wrapText", () => {
  it("wraps on word boundaries and caps the line count", () => {
    expect(wrapText("one two three four", 8)).toEqual(["one two", "three", "four"]);
    expect(wrapText("a b c d e f", 1, 2)).toEqual(["a", "b…"]);
  });
});

describe("leather export", () => {
  const birkin = generatePattern(defaultConfiguration("birkin"));
  const svg = renderPatternSvg(birkin);

  it("draws skive and reinforcement zones and hardware punches", () => {
    expect(svg).toContain('class="skive"');
    expect(svg).toContain('class="reinforce"');
    expect(svg).toMatch(/<g class="punch"><title>turn-lock hole<\/title><circle /);
  });

  it("labels thickness on each piece and adds the leather legend", () => {
    expect(svg).toContain("· 1.1 mm leather");
    expect(svg).toContain("skive zone");
    expect(svg).toContain("punch / hardware");
    expect(svg).toContain("leather: painted edges");
  });

  it("keeps fabric exports free of leather markings", () => {
    const fabric = renderPatternSvg(generatePattern(defaultConfiguration("tote")));
    expect(fabric).not.toContain('class="skive"');
    expect(fabric).not.toContain("skive zone");
    expect(fabric).not.toContain("mm leather");
  });
});
