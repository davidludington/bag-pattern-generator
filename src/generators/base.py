"""Generator registry types.

Each bag type is a self-describing ``GeneratorSpec``: a parameter schema the
UI renders plus a ``generate(params) -> Pattern`` callable. Shared parameters
(``name``, ``seam_allowance``) live outside the per-type schema.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from model.pattern import Pattern

SHARED = ("name", "seam_allowance")


@dataclass(frozen=True)
class Field:
    """One numeric parameter in a type's schema."""

    key: str
    label: str
    default: float
    min: float = 1.0
    unit: str = "mm"
    # piece ids this parameter affects; empty means every piece
    affects: tuple[str, ...] = ()


@dataclass(frozen=True)
class Section:
    title: str
    fields: tuple[Field, ...]


@dataclass(frozen=True)
class GeneratorSpec:
    type: str
    label: str
    sections: tuple[Section, ...]
    generate: Callable[[dict], Pattern]

    def default_params(self) -> dict:
        return {
            f.key: f.default for section in self.sections for f in section.fields
        }

    def resolve(self, params: dict | None) -> dict:
        """Fill schema defaults, coerce numbers, pull in shared params."""
        params = params or {}
        out = self.default_params()
        unknown = set(params) - set(out) - set(SHARED)
        if unknown:
            raise ValueError(
                f"{self.type}: unknown parameter(s): {', '.join(sorted(unknown))}"
            )
        for key in out:
            if key in params:
                out[key] = float(params[key])
        out["name"] = str(params.get("name") or self.type)
        out["seam_allowance"] = float(params.get("seam_allowance", 10.0))
        return out

    def schema(self) -> dict:
        return {
            "type": self.type,
            "label": self.label,
            "sections": [
                {
                    "title": section.title,
                    "fields": [
                        {
                            "key": f.key,
                            "label": f.label,
                            "default": f.default,
                            "min": f.min,
                            "unit": f.unit,
                            "affects": list(f.affects),
                        }
                        for f in section.fields
                    ],
                }
                for section in self.sections
            ],
        }
