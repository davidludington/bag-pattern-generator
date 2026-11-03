"""Image -> bag type + dimensions.

One vision LLM call picks which registered generator fits a photo and estimates
finished dimensions. No geometry is computed here: the result is a plain
``{type, parameters}`` spec, validated through the normal schema pipeline, that
the UI loads like any other spec.
"""

from __future__ import annotations

import json
import math
import os
import urllib.error
import urllib.request

from generators import REGISTRY, schemas
from generators.base import SHARED

API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

# one line per type so the model can tell near-identical shapes apart;
# types added later fall back to their schema label
DESCRIPTIONS = {
    "tote": "Open-top rectangular tote with a continuous gusset (sides + bottom) and two flat handles",
    "tapered-tote": "Tote that is wider at the top than the bottom, with a gusset and two handles",
    "zip-pouch": "Flat rectangular pouch closed by a zipper across the top",
    "boxed-pouch": "Small rectangular pouch with boxed corners giving it depth",
    "drawstring": "Soft sack gathered by a drawcord around a casing at the top",
    "birkin": "Structured handbag with a front flap, rigid top handle and a gusseted body",
}


class InferenceError(Exception):
    """The model call or its answer could not be used."""


def _catalogue() -> str:
    lines = []
    for s in schemas():
        desc = DESCRIPTIONS.get(s["type"], s["label"])
        lines.append(f"- {s['type']}: {s['label']} — {desc}")
        for section in s["sections"]:
            for f in section["fields"]:
                lines.append(
                    f"    {f['key']} — default {f['default']}, min {f['min']} {f['unit']}"
                )
    return "\n".join(lines)


def _prompt() -> str:
    return f"""You are matching a photo of a bag to one of the bag pattern generators below,
then estimating its finished dimensions in millimeters.

Generators and their parameters:
{_catalogue()}

Reply with a single JSON object and nothing else:
{{"type": "<one of the generator types above>", "parameters": {{"<param key>": <number>}}}}

Rules:
- "type" must be exactly one of the generator types listed.
- "parameters" holds only the keys listed for that type. Omit any you are
  unsure about; omitted keys keep their default.
- Dimensions are FINISHED millimeters of the real bag shown, not of the photo.
  Judge from typical real-world bag sizes.
- Every value must be a positive number satisfying that type's minimums and
  its limits (for example depth must fit inside width where the type says so).
- The photo may show a bag that matches no generator; still pick the closest one.
"""


def _chat(key: str, image: str, prompt: str) -> dict:
    body = json.dumps(
        {
            "model": MODEL,
            "response_format": {"type": "json_object"},
            "max_tokens": 400,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image}},
                    ],
                }
            ],
        }
    )
    req = urllib.request.Request(
        API_URL,
        data=body.encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data = json.loads(res.read())
        return json.loads(data["choices"][0]["message"]["content"])
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        raise InferenceError(f"OpenAI request failed ({exc.code}): {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise InferenceError(f"OpenAI request failed: {exc}") from exc
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise InferenceError(f"unexpected reply from OpenAI: {exc}") from exc


def _clean_params(bag_type: str, raw: object) -> dict:
    """Keep known numeric keys for this type, clamped to their minimums."""
    schema = next(s for s in schemas() if s["type"] == bag_type)
    limits = {
        f["key"]: f["min"] for section in schema["sections"] for f in section["fields"]
    }
    out: dict[str, float] = {}
    if not isinstance(raw, dict):
        return out
    for key, value in raw.items():
        if key not in limits or key in SHARED:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(number):
            continue
        out[key] = max(number, limits[key])
    return out


def infer_bag(image: str) -> dict:
    """Photo (data URL) -> ``{type, parameters}`` ready for the UI to load."""
    if not image.startswith("data:image/"):
        raise ValueError("expected an image as a data URL")
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise InferenceError(
            "OPENAI_API_KEY is not set — image inference is unavailable"
        )

    prompt = _prompt()
    note = ""
    gen, resolved = None, {}
    for _ in range(2):
        raw = _chat(key, image, prompt + note)
        if not isinstance(raw, dict) or raw.get("type") not in REGISTRY:
            raise InferenceError(
                f"model chose an unknown bag type: {raw.get('type')!r}"
                if isinstance(raw, dict)
                else "model did not return an object"
            )
        gen = REGISTRY[raw["type"]]
        resolved = gen.resolve(_clean_params(gen.type, raw.get("parameters")))
        try:
            gen.generate(resolved)
        except ValueError as exc:
            # dimensions contradicted the type's fit rules; ask once more,
            # and if that fails too the defaults below stand
            resolved = gen.resolve({})
            note = (
                f"\n\nYour previous answer was rejected: {exc}. "
                "Reply again with dimensions that satisfy every limit."
            )
            continue
        break
    # a rejected second attempt keeps the type and falls back to default sizes
    return {
        "type": gen.type,
        "parameters": {k: v for k, v in resolved.items() if k not in SHARED},
    }
