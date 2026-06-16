"""Shared enums — mirror packages/shared/src/schemas/common.ts."""

from __future__ import annotations

from enum import Enum


class AdNetwork(str, Enum):
    search = "search"
    display = "display"
    youtube = "youtube"


class AdFormat(str, Enum):
    search = "search"
    display = "display"


# Standard Google Display sizes (§5.6). 1200x628 is the authoring size; the
# renderer (Phase 4) fans out to the rest.
DISPLAY_SIZES = (
    "300x250",
    "336x280",
    "728x90",
    "160x600",
    "320x50",
    "300x600",
    "1200x628",
)


class ScaleTier(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TextDensity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
