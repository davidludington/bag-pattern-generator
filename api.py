#!/usr/bin/env python3
"""Legacy local pattern API (frozen — the Next.js app in apps/web is primary).

    python api.py          # http://localhost:8000

Environment: put OPENAI_API_KEY (and anything else) in a .env file next to
this script — plain KEY=VALUE lines, # comments allowed, existing variables win.

POST /api/pattern     BagSpec JSON -> pattern model JSON
POST /api/export.svg   BagSpec JSON -> printable sheet SVG
POST /api/infer        {"image": data URL} -> {type, parameters} (needs OPENAI_API_KEY)
GET  /api/types        -> the parameter schema for every bag type
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from exporters.pattern_json import pattern_to_dict  # noqa: E402
from exporters.svg import render_svg  # noqa: E402
from generators import get, schemas  # noqa: E402
from infer import InferenceError, infer_bag  # noqa: E402

HOST = "127.0.0.1"
PORT = 8000


def load_env(path: Path = ROOT / ".env") -> None:
    """Load KEY=VALUE lines from .env; variables already set win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def spec_params(spec: dict) -> tuple:
    """Look up the generator and resolve its parameters from the spec."""
    gen = get(spec.get("type", "tote"))
    params = dict(spec.get("parameters") or {})
    params["seam_allowance"] = spec.get("seamAllowance", 10)
    if spec.get("name"):
        params["name"] = spec["name"]
    return gen, gen.resolve(params)


def build_pattern(spec: dict) -> dict:
    gen, params = spec_params(spec)
    return pattern_to_dict(gen.generate(params))


def build_svg(spec: dict) -> str:
    gen, params = spec_params(spec)
    return render_svg(gen.generate(params))


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: bytes, status: int, ctype: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, obj: dict, status: int = 200) -> None:
        self._send(json.dumps(obj).encode(), status, "application/json")

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/types":
            self._send_json({"types": schemas()})
            return
        self._send_json({"error": f"not found: {self.path}"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length") or 0)
            spec = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/pattern":
                payload, status, ctype = (
                    json.dumps(build_pattern(spec)).encode(),
                    200,
                    "application/json",
                )
            elif self.path == "/api/export.svg":
                payload, status, ctype = (
                    build_svg(spec).encode(),
                    200,
                    "image/svg+xml",
                )
            elif self.path == "/api/infer":
                payload, status, ctype = (
                    json.dumps(infer_bag(str(spec.get("image") or ""))).encode(),
                    200,
                    "application/json",
                )
            else:
                payload, status, ctype = (
                    json.dumps({"error": f"not found: {self.path}"}).encode(),
                    404,
                    "application/json",
                )
        except InferenceError as exc:
            payload, status, ctype = (
                json.dumps({"error": str(exc)}).encode(),
                502,
                "application/json",
            )
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            payload, status, ctype = (
                json.dumps({"error": str(exc)}).encode(),
                400,
                "application/json",
            )
        self._send(payload, status, ctype)


def main() -> None:
    load_env()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"pattern API on http://{HOST}:{PORT}")
    if not os.environ.get("OPENAI_API_KEY"):
        print("image inference: disabled — set OPENAI_API_KEY in .env")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
