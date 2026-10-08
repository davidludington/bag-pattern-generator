"""Bag domain model: finished dimensions loaded from YAML config."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class Bag:
    """A bag described by FINISHED dimensions, in millimeters."""

    width: float
    height: float
    depth: float
    seam_allowance: float = 10.0
    handle_length: float = 600.0
    handle_width: float = 30.0
    handle_inset: float = 60.0
    name: str = "tote"

    def __post_init__(self) -> None:
        self.validate()

    @classmethod
    def from_dict(cls, data: dict) -> "Bag":
        bag = data.get("bag") or {}
        construction = data.get("construction") or {}
        handles = data.get("handles") or {}
        for key in ("width", "height", "depth"):
            if key not in bag:
                raise ValueError(f"config missing bag.{key}")
        result = cls(
            width=float(bag["width"]),
            height=float(bag["height"]),
            depth=float(bag["depth"]),
            seam_allowance=float(construction.get("seam_allowance", 10.0)),
            handle_length=float(handles.get("length", 600.0)),
            handle_width=float(handles.get("width", 30.0)),
            handle_inset=float(handles.get("inset", 60.0)),
            name=str(data.get("name") or "tote"),
        )
        return result

    @classmethod
    def from_yaml(cls, path: str | Path) -> "Bag":
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError(f"{path}: expected a YAML mapping")
        return cls.from_dict(data)

    def validate(self) -> None:
        positive = (
            "width",
            "height",
            "depth",
            "seam_allowance",
            "handle_length",
            "handle_width",
        )
        for field in positive:
            if getattr(self, field) <= 0:
                raise ValueError(f"{field} must be positive, got {getattr(self, field)}")
        if self.handle_inset < 0:
            raise ValueError("handle_inset must be >= 0")
        if 2 * self.handle_inset >= self.width:
            raise ValueError(
                f"handle_inset {self.handle_inset} too large for bag width {self.width}"
            )
