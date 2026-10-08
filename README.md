# bag-patterns

A small local Python tool that generates printable sewing/leatherworking bag
patterns from a dimension config. Right now it supports one bag type: a
rectangular gusseted tote (front, back, continuous gusset, two handles).

The pattern is a semantic model (pieces, stitch lines, notches, grainlines)
that is exported to SVG — the SVG is never the source of truth.

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

For the example config the pieces cut out to:

| Piece  | Finished      | Cut (incl. 10mm seam allowance) |
|--------|---------------|----------------------------------|
| Front  | 300 × 250     | 320 × 270                        |
| Back   | 300 × 250     | 320 × 270                        |
| Gusset | 800 × 100     | 820 × 120                        |
| Handle | 600 × 30 (×2) | 620 × 50 (×2)                    |

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
pocket, pattern nesting/optimization, DXF export, page tiling, web UI.

The intended loop is: **software → physical prototype → observation →
software.**
