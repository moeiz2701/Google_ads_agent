"""EnrichedAdRecord + RawAd — mirror packages/shared/src/schemas/enriched-ad.ts.

RawAd is what a scraper returns (pre-enrichment). EnrichedAdRecord is the per-ad
output of the MAP step. Every enriched field is Optional — scraped data is
frequently incomplete and must degrade gracefully (§4.3 reliability note).
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from gaa_ai.schemas.common import AdNetwork, ScaleTier, TextDensity


class RawAd(BaseModel):
    """Pre-enrichment ad as returned by a scraper / fixture."""

    model_config = ConfigDict(extra="ignore")

    ad_id: str
    advertiser: str | None = None
    source: Literal["google_transparency", "serpapi", "meta", "cached"] | None = None
    format: Literal["search", "display", "video", "unknown"] | None = None
    headline: str | None = None
    body: str | None = None
    image_url: str | None = None
    landing_url: str | None = None
    first_shown: date | None = None
    last_shown: date | None = None
    still_active: bool | None = None
    variant_count: int | None = None
    impressions_bucket: str | None = None
    regions: list[str] | None = None


class CreativeAttributes(BaseModel):
    """Display-only design-language attributes (vision-tagged)."""

    faces: bool | None = None
    before_after: bool | None = None
    product_vs_lifestyle: Literal["product", "lifestyle", "mixed"] | None = None
    text_density: TextDensity | None = None
    tone: str | None = None
    dominant_colors: list[str] | None = None


class EnrichedAdRecord(BaseModel):
    ad_id: str
    advertiser: str | None = None
    source: Literal["google_transparency", "serpapi", "meta", "cached"] | None = None

    format: Literal["search", "display", "video", "unknown"] | None = None
    headline: str | None = None
    body: str | None = None
    image_url: str | None = None
    landing_url: str | None = None

    # Performance-proxy signals (derived).
    first_shown: date | None = None
    last_shown: date | None = None
    days_running: int | None = Field(default=None, ge=0)
    still_active: bool | None = None
    variant_count: int | None = Field(default=None, ge=0)
    scale_tier: ScaleTier | None = None

    # Offer & pricing.
    offer_type: str | None = None
    price_points: list[str] | None = None
    promotion_cadence: str | None = None

    # Messaging & angle.
    primary_value_prop: str | None = None
    emotional_hook: str | None = None
    implied_persona: str | None = None
    claims: list[str] | None = None
    cta_verb: str | None = None

    # Keyword & targeting.
    repeated_phrases: list[str] | None = None
    regions: list[str] | None = None
    platforms: list[AdNetwork] | None = None

    # Creative / design language (Display).
    creative: CreativeAttributes | None = None
