"""AnalysisObject — mirror packages/shared/src/schemas/analysis-object.ts.

The aggregated REDUCE output. `gap_opportunities` is the strategic payload that
generation (Module 3) builds around.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from gaa_ai.schemas.common import TextDensity


class WinningAngle(BaseModel):
    angle: str
    longevity_weight: float = Field(ge=0.0, le=1.0)
    example_ids: list[str] | None = None


class CreativeNorms(BaseModel):
    faces: float | None = Field(default=None, ge=0.0, le=1.0)
    before_after: float | None = Field(default=None, ge=0.0, le=1.0)
    text_density: TextDensity | None = None


class AnalysisObject(BaseModel):
    vertical: str
    geo: str | None = None

    winning_angles: list[WinningAngle] = Field(default_factory=list)
    saturated_angles: list[str] | None = None
    gap_opportunities: list[str] = Field(default_factory=list)

    common_offers: list[str] | None = None
    cta_patterns: list[str] | None = None
    keyword_seed: list[str] | None = None
    creative_norms: CreativeNorms | None = None
    persona: str | None = None

    source_ad_count: int | None = Field(default=None, ge=0)
    generated_at: str | None = None
