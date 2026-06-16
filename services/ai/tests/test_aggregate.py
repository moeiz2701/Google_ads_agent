"""REDUCE-step tests (offline, FakeLlm, deterministic).

Covers the headline ML decision (longevity weighting beats frequency),
creative_norms fractions, gap_opportunities presence, and schema validation.
"""

from __future__ import annotations

import pytest

from gaa_ai.llm.base import FakeLlm
from gaa_ai.pipeline.aggregate import _Synthesis, aggregate
from gaa_ai.schemas import (
    AnalysisObject,
    ClientContext,
    CreativeAttributes,
    EnrichedAdRecord,
    TextDensity,
)

CLIENT = ClientContext(
    name="GlowSkin",
    vertical="med_spa",
    geo=["Los Angeles"],
    usp="same-week availability",
    offerings=["botox", "filler"],
)


def _rec(ad_id: str, **kw: object) -> EnrichedAdRecord:
    base: dict[str, object] = {"ad_id": ad_id, "format": "search"}
    base.update(kw)
    return EnrichedAdRecord.model_validate(base)


def test_longevity_outranks_frequency() -> None:
    """One long-running survivor angle must outrank a more-frequent but
    short-lived angle. This is the baseline contract: not 'most competitors
    do X', but 'X has survived'."""
    records = [
        # Survivor angle: one ad, very long-running, still active.
        _rec(
            "long-1",
            primary_value_prop="board-certified trust",
            days_running=514,
            still_active=True,
            variant_count=6,
        ),
        # Frequent-but-short angle: three ads, all short-lived, inactive.
        _rec(
            "short-1",
            primary_value_prop="cheap discount",
            days_running=12,
            still_active=False,
            variant_count=1,
        ),
        _rec(
            "short-2",
            primary_value_prop="cheap discount",
            days_running=11,
            still_active=False,
            variant_count=1,
        ),
        _rec(
            "short-3",
            primary_value_prop="cheap discount",
            days_running=15,
            still_active=False,
            variant_count=1,
        ),
    ]
    result = aggregate(records, CLIENT, FakeLlm())
    assert result.winning_angles[0].angle == "board-certified trust"
    assert result.winning_angles[0].longevity_weight == 1.0
    # The frequent-but-short angle ranks strictly below the survivor.
    weights = {w.angle: w.longevity_weight for w in result.winning_angles}
    assert weights["board-certified trust"] > weights["cheap discount"]
    # example_ids are attached.
    assert result.winning_angles[0].example_ids == ["long-1"]


def test_longevity_weight_normalized_0_1() -> None:
    records = [
        _rec("a", primary_value_prop="x", days_running=500, still_active=True),
        _rec("b", primary_value_prop="y", days_running=50, still_active=False),
    ]
    result = aggregate(records, CLIENT, FakeLlm())
    for w in result.winning_angles:
        assert 0.0 <= w.longevity_weight <= 1.0
    assert result.winning_angles[0].longevity_weight == 1.0


def test_creative_norms_fractions() -> None:
    records = [
        _rec(
            "d1",
            format="display",
            primary_value_prop="trust",
            days_running=300,
            still_active=True,
            creative=CreativeAttributes(
                faces=True, before_after=False, text_density=TextDensity.low
            ),
        ),
        _rec(
            "d2",
            format="display",
            primary_value_prop="results",
            days_running=200,
            still_active=True,
            creative=CreativeAttributes(
                faces=True, before_after=True, text_density=TextDensity.low
            ),
        ),
        _rec(
            "d3",
            format="display",
            primary_value_prop="glow",
            days_running=100,
            still_active=True,
            creative=CreativeAttributes(
                faces=False, before_after=False, text_density=TextDensity.high
            ),
        ),
        # Search record must be excluded from creative norms.
        _rec("s1", format="search", primary_value_prop="cheap", days_running=10),
    ]
    result = aggregate(records, CLIENT, FakeLlm())
    norms = result.creative_norms
    assert norms is not None
    # 2 of 3 display records have faces.
    assert norms.faces == pytest.approx(2 / 3, abs=1e-4)
    # 1 of 3 display records is before/after.
    assert norms.before_after == pytest.approx(1 / 3, abs=1e-4)
    # modal density is low (2 of 3).
    assert norms.text_density is TextDensity.low


def test_creative_norms_none_when_no_display() -> None:
    records = [_rec("s1", format="search", primary_value_prop="x", days_running=10)]
    result = aggregate(records, CLIENT, FakeLlm())
    assert result.creative_norms is None


def test_gap_opportunities_from_llm() -> None:
    seeded = _Synthesis(
        winning_angle_labels=["board-certified trust"],
        saturated_angles=["generic glow up"],
        gap_opportunities=["same-week availability nobody advertises", "male clientele"],
        persona="price-aware first-timer, 28-45",
    )
    llm = FakeLlm({"_Synthesis": seeded})
    records = [
        _rec("a", primary_value_prop="trust", days_running=400, still_active=True),
    ]
    result = aggregate(records, CLIENT, llm)
    assert result.gap_opportunities == [
        "same-week availability nobody advertises",
        "male clientele",
    ]
    assert result.persona == "price-aware first-timer, 28-45"
    # LLM label overrides the raw deterministic angle key.
    assert result.winning_angles[0].angle == "board-certified trust"
    assert result.saturated_angles == ["generic glow up"]


def test_aggregate_validates_as_analysis_object() -> None:
    records = [
        _rec(
            "a",
            primary_value_prop="trust",
            days_running=400,
            still_active=True,
            offer_type="free consult",
            cta_verb="Book",
            repeated_phrases=["botox los angeles"],
        ),
    ]
    result = aggregate(records, CLIENT, FakeLlm())
    # Round-trips through the schema (no validation errors).
    AnalysisObject.model_validate(result.model_dump())
    assert result.vertical == "med_spa"
    assert result.geo == "Los Angeles"


def test_aggregate_degrades_when_synthesis_raises() -> None:
    class ExplodingLlm(FakeLlm):
        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            raise RuntimeError("synthesis down")

    records = [
        _rec("a", primary_value_prop="trust", days_running=400, still_active=True),
        _rec("b", primary_value_prop="cheap", days_running=8, still_active=False, variant_count=1),
        _rec("c", primary_value_prop="cheap", days_running=9, still_active=False, variant_count=1),
    ]
    result = aggregate(records, CLIENT, ExplodingLlm())
    # Deterministic baseline still produces a valid object with ranked angles.
    assert result.winning_angles[0].angle == "trust"
    assert result.gap_opportunities == []  # no LLM => no gaps, but no crash
    # Saturated falls back to the deterministic candidates.
    AnalysisObject.model_validate(result.model_dump())


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
