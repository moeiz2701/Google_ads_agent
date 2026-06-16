"""Pydantic mirrors of the TS schema backbone (packages/shared).

Keep these in lockstep with the Zod definitions. Every field nullable so missing
scraped data degrades gracefully (§10).
"""

from gaa_ai.schemas.analysis import AnalysisObject, CreativeNorms, WinningAngle
from gaa_ai.schemas.client import AnalysisInput, ClientContext
from gaa_ai.schemas.common import AdNetwork, ScaleTier, TextDensity
from gaa_ai.schemas.enriched_ad import (
    CreativeAttributes,
    EnrichedAdRecord,
    RawAd,
)

__all__ = [
    "AdNetwork",
    "ScaleTier",
    "TextDensity",
    "RawAd",
    "CreativeAttributes",
    "EnrichedAdRecord",
    "WinningAngle",
    "CreativeNorms",
    "AnalysisObject",
    "ClientContext",
    "AnalysisInput",
]
