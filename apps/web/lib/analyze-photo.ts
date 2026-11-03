import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  bagObservationSchema,
  TEMPLATE_LIST,
  type BagObservation,
} from "@bag-patterns/pattern-engine";

export const PHOTO_MODEL = "claude-opus-5-5";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];

export interface Photo {
  data: string;
  mediaType: PhotoMediaType;
}

export type AnalyzeResult =
  { ok: true; observation: BagObservation } | { ok: false; status: number; error: string };

export type PhotoAnalyzer = (photo: Photo) => Promise<AnalyzeResult>;

const SYSTEM_PROMPT = `You look at a photo of a bag and describe how it is constructed so a sewing pattern can be drafted for it.

Pick the closest of these supported templates:
${TEMPLATE_LIST.map((template) => `- ${template.id}: ${template.label}. ${template.description}`).join("\n")}

Report proportions as relative sizes of the finished bag body (handles excluded). Estimate them from the photo, correcting for perspective where you can. You cannot know real sizes; the user provides one measurement afterwards. Put construction details, and anything you are unsure about, in notes. Report only what the photo supports: if the bag is not one of the templates, choose the nearest and say so in notes.`;

/** Ask Claude to describe the bag in a photo as a structured observation. */
export function createClaudePhotoAnalyzer(client: Anthropic = new Anthropic()): PhotoAnalyzer {
  return async (photo) => {
    try {
      const message = await client.beta.messages.parse({
        model: PHOTO_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: betaZodOutputFormat(bagObservationSchema) },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: photo.mediaType, data: photo.data },
              },
              { type: "text", text: "Describe this bag's construction." },
            ],
          },
        ],
      });

      if (message.stop_reason === "refusal") {
        return {
          ok: false,
          status: 422,
          error: "This photo could not be analysed. Try another photo.",
        };
      }
      if (message.stop_reason === "max_tokens" || !message.parsed_output) {
        return {
          ok: false,
          status: 502,
          error: "The analysis came back incomplete. Please try again.",
        };
      }
      return { ok: true, observation: message.parsed_output };
    } catch (error) {
      return { ok: false, ...describeError(error) };
    }
  };
}

function describeError(error: unknown): { status: number; error: string } {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return { status: 503, error: "Photo import is not configured: check ANTHROPIC_API_KEY." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, error: "Too many requests. Wait a moment and try again." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 400, error: "The photo was rejected. Try a smaller JPEG or PNG." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 502, error: "Could not reach the analysis service." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, error: "The analysis service failed. Please try again." };
  }
  if (error instanceof Anthropic.AnthropicError) {
    // e.g. no credentials configured when the client was created
    return { status: 503, error: "Photo import is not configured: check ANTHROPIC_API_KEY." };
  }
  throw error;
}

function isPhotoMediaType(value: string): value is PhotoMediaType {
  return (PHOTO_MEDIA_TYPES as readonly string[]).includes(value);
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * POST handler: multipart form with an `image` file -> `{ observation }`.
 * The analyzer is created lazily so a missing key fails per request, not at import.
 */
export function createAnalyzePhotoHandler(getAnalyzer: () => PhotoAnalyzer) {
  return async function POST(request: Request): Promise<Response> {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Expected a multipart form with an image." }, 400);
    }
    const file = form.get("image");
    if (!(file instanceof File)) return json({ error: "Attach an image." }, 400);
    if (!isPhotoMediaType(file.type)) {
      return json({ error: "Use a JPEG, PNG, WebP, or GIF image." }, 415);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return json({ error: "Images must be 5 MB or smaller." }, 413);
    }

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    let analyzer: PhotoAnalyzer;
    try {
      analyzer = getAnalyzer();
    } catch (error) {
      return json(describeError(error), 503);
    }
    const result = await analyzer({ data, mediaType: file.type });
    if (!result.ok) return json({ error: result.error }, result.status);

    // Never trust model output blindly: validate again at the boundary.
    const observation = bagObservationSchema.safeParse(result.observation);
    if (!observation.success) {
      return json({ error: "The analysis did not match the expected format." }, 502);
    }
    return json({ observation: observation.data });
  };
}
