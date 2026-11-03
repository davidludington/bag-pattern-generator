# AGENTS.md

Bag pattern generator: turns a dimension config into a printable cutting
pattern (SVG) and drives a local Next.js UI. The active web app uses a pure
TypeScript engine; the original Python engine remains as a frozen legacy CLI/API.

Intended loop: **software → physical prototype → observation → software.**
Domain knowledge lives in `.opencode/skills/` (see below) — read it before
changing geometry.

## Commands

```bash
# web app (from repo root)
npm install
npm run dev          # Next.js on :3000
npm run build        # production build
npm run typecheck    # tsc --noEmit (engine + web)
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest (engine + web libs)
npm run check        # typecheck + lint + test
npm run test:e2e     # Playwright (run `npx playwright install chromium` once)

# legacy Python engine (from repo root)
.venv/bin/python -m pytest
.venv/bin/python generate.py examples/tote.yaml
.venv/bin/python api.py
```

## Architecture

```
apps/web/                        Next.js App Router UI
  app/                           dashboard, configure, workspace, photo routes
  app/api/analyze-photo/         server route: photo -> Claude -> observation
  components/                    canvas, inspector, config form, photo import, UI
  lib/                           ProjectStore (localStorage), useProject/usePattern,
                                 pattern-draw (shared render helpers), SVG export,
                                 analyze-photo (server-only Claude client)
  e2e/                           Playwright workflows
packages/pattern-engine/         pure TypeScript engine
  src/types.ts                   Point / Edge / Marking / PatternPiece / Pattern
  src/schema.ts                  Zod configuration union (mm)
  src/geometry.ts                rect, polygon offset, rounded rect, notch, grainline, bounds
  src/registry.ts                template metadata + generatePattern() dispatch
  src/templates/                one generator per template
  src/validation.ts              seam/edge length compatibility
  src/layout.ts                  shared shelf packing for editor + export
  src/reconstruction.ts          BagObservation schema + observationToConfiguration
  src/templates/shared.ts        rectPiece() builder used by most templates
src/, api.py, generate.py        legacy Python engine + CLI/API (frozen)
```

**Flow:** `BagConfiguration → generatePattern → Pattern → React SVG / SVG export`.
The UI converts user-facing cm to mm before calling the engine. The engine has
no React, Next.js, or browser dependencies.

**Photo flow:** `photo → /api/analyze-photo (Claude, structured output) →
BagObservation → observationToConfiguration(+ one user measurement) →
BagConfiguration`. The model only describes; it never produces geometry or SVG.
Tests never call the API (fake client in Vitest, `page.route` in Playwright).

## Invariants

- The semantic model is the source of truth. The SVG is **derived** — never
  compute geometry in the UI or an exporter.
- All dimensions are **finished**, in **millimeters**. Templates add seam
  allowance on top. The UI may display cm, but converts before the engine.
- `cut = finished + allowance on every stitched edge`, per piece. A seam
  between two pieces consumes the allowance twice.
- Keep sewing and cutting boundaries separate. Moving/rotating pieces in the
  workspace changes placement only, never the pattern geometry.
- Two edges sharing a `seamId` must have matching lengths; `validatePattern()`
  enforces this. Every template must label its seamed edges with seam ids
  (split an edge at notches when it joins several partners), or the check
  proves nothing. `invariants.test.ts` enforces this for every template.
- Allowance is per edge (`Edge.allowanceMm`). Builders get it from
  `constructionRules(config)` (`src/construction.ts`): seamed edges carry the
  seam allowance; exposed edges carry a hem (fabric), nothing (painted/
  burnished/raw leather), or the turn-in (folded leather). Pass each piece
  through `applyConstruction()` (`rectPiece` does this) so leather pieces get
  thickness, edge finish, and skive zones. Fabric output must not change when
  leather rules change.
- Leather hardware and reinforcement are `punch` / `zone` markings, not
  geometry. Read `.opencode/skills/leather-bag-construction` before adding any.
- Size limits live only in the Zod schemas; the registry reads them
  (`minValue`/`maxValue`). Registry field keys are type-checked per template.
- Rendering helpers shared by the canvas and the exporter live in
  `apps/web/lib/pattern-draw.ts`; both use the same `SHEET_LAYOUT`.
- Stored project drafts may be invalid; never drop a project because its
  configuration fails validation. Persist through `ProjectStore`.
- Templates live behind a single `generateXPattern(config)` function and are
  registered in `src/registry.ts`; the UI is driven by that metadata.

## Adding a template

1. `packages/pattern-engine/src/templates/<type>.ts`: validation + a
   `generate<Type>Pattern(config)` that returns `PatternPiece`s with finished
   sizes, cut paths, seam-labelled edges, notches, grainlines, quantity, and
   material.
2. Add its configuration fields to the Zod schema (or a separate schema) and
   export a default configuration.
3. Register it in the engine index and wire the UI template picker/config form.
4. Tests in `packages/pattern-engine/src/*.test.ts`: piece set, dimensions,
   seam allowance, seam compatibility, pockets/options, invalid configs, and
   overlap-free layout. Adding the id to `TEMPLATE_IDS` runs the shared
   invariants automatically.
5. Reuse helpers from `src/geometry.ts` (`polygonEdges`, `notchAt`,
   `grainlineFor`, `NOTCH_LENGTH_MM`) and `templates/shared.ts` (`rectPiece`)
   before writing new geometry.
6. Map it in `observationToConfiguration()` so photo import can target it.

## Legacy Python

The Python engine still supports the tote, zip pouch, boxed pouch, tapered
tote, drawstring, and Birkin generators plus an OpenAI-based image import. It
is frozen: do not add features there, and do not mix its geometry with the
TypeScript engine.

## Skills

- `.opencode/skills/bag-pattern-theory` — 2D→3D math: allowances, gussets,
  corners, flaps, truing. Read before drawing any piece.
- `.opencode/skills/leather-bag-construction` — leather-specific: thickness
  compensation, skiving, edge finishing, wrap/turn allowance, hardware.

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
