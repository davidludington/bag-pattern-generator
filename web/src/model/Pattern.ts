export type Pt = [number, number];

export type PatternPiece = {
  id: string;
  name: string;
  material: string;
  notes: string;
  finished: Pt;
  cutSize: Pt;
  transform: { x: number; y: number };
  cut: Pt[];
  stitch: Pt[][];
  fold: Pt[][];
  notches: Pt[][];
  grain: Pt[] | null;
};

export type PatternModel = {
  name: string;
  sheet: { width: number; height: number };
  pieces: PatternPiece[];
};
