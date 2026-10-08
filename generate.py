#!/usr/bin/env python3
"""Generate a printable pattern: python generate.py examples/tote.yaml"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from exporters.svg import export_svg  # noqa: E402
from generators.tote import generate  # noqa: E402
from model.bag import Bag  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__.strip())
    config_path = Path(sys.argv[1])
    bag = Bag.from_yaml(config_path)
    pattern = generate(bag)
    out = Path("output") / f"{bag.name}.svg"
    export_svg(pattern, out)
    print(f"wrote {out} ({len(pattern.pieces)} pieces)")


if __name__ == "__main__":
    main()
