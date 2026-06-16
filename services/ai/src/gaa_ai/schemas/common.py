"""Shared enums — mirror packages/shared/src/schemas/common.ts."""

from __future__ import annotations

from enum import Enum


class AdNetwork(str, Enum):
    search = "search"
    display = "display"
    youtube = "youtube"


class ScaleTier(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TextDensity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
