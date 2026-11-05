import { afterEach, describe, expect, it, vi } from "vitest";
import { photoImportAllowed } from "./photo-flag";

describe("photoImportAllowed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lets only the owner's email in, ignoring case", () => {
    vi.stubEnv("PHOTO_IMPORT_ENABLED", "true");
    vi.stubEnv("PHOTO_ALLOWED_EMAIL", "Me@Example.com");
    expect(photoImportAllowed("me@example.com")).toBe(true);
    expect(photoImportAllowed("other@example.com")).toBe(false);
    expect(photoImportAllowed(null)).toBe(false);
  });

  it("fails closed in production when no owner is configured", () => {
    vi.stubEnv("PHOTO_IMPORT_ENABLED", "true");
    vi.stubEnv("PHOTO_ALLOWED_EMAIL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(photoImportAllowed("me@example.com")).toBe(false);
  });

  it("is off unless the deployment opts in", () => {
    vi.stubEnv("PHOTO_IMPORT_ENABLED", "");
    vi.stubEnv("PHOTO_ALLOWED_EMAIL", "me@example.com");
    expect(photoImportAllowed("me@example.com")).toBe(false);
  });
});
