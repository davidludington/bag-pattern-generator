import { z } from "zod";
import {
  birkinConfigurationSchema,
  boxedPouchConfigurationSchema,
  drawstringConfigurationSchema,
  taperedToteConfigurationSchema,
  toteConfigurationSchema,
  zipPouchConfigurationSchema,
  EDGE_FINISHES,
  type BagConfiguration,
  type ConfigurationFor,
  type EdgeFinish,
  type TemplateId,
} from "./schema";
import { generateBirkinPattern } from "./templates/birkin";
import { generateBoxedPouchPattern } from "./templates/boxed-pouch";
import { generateDrawstringPattern } from "./templates/drawstring";
import { generateTaperedTotePattern } from "./templates/tapered-tote";
import { generateTotePattern } from "./templates/tote";
import { generateZipPouchPattern } from "./templates/zip-pouch";
import type { Pattern } from "./types";

export interface NumberFieldDefinition {
  kind: "number";
  key: string;
  label: string;
  /** Read from the template's Zod schema, so the UI and validation agree. */
  minMm: number;
  maxMm: number;
  stepMm?: number;
  testId?: string;
  /** Display unit. Body dimensions show in cm; thicknesses read better in mm. */
  unit?: "cm" | "mm";
}

export interface ChoiceFieldDefinition {
  kind: "choice";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  testId?: string;
}

export interface BooleanFieldDefinition {
  kind: "boolean";
  key: string;
  label: string;
  hint?: string;
}

export type FieldDefinition =
  NumberFieldDefinition | BooleanFieldDefinition | ChoiceFieldDefinition;

export interface SectionDefinition {
  title: string;
  fields: FieldDefinition[];
}

export interface TemplateDefinition {
  id: TemplateId;
  label: string;
  description: string;
  sections: SectionDefinition[];
}

const TEMPLATE_SCHEMAS = {
  tote: toteConfigurationSchema,
  "zip-pouch": zipPouchConfigurationSchema,
  "boxed-pouch": boxedPouchConfigurationSchema,
  "tapered-tote": taperedToteConfigurationSchema,
  drawstring: drawstringConfigurationSchema,
  birkin: birkinConfigurationSchema,
} satisfies Record<TemplateId, z.ZodObject>;

type KeysOfType<C, V> = {
  [K in keyof C]-?: C[K] extends V ? K : never;
}[keyof C] &
  string;

interface FieldBuilders<T extends TemplateId> {
  num: (
    key: KeysOfType<ConfigurationFor<T>, number>,
    label: string,
    stepMm?: number,
    testId?: string,
  ) => NumberFieldDefinition;
  bool: (
    key: KeysOfType<ConfigurationFor<T>, boolean>,
    label: string,
    hint?: string,
  ) => BooleanFieldDefinition;
}

function numberBounds(template: TemplateId, key: string): { minMm: number; maxMm: number } {
  const field: unknown = (TEMPLATE_SCHEMAS[template].shape as Record<string, unknown>)[key];
  const minMm = field instanceof z.ZodNumber ? field.minValue : null;
  const maxMm = field instanceof z.ZodNumber ? field.maxValue : null;
  if (minMm == null || maxMm == null || !Number.isFinite(minMm) || !Number.isFinite(maxMm)) {
    throw new Error(`${template}.${key} needs a bounded number in the schema`);
  }
  return { minMm, maxMm };
}

/** Section builder whose keys are checked against the template's configuration type. */
function sectionsFor<T extends TemplateId>(
  template: T,
  build: (builders: FieldBuilders<T>) => SectionDefinition[],
): SectionDefinition[] {
  return build({
    num: (key, label, stepMm, testId) => ({
      kind: "number",
      key,
      label,
      ...numberBounds(template, key),
      ...(stepMm !== undefined ? { stepMm } : {}),
      ...(testId !== undefined ? { testId } : {}),
    }),
    bool: (key, label, hint) => ({
      kind: "boolean",
      key,
      label,
      ...(hint !== undefined ? { hint } : {}),
    }),
  });
}

/** Fields shared by every template. */
export const COMMON_SECTION: SectionDefinition = {
  title: "Project",
  fields: [
    {
      kind: "number",
      key: "seamAllowanceMm",
      label: "Seam allowance",
      ...numberBounds("tote", "seamAllowanceMm"),
      stepMm: 1,
      testId: "seam-input",
    },
  ],
};

const mmField = (
  key: string,
  label: string,
  stepMm: number,
  testId: string,
): NumberFieldDefinition => ({
  kind: "number",
  key,
  label,
  ...numberBounds("tote", key),
  stepMm,
  testId,
  unit: "mm",
});

export const EDGE_FINISH_LABEL: Record<EdgeFinish, string> = {
  painted: "Painted",
  burnished: "Burnished",
  raw: "Raw",
  folded: "Folded (turned)",
};

/**
 * Leather construction fields, shared by every template and shown only when
 * the material is leather. See `constructionRules()` for how they apply.
 */
export const LEATHER_SECTIONS: SectionDefinition[] = [
  {
    title: "Leather edges",
    fields: [
      {
        kind: "choice",
        key: "edgeFinish",
        label: "Edge finish",
        options: EDGE_FINISHES.map((value) => ({ value, label: EDGE_FINISH_LABEL[value] })),
        hint: "Painted, burnished and raw edges are cut on the finished line; folded edges get a turn-in.",
        testId: "edge-finish-select",
      },
      mmField("turnInMm", "Turn-in (folded)", 1, "turn-in-input"),
      mmField("skiveWidthMm", "Skive width", 1, "skive-width-input"),
      mmField("skiveToMm", "Skive to", 0.1, "skive-to-input"),
    ],
  },
  {
    title: "Leather thickness",
    fields: [
      mmField("leatherBodyMm", "Body & flap", 0.1, "leather-body-input"),
      mmField("leatherBaseMm", "Base", 0.1, "leather-base-input"),
      mmField("leatherGussetMm", "Gussets", 0.1, "leather-gusset-input"),
      mmField("leatherStrapMm", "Straps & handles", 0.1, "leather-strap-input"),
    ],
  },
];

/** Read a registry field from a configuration. */
export function readField(configuration: BagConfiguration, key: string): unknown {
  return (configuration as unknown as Record<string, unknown>)[key];
}

/** Return a copy of the configuration with one registry field replaced. */
export function withField(
  configuration: BagConfiguration,
  key: string,
  value: number | boolean | string,
): BagConfiguration {
  return { ...configuration, [key]: value } as BagConfiguration;
}

export const TEMPLATE_DEFINITIONS: Record<TemplateId, TemplateDefinition> = {
  tote: {
    id: "tote",
    label: "Tote",
    description:
      "Front and back panels, a separate bottom, two side gussets, and straps. Optional patch pockets.",
    sections: sectionsFor("tote", ({ num, bool }) => [
      {
        title: "Dimensions",
        fields: [
          num("widthMm", "Width", 5, "width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("depthMm", "Depth", 5, "depth-input"),
        ],
      },
      {
        title: "Straps",
        fields: [
          num("strapWidthMm", "Width", 1, "strap-width-input"),
          num("strapLengthMm", "Length", 10, "strap-length-input"),
        ],
      },
      {
        title: "Pockets",
        fields: [
          bool("interiorPocket", "Interior pocket", "Patch pocket on the lining"),
          bool("exteriorPocket", "Exterior pocket", "Patch pocket on the outside"),
        ],
      },
    ]),
  },
  "zip-pouch": {
    id: "zip-pouch",
    label: "Zip pouch",
    description: "Two identical flat panels joined around the sides and bottom with a top zipper.",
    sections: sectionsFor("zip-pouch", ({ num }) => [
      {
        title: "Bag",
        fields: [
          num("widthMm", "Width", 5, "width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("zipperMarginMm", "Zipper inset", 1, "zipper-margin-input"),
        ],
      },
    ]),
  },
  "boxed-pouch": {
    id: "boxed-pouch",
    label: "Boxed pouch",
    description: "Two flat panels with square corners cut out and sewn to form a standing base.",
    sections: sectionsFor("boxed-pouch", ({ num }) => [
      {
        title: "Bag",
        fields: [
          num("widthMm", "Width", 5, "width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("depthMm", "Depth", 5, "depth-input"),
        ],
      },
    ]),
  },
  "tapered-tote": {
    id: "tapered-tote",
    label: "Tapered tote",
    description: "Trapezoid front and back with one continuous gusset and two folded handles.",
    sections: sectionsFor("tapered-tote", ({ num }) => [
      {
        title: "Bag",
        fields: [
          num("topWidthMm", "Top width", 5, "top-width-input"),
          num("bottomWidthMm", "Bottom width", 5, "bottom-width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("depthMm", "Depth", 5, "depth-input"),
        ],
      },
      {
        title: "Handles",
        fields: [
          num("handleLengthMm", "Length", 10, "handle-length-input"),
          num("handleWidthMm", "Width", 1, "handle-width-input"),
          num("handleInsetMm", "Placement (inset)", 1, "handle-inset-input"),
        ],
      },
    ]),
  },
  drawstring: {
    id: "drawstring",
    label: "Drawstring bag",
    description: "Two body panels with a folded top casing and a threaded cord.",
    sections: sectionsFor("drawstring", ({ num }) => [
      {
        title: "Bag",
        fields: [
          num("widthMm", "Width", 5, "width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("casingMm", "Casing depth", 1, "casing-input"),
        ],
      },
      {
        title: "Drawstring",
        fields: [num("cordLengthMm", "Cord length", 10, "cord-length-input")],
      },
    ]),
  },
  birkin: {
    id: "birkin",
    label: "Birkin-style bag",
    description: "Five-panel box body with a fold-over flap, two sangles, and rolled handles.",
    sections: sectionsFor("birkin", ({ num }) => [
      {
        title: "Bag",
        fields: [
          num("widthMm", "Width", 5, "width-input"),
          num("heightMm", "Height", 5, "height-input"),
          num("depthMm", "Depth", 5, "depth-input"),
        ],
      },
      {
        title: "Flap",
        fields: [
          num("flapHeightMm", "Flap drop", 5, "flap-height-input"),
          num("flapRadiusMm", "Corner radius", 1, "flap-radius-input"),
        ],
      },
      {
        title: "Straps",
        fields: [
          num("strapWidthMm", "Width", 1, "strap-width-input"),
          num("strapInsetMm", "Inset", 1, "strap-inset-input"),
          num("strapLengthMm", "Length", 10, "strap-length-input"),
        ],
      },
      {
        title: "Handles",
        fields: [
          num("handleLengthMm", "Length", 10, "handle-length-input"),
          num("handleDiameterMm", "Tube diameter", 1, "handle-diameter-input"),
          num("handleCoreWidthMm", "Core width", 1, "handle-core-width-input"),
          num("handleInsetMm", "Inset", 1, "handle-inset-input"),
        ],
      },
    ]),
  },
};

export const TEMPLATE_LIST: TemplateDefinition[] = Object.values(TEMPLATE_DEFINITIONS);

export function getTemplateDefinition(template: TemplateId): TemplateDefinition {
  return TEMPLATE_DEFINITIONS[template];
}

export function generatePattern<T extends TemplateId>(configuration: ConfigurationFor<T>): Pattern;
export function generatePattern(configuration: BagConfiguration): Pattern;
export function generatePattern(configuration: BagConfiguration): Pattern {
  switch (configuration.template) {
    case "tote":
      return generateTotePattern(configuration);
    case "zip-pouch":
      return generateZipPouchPattern(configuration);
    case "boxed-pouch":
      return generateBoxedPouchPattern(configuration);
    case "tapered-tote":
      return generateTaperedTotePattern(configuration);
    case "drawstring":
      return generateDrawstringPattern(configuration);
    case "birkin":
      return generateBirkinPattern(configuration);
  }
}
