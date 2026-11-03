import type { BagConfiguration, EdgeFinish, Material, TemplateId } from "./schema";

export type {
  BagConfiguration,
  ConfigurationFor,
  EdgeFinish,
  Material,
  TemplateId,
} from "./schema";

export interface Point {
  x: number;
  y: number;
}

export type EdgeKind = "sew" | "fold" | "raw";

/**
 * One edge of the finished (sewing) outline. Edges run clockwise on screen
 * (y down), so the outward normal of start -> end is (dy, -dx).
 */
export interface Edge {
  id: string;
  start: Point;
  end: Point;
  length: number;
  kind: EdgeKind;
  /** Material outboard of this edge on the cut line. */
  allowanceMm: number;
  /** Two edges sharing a seam id must have the same length. */
  seamId?: string;
}

/**
 * Construction markings, in the piece's local millimetres.
 * - notch: sits on the cut line and points outward.
 * - zone: an area to skive (thin) or reinforce, as a closed polygon.
 * - punch: a hardware hole or placement point (rivet, turn-lock, snap).
 */
export type Marking =
  | {
      kind: "notch";
      at: Point;
      direction: Point;
      length: number;
      label?: string;
    }
  | {
      kind: "zone";
      zone: "skive" | "reinforce";
      points: Point[];
      label: string;
    }
  | {
      kind: "punch";
      at: Point;
      diameterMm: number;
      label: string;
    };

/** What a piece does in the bag; drives its leather thickness. */
export type Component = "body" | "base" | "gusset" | "strap" | "flap" | "pocket" | "filler";

export interface SeamAllowance {
  amountMm: number;
}

export interface PathLine {
  points: Point[];
  closed: boolean;
}

export interface PatternPiece {
  id: string;
  name: string;
  quantity: number;
  material: Material;
  finishedSize: { width: number; height: number };
  /** Allowance on seamed edges. Each edge records its own `allowanceMm`. */
  seamAllowance: SeamAllowance;
  component: Component;
  /** Leather thickness for this piece; null for fabric. */
  thicknessMm: number | null;
  /** How exposed (unseamed) edges are finished; null for fabric. */
  edgeFinish: EdgeFinish | null;
  /** Closed cutting boundary (finished + per-edge allowance) in local millimeters. */
  cutPath: Point[];
  /** Sewing lines. Boxed pouches have none; drawstrings have open lines. */
  stitchPaths: PathLine[];
  /** Fold lines. These carry no seam allowance. */
  foldPaths: PathLine[];
  edges: Edge[];
  markings: Marking[];
  grainline: { start: Point; end: Point } | null;
  notes?: string;
}

export interface Pattern {
  name: string;
  template: TemplateId;
  unit: "mm";
  configuration: BagConfiguration;
  pieces: PatternPiece[];
}

export interface ValidationIssue {
  pieceId?: string;
  seamId?: string;
  message: string;
}
