#!/usr/bin/env python3
"""Local pattern API + static server.

    python api.py          # http://localhost:8000

POST /api/pattern     BagSpec JSON -> pattern model JSON
POST /api/export.svg   BagSpec JSON -> printable sheet SVG
GET  anything          serves web/dist (run `npm run build` in web/ first)

In development, run the Vite dev server instead (it proxies /api here):

    cd web && npm run dev
"""

from __future__ import annotations

import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from exporters.pattern_json import pattern_to_dict  # noqa: E402
from exporters.svg import render_svg  # noqa: E402
from generators.tote import generate  # noqa: E402
from model.bag import Bag  # noqa: E402

HOST = "127.0.0.1"
PORT = 8000


def spec_to_config(spec: dict) -> dict:
    """Map the frontend BagSpec (camelCase) to the internal config shape."""
    bag_type = spec.get("type", "tote")
    if bag_type != "tote":
        raise ValueError(f"unsupported bag type: {bag_type!r} (only 'tote' exists)")
    dims = spec.get("dimensions") or {}
    construction = spec.get("construction") or {}
    handles = spec.get("handles") or {}
    for key in ("width", "height", "depth"):
        if key not in dims:
            raise ValueError(f"missing dimensions.{key}")
    return {
        "name": spec.get("name") or bag_type,
        "bag": dims,
        "construction": {"seam_allowance": construction.get("seamAllowance", 10)},
        "handles": {
            "length": handles.get("length", 600),
            "width": handles.get("width", 30),
            "inset": handles.get("placement", 60),
        },
    }


def build_pattern(spec: dict) -> dict:
    bag = Bag.from_dict(spec_to_config(spec))
    return pattern_to_dict(generate(bag))


def build_svg(spec: dict) -> str:
    bag = Bag.from_dict(spec_to_config(spec))
    return render_svg(generate(bag))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web" / "dist"), **kwargs)

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
            else:
                payload, status, ctype = (
                    json.dumps({"error": f"not found: {self.path}"}).encode(),
                    404,
                    "application/json",
                )
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            payload, status, ctype = (
                json.dumps({"error": str(exc)}).encode(),
                400,
                "application/json",
            )
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    dist = ROOT / "web" / "dist"
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"pattern API on http://{HOST}:{PORT}")
    if (dist / "index.html").exists():
        print(f"studio:  http://{HOST}:{PORT}/")
    else:
        print("studio:  run `cd web && npm install && npm run dev` (http://localhost:5173)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
