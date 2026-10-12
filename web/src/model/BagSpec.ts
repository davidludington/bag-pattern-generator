export type BagSpec = {
  type: "tote";
  name?: string;
  dimensions: { width: number; height: number; depth: number };
  construction: { seamAllowance: number };
  handles: { length: number; width: number; placement: number };
};

export const DEFAULT_BAG: BagSpec = {
  type: "tote",
  dimensions: { width: 300, height: 250, depth: 100 },
  construction: { seamAllowance: 10 },
  handles: { length: 600, width: 30, placement: 60 },
};

export type SpecField =
  | "width"
  | "height"
  | "depth"
  | "seamAllowance"
  | "handleLength"
  | "handleWidth"
  | "placement";

export function applyField(spec: BagSpec, field: SpecField, value: number): BagSpec {
  switch (field) {
    case "width":
    case "height":
    case "depth":
      return { ...spec, dimensions: { ...spec.dimensions, [field]: value } };
    case "seamAllowance":
      return { ...spec, construction: { ...spec.construction, seamAllowance: value } };
    case "handleLength":
    case "handleWidth":
    case "placement": {
      const key: keyof BagSpec["handles"] =
        field === "handleLength" ? "length" : field === "handleWidth" ? "width" : "placement";
      return { ...spec, handles: { ...spec.handles, [key]: value } };
    }
  }
}
