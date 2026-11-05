# Bag Pattern Studio

A local app for generating printable sewing and leatherworking patterns for
bags. It ships six parametric templates -- tote, zip pouch, boxed pouch,
tapered tote, drawstring, and Birkin-style bag -- with a schema-driven config
form and a 2D pattern workspace. Configure dimensions, pick a material, then
move, rotate, and export the pattern as a true-scale SVG. You can also start
from a photo: Claude identifies the construction and proportions, you confirm
one real measurement, and the engine drafts the pattern.

The intended loop is: **software → physical prototype → observation →
software.**

## Stack

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui (Radix)
- **Engine:** `packages/pattern-engine`, pure TypeScript, Zod validation
- **AI:** Claude (`claude-opus-5-5`) via `@anthropic-ai/sdk`, server-side only
- **Tests:** Vitest for geometry and libs, Playwright for the browser workflow
- **Quality:** ESLint (Next + typescript-eslint), Prettier, GitHub Actions CI
- **Persistence:** browser `localStorage` behind a `ProjectStore` interface
- **Legacy:** the original Python engine + CLI (frozen) still lives at the repo root

The pattern is a semantic model (pieces, sewing lines, cutting lines, notches,
grainlines). Renders are always derived; geometry is never authored in the UI.

## Project structure

```
apps/web/                     Next.js app (dashboard, config, workspace)
  app/                        App Router routes (+ api/analyze-photo)
  components/                 UI, SVG canvas, inspector, forms, photo import
  lib/                        project store, hooks, drawing helpers, SVG export,
                              Claude photo analyzer (server-only)
  e2e/                        Playwright workflows
packages/pattern-engine/      pure TypeScript geometry + templates
  src/schema.ts               Zod configuration union (mm)
  src/geometry.ts             rect, polygon offset, rounded rect, notches
  src/registry.ts             template metadata + generatePattern() dispatch
  src/templates/              one generator per template
  src/validation.ts           seam/edge compatibility checks
  src/layout.ts               shelf packing shared by editor + export
  src/reconstruction.ts       photo observation schema -> configuration
src/, api.py, generate.py     legacy Python engine + CLI (frozen)
```

## Run the web app

```bash
npm install
npm run dev
# open http://localhost:3000
```

There is no Python process in this path. The engine runs in the browser, so
config changes regenerate the pattern immediately.

Photo import needs an Anthropic API key on the server:

```bash
cp apps/web/.env.example apps/web/.env.local
# set ANTHROPIC_API_KEY in apps/web/.env.local
```

Everything else works without a key.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript typecheck for engine and web |
| `npm run lint` | ESLint (Next, React hooks, typescript-eslint) |
| `npm run format` / `format:check` | Prettier write / check |
| `npm test` | Vitest tests for the engine and web libs |
| `npm run check` | typecheck + lint + unit tests |
| `npm run test:e2e` | Playwright end-to-end workflow |
| `npm run test:py` | Legacy Python pytest suite |

First-time Playwright setup:

```bash
npx playwright install chromium
```

## Workflow

1. Open the dashboard. Two sample projects are seeded on first visit.
2. **New project** → pick a template and name the project, or **Use a photo**.
3. **Configure** the template's dimensions, material, and seam allowance.
   Inputs are in centimetres; the engine works in millimetres.
4. **Open workspace** to see the generated pieces.
5. Select a piece to inspect it. Drag to move; rotate from the inspector.
6. **Export SVG** for a true-scale printable sheet.

Workspace moves and rotations are placement-only. The underlying sewing
geometry is always driven by the bag configuration.

Projects are saved as you type. A value outside its allowed range is kept as a
draft and shown as an error; it never makes the project disappear.

### Starting from a photo

1. Upload a JPEG/PNG/WebP/GIF (up to 5 MB).
2. The server sends it to Claude, which returns a structured *observation*:
   the nearest template, relative proportions, material, pocket, closure, and
   notes. The response is schema-validated twice (structured output, then at
   the route boundary). Claude never produces geometry or SVG.
3. You enter one real measurement (width, height, or depth).
   `observationToConfiguration()` scales the proportions, clamps to the
   template limits, fixes cross-field conflicts, and lists every assumption.
4. **Create project** opens the normal configuration screen to refine it.

## Pattern engine

`generatePattern(configuration)` dispatches to a per-template generator and
returns a `Pattern`. `src/registry.ts` is the source of template metadata used
by both the engine and the schema-driven config form.

Templates:

- **Tote**: front, back, bottom, two gussets, straps, optional patch pockets.
- **Zip pouch**: two panels with a top zipper opening.
- **Boxed pouch**: two panels with boxed bottom corners.
- **Tapered tote**: trapezoid panels, one continuous gusset, two handles.
- **Drawstring bag**: two panels with a folded casing and open stitch/fold lines.
- **Birkin-style bag**: five-panel box, rounded flap, sangles, rolled handles.

Each piece carries:

- finished size and seam allowance
- a cutting boundary plus closed or open sewing/fold lines
- labelled edges with a seam id on every seamed edge (all six templates)
- notches (labelled), grainline, quantity, material, and notes

Cutting geometry expands the finished shape by the seam allowance on every
stitched edge. Seams that join two pieces consume the allowance twice.
`validatePattern()` checks every seam id has exactly two edges with matching
lengths, and every template emits seam ids, so the check is meaningful for all
of them. Examples: the tapered-tote gusset's long edges are split at the corner
notches so each segment pairs with one panel edge; a boxed-pouch corner's two
cut-out edges pair with each other; the Birkin handle wrap's long edges pair
with each other.

### Leather construction

Choosing **Leather** applies the rules from
`.opencode/skills/leather-bag-construction` (`packages/pattern-engine/src/construction.ts`).
Canvas and denim patterns are unchanged.

- **Thickness per component.** Body/flap, base, gussets, and straps/handles each
  have their own thickness (defaults 1.1 / 1.6 / 0.9 / 2.2 mm), shown on every
  piece label and in the inspector.
- **Edge finish decides exposed-edge allowance.** Seamed edges always carry the
  seam allowance. Openings, strap edges, and flap edges are cut on the finished
  line when painted, burnished, or raw, and get the turn-in (default 10 mm,
  at least 2 × thickness) when folded. Every edge records its own allowance.
- **Skive zones** are marked over each seam allowance and, for folded edges,
  across the turn-in plus the rest of the skive width (default 15 mm, skived to
  0.8 mm).
- **Wrap allowance and thickness compensation.** The Birkin flap gains
  (π/2) × (flap + front panel thickness) at the front fold, which is an upper
  bound to confirm with a mock-up. The rolled handle's circumference is taken
  at the leather's mid-thickness, π × (diameter − thickness). The drawstring
  casing flap gains the wrap for folding over itself.
- **Hardware and reinforcement.** The Birkin marks handle rivets, sangle
  anchors, the turn-lock base, the flap hole, and the strap slot, and
  reinforces the flap fold. The tapered tote marks riveted handle anchors.
  Placements are starting points: confirm them against your hardware.

Not modelled yet: ease, edge-finishing loss, thickness compensation where thick
panels meet at box seams, zipper setback geometry, and lining layers.

### Boxed pouch construction

Each panel sews (width + depth) × (height + depth/2), less a depth/2 square at
each bottom corner. The cut adds the allowance all round, including the
opening, so the raw panel is `w + depth + 2·sa` × `h + depth/2 + 2·sa` and the
corner cut-out stays depth/2 from the raw corner.

### Tote construction assumptions

- Front/back side edges sew to the left/right gusset vertical edges.
- Front/back bottom edges sew to the front/back edges of the bottom panel.
- Gusset bottom edges sew to the left/right edges of the bottom panel.
- The top opening edges (front, back, gussets) are left raw.
- Straps are folded strips; all four edges use fold lines.
- Pockets are simple patch pockets with a folded top edge.
- Corners are square/mitred; no rounding, ease, or darts yet.

## SVG export

The exporter writes millimeter user units (`width="…mm"`, `viewBox` in the same
numbers), so the file prints at true scale when printed at 100%. It keeps your
workspace arrangement (moves and rotations) and grows the sheet to fit it; with
no placements it uses the same auto-layout as the workspace.

The exported sheet includes:

- cutting boundaries
- sewing boundaries and fold lines
- piece names and finished/cut dimensions
- grainlines
- notches
- a 100 mm scale check bar

Print at **100% / actual size** (disable "fit to page") and measure the scale
bar before cutting.

## Tests

```bash
npm test          # engine geometry + web libs (store, export, photo route)
npm run test:e2e  # create → configure → move/rotate → export; photo import
npm run test:py   # legacy Python engine/API
```

The Vitest suite prioritizes geometric correctness. For every template it
checks seam labelling and pair lengths (also at scaled sizes), notch and
grainline placement, and allowance offsets, plus per-template piece sets,
finished vs cut sizes, invalid configurations, and overlap-free layout. It also
covers `validatePattern()` failure cases, layout wrapping, registry bounds
matching the Zod schema, and the photo → configuration mapping.

The photo route is tested with a fake SDK client, and the Playwright photo test
mocks `/api/analyze-photo`, so no test or CI run calls the Claude API.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, unit tests,
build, Playwright, and the legacy pytest suite.

## Limitations (intentional for this initial prototype)

- Projects live in `localStorage`. Persistence goes through the async
  `ProjectStore` interface (`apps/web/lib/projects.ts`), so a Prisma/Postgres
  store can be added without changing the views.
- Photo import uses a single photo and one reference measurement; it maps onto
  the six existing templates only.
- No 3D preview yet. Pattern data is renderer-independent, so a 3D view can
  consume the same `Pattern`.
- Leather rules cover thickness, edge finish, turn-in, skive zones, wrap
  allowance, and hardware marks (see above). Ease, lining layers, and box-seam
  thickness compensation are not modelled yet.
- Export is a single sheet; there is no tiling onto printer pages.

## Legacy Python engine

The original Python engine is still available for the CLI and the older
generators. It is independent of the Next app.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python generate.py examples/tote.yaml   # YAML in, SVG out
.venv/bin/python -m pytest                        # Python tests
.venv/bin/python api.py                           # legacy API on :8000
```

The legacy API exposes `POST /api/pattern`, `POST /api/export.svg`,
`POST /api/infer` (needs `OPENAI_API_KEY` in `.env`), and `GET /api/types`.
It is frozen: new work goes into the TypeScript engine. The retired Vite UI has
been removed.

All legacy dimensions are finished millimeters; generators add seam allowance
on top. See `src/generators/` for the tote, zip pouch, boxed pouch, tapered
tote, drawstring, and Birkin generators.

## Cloud storage (Supabase)

Signed-out visitors edit in localStorage. Signing in with Google moves their projects to Supabase and unlocks SVG export.

1. Create a free Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Create a Google OAuth client and add its ID/secret under Supabase > Authentication > Providers > Google.
3. Under Authentication > URL configuration, allow `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback`.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `PHOTO_ALLOWED_EMAIL` (see `apps/web/.env.example`) in `apps/web/.env.local` and in Vercel.

Without the Supabase variables the app runs local-only. Photo import also needs `PHOTO_IMPORT_ENABLED=true`, and in production only `PHOTO_ALLOWED_EMAIL` can use it.
