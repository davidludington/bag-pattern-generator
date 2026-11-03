import Anthropic from "@anthropic-ai/sdk";
import type { BagObservation } from "@bag-patterns/pattern-engine";
import { describe, expect, it, vi } from "vitest";
import {
  createAnalyzePhotoHandler,
  createClaudePhotoAnalyzer,
  MAX_PHOTO_BYTES,
  type PhotoAnalyzer,
} from "./analyze-photo";

const observation: BagObservation = {
  template: "tote",
  confidence: "high",
  proportions: { width: 4, height: 3.5, depth: 1.2 },
  bottomToTopWidth: null,
  strapDropToHeight: 1.8,
  material: "canvas",
  exteriorPocket: false,
  closure: "open",
  visiblePanels: ["front"],
  notes: [],
};

function upload(file?: File): Request {
  const form = new FormData();
  if (file) form.append("image", file);
  return new Request("http://localhost/api/analyze-photo", { method: "POST", body: form });
}

const png = (bytes = 8) => new File([new Uint8Array(bytes)], "bag.png", { type: "image/png" });

describe("analyze-photo handler", () => {
  const ok: PhotoAnalyzer = async () => ({ ok: true, observation });

  it("rejects requests without an image", async () => {
    const response = await createAnalyzePhotoHandler(() => ok)(upload());
    expect(response.status).toBe(400);
  });

  it("rejects unsupported file types and oversized images", async () => {
    const handler = createAnalyzePhotoHandler(() => ok);
    const text = new File(["hi"], "bag.txt", { type: "text/plain" });
    expect((await handler(upload(text))).status).toBe(415);
    expect((await handler(upload(png(MAX_PHOTO_BYTES + 1)))).status).toBe(413);
  });

  it("sends the image as base64 and returns the observation", async () => {
    const analyze = vi.fn(ok);
    const response = await createAnalyzePhotoHandler(() => analyze)(upload(png(3)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ observation });
    expect(analyze).toHaveBeenCalledWith({ data: "AAAA", mediaType: "image/png" });
  });

  it("passes analyzer failures through with their status", async () => {
    const refused: PhotoAnalyzer = async () => ({ ok: false, status: 422, error: "nope" });
    const response = await createAnalyzePhotoHandler(() => refused)(upload(png()));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "nope" });
  });

  it("rejects model output that does not match the schema", async () => {
    const bad: PhotoAnalyzer = async () => ({
      ok: true,
      observation: { ...observation, template: "backpack" } as unknown as BagObservation,
    });
    expect((await createAnalyzePhotoHandler(() => bad)(upload(png()))).status).toBe(502);
  });
});

describe("Claude photo analyzer", () => {
  function fakeClient(parse: (params: unknown) => Promise<unknown>): Anthropic {
    return { beta: { messages: { parse } } } as unknown as Anthropic;
  }

  it("requests structured output for the image with refusal fallbacks", async () => {
    const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: observation }));
    const result = await createClaudePhotoAnalyzer(fakeClient(parse))({
      data: "AAAA",
      mediaType: "image/png",
    });
    expect(result).toEqual({ ok: true, observation });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5-5",
        fallbacks: "default",
        betas: ["server-side-fallback-2026-07-01"],
        messages: [
          expect.objectContaining({
            content: expect.arrayContaining([
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: "AAAA" },
              },
            ]),
          }),
        ],
      }),
    );
  });

  it("maps a refusal to a 422", async () => {
    const parse = async () => ({ stop_reason: "refusal", parsed_output: null });
    const result = await createClaudePhotoAnalyzer(fakeClient(parse))({
      data: "AAAA",
      mediaType: "image/png",
    });
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("maps a truncated response to a 502", async () => {
    const parse = async () => ({ stop_reason: "max_tokens", parsed_output: null });
    const result = await createClaudePhotoAnalyzer(fakeClient(parse))({
      data: "AAAA",
      mediaType: "image/png",
    });
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("maps a connection failure to a 502", async () => {
    const parse = async () => {
      throw new Anthropic.APIConnectionError({ message: "offline" });
    };
    const result = await createClaudePhotoAnalyzer(fakeClient(parse))({
      data: "AAAA",
      mediaType: "image/png",
    });
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
