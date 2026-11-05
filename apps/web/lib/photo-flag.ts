/** Photo import costs money per call, so it is opt-in per deployment. */
export const photoImportEnabled = () => process.env.PHOTO_IMPORT_ENABLED === "true";

/**
 * Only the owner's email may spend credits. Fails closed in production: with
 * PHOTO_ALLOWED_EMAIL unset nobody gets in (dev and e2e stay open).
 */
export function photoImportAllowed(email: string | null): boolean {
  if (!photoImportEnabled()) return false;
  const owner = process.env.PHOTO_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!owner) return process.env.NODE_ENV !== "production";
  return email?.toLowerCase() === owner;
}
