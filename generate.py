#!/usr/bin/env python3
"""Generate a printable pattern: python generate.py examples/tote.yaml

The YAML has a `type`, an optional `name`/`seam_allowance`, and a flat
`parameters` mapping whose keys come from `GET /api/types`.
"""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from exporters.svg import export_svg  # noqa: E402
from generators import get  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__.strip())
    config_path = Path(sys.argv[1])
    data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        sys.exit(f"{config_path}: expected a YAML mapping")

    gen = get(data.get("type", "tote"))
    params = dict(data.get("parameters") or {})
    params["seam_allowance"] = data.get("seam_allowance", 10)
    if data.get("name"):
        params["name"] = data["name"]

    pattern = gen.generate(gen.resolve(params))
    out = Path("output") / f"{pattern.name}.svg"
    export_svg(pattern, out)
    print(f"wrote {out} ({len(pattern.pieces)} pieces)")


if __name__ == "__main__":
    main()
