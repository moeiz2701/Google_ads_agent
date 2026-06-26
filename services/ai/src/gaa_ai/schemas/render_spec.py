"""RenderSpec — mirror packages/shared/src/schemas/render-spec.ts.

The per-variant artifact the LLM emits. Deterministic code (the Node renderer,
Phase 4) turns it into the actual creative; the LLM never freehands layout.
Discriminated on `format`. Every variant ties back to an `angle` (the insight/gap
it exploits) — a variant not tied to an insight is not done (CLAUDE.md).
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

# RSA limits (Google): up to 15 headlines (≤30 chars), 4 descriptions (≤90 chars).
HEADLINE_MAX = 30
DESCRIPTION_MAX = 90


class ImageSpec(BaseModel):
    source: Literal["stock", "client", "stock_or_client"]
    query: str | None = None
    url: str | None = None


# Deterministic image treatments the renderer applies (mirror render-spec.ts
# IMAGE_TREATMENTS). Kept as a plain str on the model (lenient parse, like
# template_id); generation coerces an unknown value to "none" before validation.
IMAGE_TREATMENTS: tuple[str, ...] = ("none", "scrim", "brand_wash")


class DisplayRenderSpec(BaseModel):
    format: Literal["display"] = "display"
    template_id: str
    size: str = "1200x628"
    headline: str
    subhead: str | None = None
    cta: str
    palette_ref: str | None = None
    image: ImageSpec | None = None
    image_treatment: str = "none"
    angle: str


class RsaHeadline(BaseModel):
    text: str = Field(max_length=HEADLINE_MAX)
    pin: Literal[1, 2, 3] | None = None


class RsaDescription(BaseModel):
    text: str = Field(max_length=DESCRIPTION_MAX)
    pin: Literal[1, 2] | None = None


class SearchRenderSpec(BaseModel):
    format: Literal["search"] = "search"
    headlines: list[RsaHeadline] = Field(min_length=3, max_length=15)
    descriptions: list[RsaDescription] = Field(min_length=2, max_length=4)
    paths: tuple[str | None, str | None] | None = None
    angle: str


RenderSpec = Annotated[
    DisplayRenderSpec | SearchRenderSpec,
    Field(discriminator="format"),
]
