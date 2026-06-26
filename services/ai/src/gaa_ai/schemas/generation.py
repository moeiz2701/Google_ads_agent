"""Generation IO schemas (Module 3).

Input: client context + analysis + a compact style spec (from the brand kit).
Output: scored variants, each a validated RenderSpec tied to an insight/gap.
The critique/scoring pass (§5.5) gates variants before they are returned.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from gaa_ai.schemas.analysis import AnalysisObject
from gaa_ai.schemas.client import ClientContext
from gaa_ai.schemas.common import AdFormat
from gaa_ai.schemas.render_spec import RenderSpec


class StyleSpec(BaseModel):
    """Compact, brand-kit-derived style spec fed to generation (§5.3).

    The LLM receives this, never the raw brand assets. `do_not_use` carries brand
    guardrails the critique pass also enforces.
    """

    palette: dict[str, str | None] | None = None  # primary/accent/neutral/text
    fonts: dict[str, str | None] | None = None  # heading/body
    tone: str | None = None
    do_not_use: list[str] | None = None


class GenerationInput(BaseModel):
    client: ClientContext
    analysis: AnalysisObject
    style: StyleSpec | None = None
    formats: list[AdFormat] = Field(default_factory=lambda: [AdFormat.search, AdFormat.display])
    # Variants to produce per format, spread across deliberate axes (§5.4).
    n_per_format: int = Field(default=3, ge=1, le=10)
    # Optional Display template allowlist (a subset of templates.py). Empty/None =
    # all templates. The LLM still only selects a layout; this just limits the set.
    allowed_templates: list[str] | None = None


class CritiqueScore(BaseModel):
    """Rubric scores from the second LLM pass (§5.5). 0..1 unless noted."""

    single_message: float = Field(ge=0.0, le=1.0)
    cta_strength: float = Field(ge=0.0, le=1.0)
    differentiation: float = Field(ge=0.0, le=1.0)
    # Google ad-policy safety is a hard gate, not a soft score.
    policy_safe: bool
    notes: str | None = None

    @property
    def passed(self) -> bool:
        return self.policy_safe and min(
            self.single_message, self.cta_strength, self.differentiation
        ) >= 0.5


class Variant(BaseModel):
    spec: RenderSpec
    # Which insight/gap this exploits — surfaced in the Insights view (§9.8).
    insight_ref: str | None = None
    # Which axis this variant explores (e.g. "gap-angle", "proven-angle").
    axis: str | None = None
    critique: CritiqueScore | None = None
    regenerated: bool = False


class GenerationResult(BaseModel):
    variants: list[Variant] = Field(default_factory=list)
    generated_at: str | None = None
