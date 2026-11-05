import { createAnalyzePhotoHandler, createClaudePhotoAnalyzer } from "@/lib/analyze-photo";
import { photoImportAllowed, photoImportEnabled } from "@/lib/photo-flag";
import { currentEmail } from "@/lib/supabase/server";

export const runtime = "nodejs";

const handler = createAnalyzePhotoHandler(() => createClaudePhotoAnalyzer());

export async function POST(request: Request) {
  if (!photoImportEnabled()) {
    return Response.json({ error: "Photo import is disabled." }, { status: 404 });
  }
  const email = await currentEmail();
  if (!photoImportAllowed(email)) {
    return email
      ? Response.json({ error: "Photo import is not available for this account." }, { status: 403 })
      : Response.json({ error: "Sign in to use photo import." }, { status: 401 });
  }
  return handler(request);
}
