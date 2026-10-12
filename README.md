# bag-patterns

A small local tool that generates printable sewing/leatherworking bag
patterns from a dimension config. Right now it supports one bag type: a
rectangular gusseted tote (front, back, continuous gusset, two handles).

The pattern is a semantic model (pieces, stitch lines, notches, grainlines)
that is exported to SVG — the SVG is never the source of truth.

Two ways to drive it:

- **CLI** — YAML in, SVG out.
- **Bag Pattern Studio** — a local React UI (edit parameters, live pattern
  preview, save/open projects, export/print).

## Install

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```bash
.venv/bin/python generate.py examples/tote.yaml
# wrote output/tote.svg (5 pieces)
```

Run the tests:

```bash
.venv/bin/python -m pytest
```

## Bag Pattern Studio (browser UI)

Development — two terminals:

```bash
# terminal 1: the pattern engine (Python API on :8000)
.venv/bin/python api.py

# terminal 2: the UI (Vite dev server on :5173, /api proxied to :8000)
cd web && npm install && npm run dev
# open http://localhost:5173
```

One process — build the UI once, Python serves it:

```bash
cd web && npm install && npm run build
.venv/bin/python api.py   # open http://localhost:8000
```

UI capabilities (v1): edit all parameters with live regeneration, wheel-zoom /
drag-pan canvas, click a piece to select it (contextual inspector), undo/redo
(Ctrl+Z / Ctrl+Shift+Z), Save/Open `.bag.json` project files, Export SVG,
Print/PDF (browser print at 100%).

How it fits together — the UI edits one `BagSpec` object; it never computes
geometry itself:

```
BagSpec ──POST /api/pattern──▶ Python engine ──▶ pattern model JSON ──▶ React SVG canvas
       ──POST /api/export.svg─▶ Python engine ──▶ canonical sheet SVG (export/print/CLI)
```

The pattern model (pieces with ids, paths, notches, sheet transforms) is the
API contract; the Python SVG exporter stays the canonical printable artifact.

## Configuration

All dimensions are **finished** (what the sewn bag ends up as), in
**millimeters**. Seam allowance is added by the generator on top of these.

```yaml
name: tote            # output file: output/<name>.svg

bag:
  width: 300          # front/back width
  height: 250         # front/back height
  depth: 100          # gusset width (side/bottom depth)

construction:
  seam_allowance: 10  # added to every edge of every piece

handles:
  length: 600         # finished strap length, end to end
  width: 30           # finished strap width
  inset: 60           # distance from the panel side edge to each handle end
```

### What the generated dimensions mean

For a 300 × 250 × 100 bag with a **10 mm** seam allowance, the pieces cut to:

| Piece  | Finished      | Cut (incl. 10mm seam allowance) |
|--------|---------------|----------------------------------|
| Front  | 300 × 250     | 320 × 270                        |
| Back   | 300 × 250     | 320 × 270                        |
| Gusset | 800 × 100     | 820 × 120                        |
| Handle | 600 × 30 (×2) | 620 × 50 (×2)                    |

(The shipped `examples/tote.yaml` currently uses `seam_allowance: 0`, where
cut equals finished.)

Gusset length = `2 × height + width` (up the left side, across the bottom, up
the right side). Every piece: **cut = finished + seam allowance on every
edge**, so every seam totals `2 × seam_allowance`.

## Printing at 100%

1. Open the SVG in a browser or PDF viewer.
2. Print with scale set to **100% / actual size** (disable "fit to page").
3. Measure the **100 mm scale bar** in the footer with a ruler before cutting
   anything.
4. The sheet is large (~1500 × 500 mm for the example). Use your viewer's
   poster/tile mode, or print a crop — the scale bar tells you if the scale
   survived.

## SVG conventions

- **Cut line**: solid black
- **Stitch line**: dashed red (the finished seam line)
- **Fold line**: dotted blue
- **Notch**: short solid tick crossing the cut line (match marks)
- **Grainline**: arrow along the piece's length
- Each label shows finished and cut dimensions.

## Tote construction assumptions

- One continuous gusset strip forms left side + bottom + right side. Its two
  long edges sew to the front's and back's left + bottom + right edges.
  No separate bottom panel, no gusset seams.
- Front and back top edges get a plain seam allowance like every other edge —
  finish them however you like (hem, binding, folded edge).
- Handles are straight strips: cut `finished + 2×SA` on all sides, then fold
  all four edges under at the lines so raw edges meet at the back. Both ends
  attach to the panel's top edge at the notch marks; the free loop is
  `handle length − inset span`.
- Corners are sharp/mitred. No corner rounding, no ease, no darts.
- Seam allowance is uniform; there is no specialized treatment at seam
  intersections yet.

## Not implemented (on purpose)

Photo/AI reverse engineering, unit conversion (inches), multiple bag types,
pocket, pattern nesting/optimization, DXF export, page tiling, construction
view, measurement overlays, direct manipulation of pieces (dragging handles
etc.). The UI operates on semantic parameters only — the engine owns all
geometry.

The intended loop is: **software → physical prototype → observation →
software.**
