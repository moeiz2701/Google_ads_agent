"""Critique-pass tests (§5.5) — offline FakeLlm, deterministic.

Covers: the deterministic policy hard-gate downgrades an LLM "safe" verdict;
do_not_use guardrails honored; .passed logic; passing variants retained.
"""

from __future__ import annotations

from gaa_ai.generation.critique import (
    _CritiqueLlmScore,
    _policy_violations,
    critique_variant,
)
from gaa_ai.llm.base import FakeLlm
from gaa_ai.schemas import (
    AnalysisObject,
    ClientContext,
    DisplayRenderSpec,
    GenerationInput,
    StyleSpec,
    Variant,
    WinningAngle,
)

CLIENT = ClientContext(name="GlowSkin", vertical="med_spa", geo=["LA"], usp="speed")
ANALYSIS = AnalysisObject(
    vertical="med_spa",
    winning_angles=[WinningAngle(angle="trust", longevity_weight=1.0)],
    gap_opportunities=["weekend hours"],
)


def _inp(do_not_use: list[str] | None = None) -> GenerationInput:
    style = StyleSpec(do_not_use=do_not_use) if do_not_use is not None else None
    return GenerationInput(client=CLIENT, analysis=ANALYSIS, style=style)


def _variant(headline: str, cta: str = "Book Now") -> Variant:
    return Variant(
        spec=DisplayRenderSpec(
            template_id="bold_centered", headline=headline, cta=cta, angle="trust"
        ),
        insight_ref="trust",
        axis="proven-angle",
    )


def _passing_llm() -> FakeLlm:
    return FakeLlm(
        {
            "_CritiqueLlmScore": _CritiqueLlmScore(
                single_message=0.9,
                cta_strength=0.8,
                differentiation=0.7,
                policy_safe=True,
                notes="solid",
            )
        }
    )


def test_deterministic_gate_catches_banned_superlative() -> None:
    # The LLM (incorrectly) says safe; the deterministic scan overrides to unsafe.
    score = critique_variant(_inp(), _variant("The Best Botox in Town"), _passing_llm())
    assert score.policy_safe is False
    assert score.passed is False
    assert "best" in (score.notes or "").lower()


def test_clean_variant_passes() -> None:
    score = critique_variant(_inp(), _variant("Same-Week Botox Care"), _passing_llm())
    assert score.policy_safe is True
    assert score.passed is True


def test_do_not_use_guardrail_honored() -> None:
    score = critique_variant(
        _inp(do_not_use=["discount"]),
        _variant("Big Discount Today"),
        _passing_llm(),
    )
    assert score.policy_safe is False
    assert "discount" in (score.notes or "").lower()


def test_policy_violations_scan() -> None:
    assert _policy_violations("We are #1 and guaranteed", None)
    assert _policy_violations("Risk-free results", None)
    assert _policy_violations("Clickbait!!!", None)
    assert not _policy_violations("Same-week board-certified care", None)


def test_low_soft_score_fails_passed() -> None:
    weak = FakeLlm(
        {
            "_CritiqueLlmScore": _CritiqueLlmScore(
                single_message=0.9,
                cta_strength=0.2,  # below 0.5 threshold
                differentiation=0.7,
                policy_safe=True,
            )
        }
    )
    score = critique_variant(_inp(), _variant("Same-Week Care"), weak)
    assert score.policy_safe is True
    assert score.passed is False  # cta_strength < 0.5


def test_failed_critique_call_is_unsafe() -> None:
    class ExplodingLlm(FakeLlm):
        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            raise RuntimeError("critique down")

    score = critique_variant(_inp(), _variant("Same-Week Care"), ExplodingLlm())
    assert score.passed is False
