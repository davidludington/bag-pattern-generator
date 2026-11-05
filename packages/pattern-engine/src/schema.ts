import { z } from "zod";

export const MATERIALS = ["leather", "canvas", "denim"] as const;
export type Material = (typeof MATERIALS)[number];

export const TEMPLATE_IDS = [
  "tote",
  "zip-pouch",
  "boxed-pouch",
  "tapered-tote",
  "drawstring",
  "birkin",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * How exposed (unseamed) leather edges are finished. Painted, burnished and
 * raw edges are cut to the finished line; folded edges carry a turn-in.
 */
export const HANDLE_STYLES = ["flat", "rolled"] as const;
export const EDGE_FINISHES = ["painted", "burnished", "raw", "folded"] as const;
export type HandleStyle = (typeof HANDLE_STYLES)[number];
export type EdgeFinish = (typeof EDGE_FINISHES)[number];

/**
 * Leather construction inputs. Present on every configuration so switching
 * material keeps them, but only applied when `material` is "leather".
 * Thickness defaults are mid-range values from the leather construction guide.
 */
const leather = {
  edgeFinish: z.enum(EDGE_FINISHES),
  leatherBodyMm: z.number().min(0.4).max(4),
  leatherBaseMm: z.number().min(0.4).max(4),
  leatherGussetMm: z.number().min(0.4).max(4),
  leatherStrapMm: z.number().min(0.4).max(4),
  turnInMm: z.number().min(4).max(20),
  skiveWidthMm: z.number().min(5).max(30),
  skiveToMm: z.number().min(0.3).max(2),
};

export const LEATHER_DEFAULTS = {
  edgeFinish: "painted",
  leatherBodyMm: 1.1,
  leatherBaseMm: 1.6,
  leatherGussetMm: 0.9,
  leatherStrapMm: 2.2,
  turnInMm: 10,
  skiveWidthMm: 15,
  skiveToMm: 0.8,
} as const satisfies { [K in keyof typeof leather]: z.infer<(typeof leather)[K]> };

/**
 * Engine-facing configuration. All dimensions are finished millimeters.
 * The UI owns the cm -> mm conversion before handing values to the engine.
 */
const common = {
  name: z.string().min(1).max(80),
  material: z.enum(MATERIALS),
  seamAllowanceMm: z.number().min(0).max(50),
  ...leather,
};

export const toteConfigurationSchema = z
  .object({
    template: z.literal("tote"),
    ...common,
    widthMm: z.number().min(100).max(1000),
    heightMm: z.number().min(100).max(1000),
    depthMm: z.number().min(20).max(500),
    strapWidthMm: z.number().min(10).max(100),
    strapLengthMm: z.number().min(200).max(2000),
    strapInsetMm: z.number().min(0).max(500),
    handleStyle: z.enum(HANDLE_STYLES),
    handleDiameterMm: z.number().min(5).max(100),
    interiorPocket: z.boolean(),
    exteriorPocket: z.boolean(),
  })
  .strict();

export const zipPouchConfigurationSchema = z
  .object({
    template: z.literal("zip-pouch"),
    ...common,
    widthMm: z.number().min(50).max(1000),
    heightMm: z.number().min(50).max(1000),
    zipperMarginMm: z.number().min(0).max(500),
  })
  .strict();

export const boxedPouchConfigurationSchema = z
  .object({
    template: z.literal("boxed-pouch"),
    ...common,
    widthMm: z.number().min(50).max(1000),
    heightMm: z.number().min(50).max(1000),
    depthMm: z.number().min(10).max(500),
  })
  .strict();

export const taperedToteConfigurationSchema = z
  .object({
    template: z.literal("tapered-tote"),
    ...common,
    topWidthMm: z.number().min(50).max(1000),
    bottomWidthMm: z.number().min(50).max(1000),
    heightMm: z.number().min(50).max(1000),
    depthMm: z.number().min(10).max(500),
    handleLengthMm: z.number().min(100).max(2000),
    handleWidthMm: z.number().min(10).max(100),
    handleInsetMm: z.number().min(0).max(500),
    handleStyle: z.enum(HANDLE_STYLES),
    handleDiameterMm: z.number().min(5).max(100),
  })
  .strict();

export const drawstringConfigurationSchema = z
  .object({
    template: z.literal("drawstring"),
    ...common,
    widthMm: z.number().min(50).max(1000),
    heightMm: z.number().min(50).max(1000),
    casingMm: z.number().min(5).max(500),
    cordLengthMm: z.number().min(100).max(3000),
  })
  .strict();

export const birkinConfigurationSchema = z
  .object({
    template: z.literal("birkin"),
    ...common,
    widthMm: z.number().min(50).max(1000),
    heightMm: z.number().min(50).max(1000),
    depthMm: z.number().min(10).max(500),
    flapHeightMm: z.number().min(0).max(600),
    flapRadiusMm: z.number().min(0).max(500),
    // strapWidthMm: z.number().min(10).max(100),
    // strapInsetMm: z.number().min(0).max(500),
    // strapLengthMm: z.number().min(50).max(2000),
    handleLengthMm: z.number().min(50).max(2000),
    handleDiameterMm: z.number().min(5).max(100),
    handleCoreWidthMm: z.number().min(5).max(100),
    handleInsetMm: z.number().min(0).max(500),
  })
  .strict();

const baseBagConfigurationSchema = z.discriminatedUnion("template", [
  toteConfigurationSchema,
  zipPouchConfigurationSchema,
  boxedPouchConfigurationSchema,
  taperedToteConfigurationSchema,
  drawstringConfigurationSchema,
  birkinConfigurationSchema,
]);

export const bagConfigurationSchema = baseBagConfigurationSchema.superRefine(
  (configuration, ctx) => {
    if (configuration.material === "leather") {
      const thinnest = Math.min(
        configuration.leatherBodyMm,
        configuration.leatherBaseMm,
        configuration.leatherGussetMm,
        configuration.leatherStrapMm,
      );
      if (configuration.skiveToMm >= thinnest) {
        ctx.addIssue({
          code: "custom",
          path: ["skiveToMm"],
          message: "Skive target must be thinner than the thinnest leather.",
        });
      }
      if (
        configuration.edgeFinish === "folded" &&
        configuration.turnInMm < 2 * configuration.leatherBodyMm
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["turnInMm"],
          message: "Turn-in must be at least twice the body leather thickness.",
        });
      }
    }
    switch (configuration.template) {
      case "zip-pouch":
        if (2 * configuration.zipperMarginMm >= configuration.widthMm) {
          ctx.addIssue({
            code: "custom",
            path: ["zipperMarginMm"],
            message: "Zipper inset must be less than half the width.",
          });
        }
        break;
      case "tote":
        if (2 * configuration.strapInsetMm >= configuration.widthMm) {
          ctx.addIssue({
            code: "custom",
            path: ["strapInsetMm"],
            message: "Strap inset must be less than half the width.",
          });
        }
        break;
      case "tapered-tote":
        if (2 * configuration.handleInsetMm >= configuration.topWidthMm) {
          ctx.addIssue({
            code: "custom",
            path: ["handleInsetMm"],
            message: "Handle inset must be less than half the top width.",
          });
        }
        break;
      case "drawstring":
        if (configuration.casingMm >= configuration.heightMm) {
          ctx.addIssue({
            code: "custom",
            path: ["casingMm"],
            message: "Casing must be smaller than the bag height.",
          });
        }
        break;
      case "birkin": {
        const flapHeight = configuration.depthMm + configuration.flapHeightMm;
        if (configuration.flapRadiusMm > Math.min(configuration.widthMm, flapHeight) / 2) {
          ctx.addIssue({
            code: "custom",
            path: ["flapRadiusMm"],
            message: "Corner radius is too large for the flap.",
          });
        }
        if (configuration.flapHeightMm > configuration.heightMm) {
          ctx.addIssue({
            code: "custom",
            path: ["flapHeightMm"],
            message: "Flap height must be shorter than bag height",
          });
        }
        // if (2 * configuration.strapInsetMm + configuration.strapWidthMm > configuration.widthMm) {
        //   ctx.addIssue({
        //     code: "custom",
        //     path: ["strapInsetMm"],
        //     message: "Strap inset plus width must fit inside the bag width.",
        //   });
        // }
        if (2 * configuration.handleInsetMm >= configuration.widthMm) {
          ctx.addIssue({
            code: "custom",
            path: ["handleInsetMm"],
            message: "Handle inset must be less than half the width.",
          });
        }
        break;
      }
    }
  },
);

export type BagConfiguration = z.infer<typeof baseBagConfigurationSchema>;
export type ConfigurationFor<T extends TemplateId> = Extract<BagConfiguration, { template: T }>;

export type ToteConfiguration = ConfigurationFor<"tote">;
export type ZipPouchConfiguration = ConfigurationFor<"zip-pouch">;
export type BoxedPouchConfiguration = ConfigurationFor<"boxed-pouch">;
export type TaperedToteConfiguration = ConfigurationFor<"tapered-tote">;
export type DrawstringConfiguration = ConfigurationFor<"drawstring">;
export type BirkinConfiguration = ConfigurationFor<"birkin">;

export function defaultToteConfiguration(): ConfigurationFor<"tote"> {
  return {
    template: "tote",
    name: "Tote",
    widthMm: 300,
    heightMm: 250,
    depthMm: 100,
    strapWidthMm: 30,
    strapLengthMm: 600,
    strapInsetMm: 60,
    handleStyle: "flat",
    handleDiameterMm: 20,
    material: "canvas",
    interiorPocket: false,
    exteriorPocket: false,
    seamAllowanceMm: 10,
    ...LEATHER_DEFAULTS,
  };
}

export function defaultConfiguration<T extends TemplateId>(template: T): ConfigurationFor<T>;
export function defaultConfiguration(template: TemplateId): BagConfiguration {
  switch (template) {
    case "tote":
      return defaultToteConfiguration();
    case "zip-pouch":
      return {
        template: "zip-pouch",
        name: "Zip Pouch",
        widthMm: 200,
        heightMm: 150,
        zipperMarginMm: 0,
        material: "canvas",
        seamAllowanceMm: 10,
        ...LEATHER_DEFAULTS,
      };
    case "boxed-pouch":
      return {
        template: "boxed-pouch",
        name: "Boxed Pouch",
        widthMm: 200,
        heightMm: 120,
        depthMm: 80,
        material: "canvas",
        seamAllowanceMm: 10,
        ...LEATHER_DEFAULTS,
      };
    case "tapered-tote":
      return {
        template: "tapered-tote",
        name: "Tapered Tote",
        topWidthMm: 340,
        bottomWidthMm: 260,
        heightMm: 250,
        depthMm: 100,
        handleLengthMm: 600,
        handleWidthMm: 30,
        handleInsetMm: 60,
        handleStyle: "flat",
        handleDiameterMm: 20,
        material: "canvas",
        seamAllowanceMm: 10,
        ...LEATHER_DEFAULTS,
      };
    case "drawstring":
      return {
        template: "drawstring",
        name: "Drawstring Bag",
        widthMm: 200,
        heightMm: 250,
        casingMm: 25,
        cordLengthMm: 700,
        material: "canvas",
        seamAllowanceMm: 10,
        ...LEATHER_DEFAULTS,
      };
    case "birkin":
      return {
        template: "birkin",
        name: "Birkin Bag",
        widthMm: 300,
        heightMm: 240,
        depthMm: 140,
        flapHeightMm: 140,
        flapRadiusMm: 20,
        // strapWidthMm: 30,
        // strapInsetMm: 60,
        // strapLengthMm: 320,
        handleLengthMm: 320,
        handleDiameterMm: 20,
        handleCoreWidthMm: 18,
        handleInsetMm: 60,
        material: "leather",
        // leather stitch setback is 3–5 mm
        seamAllowanceMm: 5,
        ...LEATHER_DEFAULTS,
      };
  }
}
