import { createAnalyzePhotoHandler, createClaudePhotoAnalyzer } from "@/lib/analyze-photo";

export const runtime = "nodejs";

export const POST = createAnalyzePhotoHandler(() => createClaudePhotoAnalyzer());
