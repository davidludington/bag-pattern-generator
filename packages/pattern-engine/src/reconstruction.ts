import { z } from "zod";
import { readField, TEMPLATE_DEFINITIONS, withField } from "./registry";
import {
  bagConfigurationSchema,
  defaultConfiguration,
  MATERIALS,
  TEMPLATE_IDS,
  type BagConfiguration,
} from "./schema";

/**
 * What a vision model reports about a bag photo. It describes, it does not
 * measure: proportions are relative, and the user supplies one real
 * measurement to scale them. Kept to plain types (no refinements or bounds)
 * so it can double as a structured-output schema.
 */
export const bagObservationSchema = z.object({
  template: z
    .enum(TEMPLATE_IDS)
    .describe("The supported template whose construction best matches the bag."),
  confidence: z.enum(["low", "medium", "high"]),
  proportions: z
    .object({
      width: z.number().describe("Finished width across the front, at the widest point."),
      height: z.number().describe("Finished body height, base to opening, excluding handles."),
      depth: z.number().describe("Finished side-to-side depth (gusset width). 0 if flat."),
    })
    .describe("Relative sizes in any consistent unit; only the ratios matter."),
  bottomToTopWidth: z
    .number()
    .nullable()
    .describe("Bottom width divided by top width when the body tapers; null if straight."),
  strapDropToHeight: z
    .number()
    .nullable()
    .describe("Visible handle or strap length divided by body height; null if none."),
  material: z.enum(MATERIALS).nullable().describe("Closest supported material, or null."),
  exteriorPocket: z.boolean(),
  closure: z.enum(["open", "zipper", "drawstring", "flap", "other"]),
  visiblePanels: z.array(z.string()).describe("Panels you can see, e.g. front, gusset, base."),
  notes: z
    .array(z.string())
    .describe("Construction details and anything you were unsure about, one per item."),
});

export type BagObservation = z.infer<typeof bagObservationSchema>;

export type ReferenceAxis = "width" | "height" | "depth";

export interface ReferenceMeasurement {
  axis: ReferenceAxis;
  /** The user's real measurement along `axis`, finished, in millimetres. */
  valueMm: number;
}

export interface Reconstruction {
  configuration: BagConfiguration;
  /** Plain-language assumptions the user should confirm before cutting. */
  assumptions: string[];
}

const round = (value: number) => Math.round(value);

/**
 * Turn an observation plus one real measurement into a validated
 * configuration for the engine. Unobservable values keep template defaults;
 * every substitution is reported as an assumption.
 */
export function observationToConfiguration(
  observation: BagObservation,
  reference: ReferenceMeasurement,
  name = "Photo import",
): Reconstruction {
  const assumptions: string[] = [];
  const { template, proportions } = observation;
  const defaults = defaultConfiguration(template);
  let configuration: BagConfiguration = { ...defaults, name };

  const referenceProportion = proportions[reference.axis];
  if (!(referenceProportion > 0) || !(reference.valueMm > 0)) {
    assumptions.push(
      `The photo gave no usable ${reference.axis}, so all dimensions use template defaults.`,
    );
    return finish(configuration, defaults, assumptions);
  }
  const scale = reference.valueMm / referenceProportion;
  const width = proportions.width * scale;
  const height = proportions.height * scale;
  const depth = proportions.depth * scale;

  const set = (key: string, value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value) || value <= 0) return;
    configuration = withField(configuration, key, round(value));
  };

  switch (template) {
    case "tote":
    case "boxed-pouch":
    case "birkin":
      set("widthMm", width);
      set("heightMm", height);
      set("depthMm", depth);
      break;
    case "zip-pouch":
    case "drawstring":
      set("widthMm", width);
      set("heightMm", height);
      break;
    case "tapered-tote": {
      set("topWidthMm", width);
      set("heightMm", height);
      set("depthMm", depth);
      const ratio = observation.bottomToTopWidth;
      if (ratio != null && ratio > 0) set("bottomWidthMm", width * ratio);
      else assumptions.push("Bottom width keeps the template's taper; the photo showed none.");
      break;
    }
  }

  if (observation.strapDropToHeight != null && observation.strapDropToHeight > 0) {
    const drop = observation.strapDropToHeight * height;
    if (template === "tote") set("strapLengthMm", drop);
    if (template === "tapered-tote" || template === "birkin") set("handleLengthMm", drop);
  }

  if (template === "tote") {
    configuration = withField(configuration, "exteriorPocket", observation.exteriorPocket);
    assumptions.push("Interior pocket is off: the inside of the bag is not visible.");
  }

  if (observation.material) {
    configuration = withField(configuration, "material", observation.material);
  } else {
    assumptions.push(`Material defaults to ${defaults.material}.`);
  }
  assumptions.push(
    `Seam allowance is the template default of ${defaults.seamAllowanceMm} mm.`,
    `Dimensions are scaled from your ${reference.axis} of ${reference.valueMm} mm; the photo only gives proportions.`,
  );
  if (observation.confidence !== "high") {
    assumptions.push(
      `The template match has ${observation.confidence} confidence; check that the construction is right.`,
    );
  }

  return finish(configuration, defaults, assumptions);
}

/**
 * Clamp every registry number to its schema bounds, then reset any field the
 * cross-field rules still reject. The result always validates.
 */
function finish(
  candidate: BagConfiguration,
  defaults: BagConfiguration,
  assumptions: string[],
): Reconstruction {
  let configuration = candidate;
  for (const section of TEMPLATE_DEFINITIONS[configuration.template].sections) {
    for (const field of section.fields) {
      if (field.kind !== "number") continue;
      const value = Number(readField(configuration, field.key));
      const clamped = Math.min(field.maxMm, Math.max(field.minMm, value));
      if (clamped !== value) {
        assumptions.push(
          `${field.label} was ${round(value)} mm, outside ${field.minMm}–${field.maxMm} mm; set to ${clamped} mm.`,
        );
        configuration = withField(configuration, field.key, clamped);
      }
    }
  }

  // Every cross-field rule caps one value (an inset, radius, or casing) by
  // another, so shrink the offending value until the rule passes.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const parsed = bagConfigurationSchema.safeParse(configuration);
    if (parsed.success) return { configuration: parsed.data, assumptions };
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    const value = typeof key === "string" ? readField(configuration, key) : undefined;
    if (typeof key !== "string" || typeof value !== "number" || value < 1) break;
    const next = Math.floor(value / 2);
    configuration = withField(configuration, key, next);
    if (!assumptions.some((line) => line.startsWith(`${issue?.message} Reduced ${key}`))) {
      assumptions.push(`${issue?.message} Reduced ${key} to fit.`);
    }
  }

  assumptions.push("The photo's proportions did not fit this template; using its defaults.");
  return { configuration: { ...defaults, name: candidate.name }, assumptions };
}
