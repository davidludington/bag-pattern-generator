"""Tote parameters: finished dimensions in millimeters."""

from __future__ import annotations

from dataclasses import dataclass


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
    def from_params(cls, params: dict) -> "Bag":
        """Build from a flat resolved parameter dict (see generators.base)."""
        return cls(
            width=float(params["width"]),
            height=float(params["height"]),
            depth=float(params["depth"]),
            seam_allowance=float(params.get("seam_allowance", 10.0)),
            handle_length=float(params.get("handle_length", 600.0)),
            handle_width=float(params.get("handle_width", 30.0)),
            handle_inset=float(params.get("handle_inset", 60.0)),
            name=str(params.get("name") or "tote"),
        )

    def validate(self) -> None:
        positive = (
            "width",
            "height",
            "depth",
            "handle_length",
            "handle_width",
        )
        for field in positive:
            if getattr(self, field) <= 0:
                raise ValueError(
                    f"{field} must be positive, got {getattr(self, field)}"
                )
        if self.seam_allowance < 0:
            raise ValueError(
                f"seam_allowance must be >= 0, got {self.seam_allowance}"
            )
        if self.handle_inset < 0:
            raise ValueError("handle_inset must be >= 0")
        if 2 * self.handle_inset >= self.width:
            raise ValueError(
                f"handle_inset {self.handle_inset} too large for bag width {self.width}"
            )
