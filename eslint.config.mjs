import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const webFiles = ["apps/web/**/*.{ts,tsx,js,mjs}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "apps/web/next-env.d.ts",
      ".venv/**",
      "venv/**",
      "output/**",
      ".opencode/**",
    ],
  },
  // Pattern engine: framework-free TypeScript.
  {
    files: ["packages/**/*.ts"],
    extends: [tseslint.configs.recommended],
  },
  // Web app: Next.js rules (React, hooks, a11y, core web vitals) + TypeScript.
  ...[...nextVitals, ...nextTs].map((config) => ({
    ...config,
    files: config.files ?? webFiles,
    settings: { ...config.settings, next: { rootDir: "apps/web" } },
  })),
  {
    files: ["packages/**/*.ts", "apps/web/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  prettier,
);
