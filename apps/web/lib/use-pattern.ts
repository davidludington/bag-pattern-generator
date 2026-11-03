"use client";

import type { BagConfiguration, Pattern } from "@bag-patterns/pattern-engine";
import { useMemo } from "react";
import { buildPattern } from "./build-pattern";

/** Validate a draft configuration and generate its pattern. */
export function usePattern(configuration: BagConfiguration | null): {
  pattern: Pattern | null;
  errors: string[];
} {
  return useMemo(
    () => (configuration ? buildPattern(configuration) : { pattern: null, errors: [] }),
    [configuration],
  );
}
