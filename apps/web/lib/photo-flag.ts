/** Photo import costs money per call, so it is opt-in per deployment. */
export const photoImportEnabled = () => process.env.PHOTO_IMPORT_ENABLED === "true";
