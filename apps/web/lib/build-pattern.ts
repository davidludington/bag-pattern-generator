import {
  bagConfigurationSchema,
  generatePattern,
  type BagConfiguration,
  type Pattern,
} from "@bag-patterns/pattern-engine";

export interface BuildResult {
  pattern: Pattern | null;
  errors: string[];
}

/** Validate a draft configuration, then generate its pattern. Never throws. */
export function buildPattern(configuration: BagConfiguration): BuildResult {
  const parsed = bagConfigurationSchema.safeParse(configuration);
  if (!parsed.success) {
    return {
      pattern: null,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }
  try {
    return { pattern: generatePattern(parsed.data), errors: [] };
  } catch (error) {
    return {
      pattern: null,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
