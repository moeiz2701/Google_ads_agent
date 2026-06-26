"""End-to-end Module 3 tests (offline FakeLlm, deterministic).

Covers: generate_variants returns a validated GenerationResult of RenderSpecs, all
critique.policy_safe; a policy-unsafe variant is regenerated then dropped if still
unsafe; passing variants retained.
"""

from __future__ import annotations

from gaa_ai.generation import generate_variants
from gaa_ai.generation.critique import _CritiqueLlmScore
from gaa_ai.llm.base import FakeLlm
from gaa_ai.schemas import (
    AdFormat,
    AnalysisObject,
    ClientContext,
    DisplayRenderSpec,
    GenerationInput,
    GenerationResult,
    RsaDescription,
    RsaHeadline,
    SearchRenderSpec,
    WinningAngle,
)
from gaa_ai.templates import is_valid_template

CLIENT = ClientContext(
    name="GlowSkin", vertical="med_spa", geo=["Los Angeles"], usp="same-week availability"
)
ANALYSIS = AnalysisObject(
    vertical="med_spa",
    geo="Los Angeles",
    winning_angles=[WinningAngle(angle="board-certified trust", longevity_weight=1.0)],
    gap_opportunities=["weekend male clientele", "transparent flat pricing"],
)


def _seeded_llm(
    *,
    policy_safe: bool = True,
    template_id: str = "split_image_left",
) -> FakeLlm:
    return FakeLlm(
        {
            "DisplayRenderSpec": DisplayRenderSpec(
                template_id=template_id,
                headline="Same-Week Care",
                subhead="Board-certified team",
                cta="Book Consult",
                angle="trust",
            ),
            "_LooseSearchRenderSpec": SearchRenderSpec(
                headlines=[RsaHeadline(text=f"Same-Week Care {i}") for i in range(10)],
                descriptions=[
                    RsaDescription(text=f"Board-certified care, option {i}.")
                    for i in range(4)
                ],
                angle="trust",
            ),
            "_CritiqueLlmScore": _CritiqueLlmScore(
                single_message=0.9,
                cta_strength=0.8,
                differentiation=0.8,
                policy_safe=policy_safe,
                notes="ok" if policy_safe else "policy issue",
            ),
        }
    )


def _inp(n: int = 2, formats: list[AdFormat] | None = None) -> GenerationInput:
    return GenerationInput(
        client=CLIENT,
        analysis=ANALYSIS,
        n_per_format=n,
        formats=formats or [AdFormat.search, AdFormat.display],
    )


def test_end_to_end_returns_validated_result() -> None:
    result = generate_variants(_inp(n=2), llm=_seeded_llm())
    assert isinstance(result, GenerationResult)
    assert result.generated_at  # UTC ISO set
    # 2 per format x 2 formats = 4 passing variants.
    assert len(result.variants) == 4
    # Round-trips through the schema.
    GenerationResult.model_validate(result.model_dump())
    for v in result.variants:
        assert v.critique is not None
        assert v.critique.policy_safe is True
        assert v.insight_ref
        assert v.axis
        if isinstance(v.spec, DisplayRenderSpec):
            assert is_valid_template(v.spec.template_id)
            assert v.spec.size == "1200x628"


def test_all_returned_variants_are_policy_safe() -> None:
    result = generate_variants(_inp(n=3), llm=_seeded_llm())
    assert result.variants
    assert all(v.critique and v.critique.policy_safe for v in result.variants)


def test_unsafe_variant_regenerated_then_dropped() -> None:
    # Headline contains a banned superlative AND the LLM verdict is unsafe, so it can
    # never pass the deterministic gate -> regen budget exhausts -> dropped.
    bad = FakeLlm(
        {
            "DisplayRenderSpec": DisplayRenderSpec(
                template_id="bold_centered",
                headline="The Best Botox Guaranteed",
                cta="Book",
                angle="trust",
            ),
            "_CritiqueLlmScore": _CritiqueLlmScore(
                single_message=0.9,
                cta_strength=0.9,
                differentiation=0.9,
                policy_safe=True,  # even if LLM says safe, deterministic gate blocks
            ),
        }
    )
    result = generate_variants(
        _inp(n=2, formats=[AdFormat.display]), llm=bad
    )
    # All unsafe variants dropped — never ship policy-unsafe ads.
    assert result.variants == []


def test_regen_fixes_then_keeps() -> None:
    # First call returns banned copy; subsequent calls return clean copy. The regen
    # loop should recover and keep the variant (marked regenerated).
    class HealingLlm(FakeLlm):
        def __init__(self) -> None:
            super().__init__()
            self.display_calls = 0

        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            if schema.__name__ == "DisplayRenderSpec":
                self.display_calls += 1
                headline = (
                    "The Best Botox" if self.display_calls == 1 else "Same-Week Botox Care"
                )
                return DisplayRenderSpec(
                    template_id="bold_centered", headline=headline, cta="Book", angle="trust"
                )
            if schema.__name__ == "_CritiqueLlmScore":
                return _CritiqueLlmScore(
                    single_message=0.9,
                    cta_strength=0.9,
                    differentiation=0.9,
                    policy_safe=True,
                )
            return schema.model_construct()

    result = generate_variants(_inp(n=1, formats=[AdFormat.display]), llm=HealingLlm())
    assert len(result.variants) == 1
    v = result.variants[0]
    assert v.regenerated is True
    assert v.critique and v.critique.policy_safe is True
    assert isinstance(v.spec, DisplayRenderSpec)
    assert "best" not in v.spec.headline.lower()
