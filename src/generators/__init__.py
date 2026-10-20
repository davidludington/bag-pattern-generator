"""Generator registry: bag type -> GeneratorSpec.

Add a bag type by creating a module with a ``SPEC`` and listing it here.
"""

from __future__ import annotations

from generators.base import GeneratorSpec
from generators.birkin import SPEC as _BIRKIN
from generators.boxed_pouch import SPEC as _BOXED_POUCH
from generators.drawstring import SPEC as _DRAWSTRING
from generators.tapered_tote import SPEC as _TAPERED_TOTE
from generators.tote import SPEC as _TOTE
from generators.zip_pouch import SPEC as _ZIP_POUCH

REGISTRY: dict[str, GeneratorSpec] = {
    spec.type: spec
    for spec in (_TOTE, _ZIP_POUCH, _BOXED_POUCH, _TAPERED_TOTE, _DRAWSTRING, _BIRKIN)
}


def get(bag_type: str) -> GeneratorSpec:
    try:
        return REGISTRY[bag_type]
    except KeyError:
        known = ", ".join(REGISTRY)
        raise ValueError(
            f"unsupported bag type: {bag_type!r} (known: {known})"
        ) from None


def schemas() -> list[dict]:
    return [spec.schema() for spec in REGISTRY.values()]
