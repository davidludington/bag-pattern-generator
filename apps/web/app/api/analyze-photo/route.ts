import { createAnalyzePhotoHandler, createClaudePhotoAnalyzer } from "@/lib/analyze-photo";
import { photoImportEnabled } from "@/lib/photo-flag";

export const runtime = "nodejs";

const handler = createAnalyzePhotoHandler(() => createClaudePhotoAnalyzer());

export const POST = (request: Request) =>
  photoImportEnabled()
    ? handler(request)
    : Response.json({ error: "Photo import is disabled." }, { status: 404 });
