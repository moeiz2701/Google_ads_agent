"""MAP-step tests (offline, FakeLlm, no key, deterministic).

Covers the deterministic split (days_running, scale_tier), graceful LLM
degradation, and the vision guard for placeholder image URLs.
"""

from __future__ import annotations

from datetime import date

import pytest

from gaa_ai.llm.base import FakeLlm
from gaa_ai.pipeline.enrich import (
    _AdInsights,
    _days_running,
    _is_real_image_url,
    _scale_tier,
    enrich_ad,
)
from gaa_ai.schemas import (
    AdNetwork,
    CreativeAttributes,
    RawAd,
    ScaleTier,
    TextDensity,
)

TODAY = date(2026, 6, 16)


def _raw(ad_id: str, **kw: object) -> RawAd:
    base: dict[str, object] = {"ad_id": ad_id, "source": "cached", "format": "search"}
    base.update(kw)
    return RawAd.model_validate(base)


# --- days_running -----------------------------------------------------------


def test_days_running_long_runner_vs_short_lived() -> None:
    # gads-ms-001: 2025-01-12 -> 2026-06-10
    long = _days_running(date(2025, 1, 12), date(2026, 6, 10))
    # gads-ms-003: 2026-04-20 -> 2026-05-05
    short = _days_running(date(2026, 4, 20), date(2026, 5, 5))
    assert long == 514
    assert short == 15
    assert long > short


def test_days_running_missing_dates_is_none() -> None:
    assert _days_running(None, date(2026, 1, 1)) is None
    assert _days_running(date(2026, 1, 1), None) is None
    assert _days_running(None, None) is None


def test_days_running_clamped_non_negative() -> None:
    # last before first (bad data) must not go negative.
    assert _days_running(date(2026, 6, 10), date(2026, 1, 1)) == 0


# --- scale_tier mapping -----------------------------------------------------


def test_scale_tier_mapping() -> None:
    # high bucket alone -> high.
    assert _scale_tier("100k-1M", ["LA"]) is ScaleTier.high
    # high bucket + broad geo stays high.
    assert _scale_tier("100k-1M", ["LA", "Pasadena", "Glendale"]) is ScaleTier.high
    # mid bucket alone -> medium.
    assert _scale_tier("10k-100k", ["LA"]) is ScaleTier.medium
    # mid bucket + broad geo (>=3) bumps to high.
    assert _scale_tier("10k-100k", ["LA", "Pasadena", "Glendale"]) is ScaleTier.high
    # low bucket -> low.
    assert _scale_tier("1k-10k", ["LA"]) is ScaleTier.low
    # unknown bucket, no geo -> None (no fabricated signal).
    assert _scale_tier(None, None) is None
    # unknown bucket but broad geo -> at least low.
    assert _scale_tier(None, ["LA", "Pasadena", "Glendale"]) is not None


# --- vision guard -----------------------------------------------------------


def test_is_real_image_url_rejects_placeholders() -> None:
    assert _is_real_image_url("https://example-skinglow.com/x.jpg") is False
    assert _is_real_image_url(None) is False
    assert _is_real_image_url("not-a-url") is False
    assert _is_real_image_url("https://cdn.realsite.com/a.jpg") is True


def test_vision_skipped_for_placeholder_url() -> None:
    """A placeholder display image must NOT trigger tag_image; falls back to a
    text-density heuristic instead and never crashes."""

    class ExplodingVision(FakeLlm):
        def tag_image(self, image_url, prompt, schema, *, system=None):  # type: ignore[no-untyped-def]
            raise AssertionError("tag_image must not be called for placeholder URLs")

    raw = _raw(
        "disp-1",
        format="display",
        headline="Before & After: Real Client Results",
        body="See the transformation.",
        image_url="https://example-pureskin.com/creatives/before-after.jpg",
    )
    rec = enrich_ad(raw, ExplodingVision(), today=TODAY)
    # Heuristic fallback set text_density but left visual-only fields None.
    assert rec.creative is not None
    assert rec.creative.text_density is not None
    assert rec.creative.faces is None


def test_vision_used_for_real_url() -> None:
    seeded = CreativeAttributes(faces=True, before_after=True, text_density=TextDensity.low)
    llm = FakeLlm({"CreativeAttributes": seeded})
    raw = _raw(
        "disp-2",
        format="display",
        headline="See results",
        image_url="https://cdn.realsite.com/a.jpg",
    )
    rec = enrich_ad(raw, llm, today=TODAY)
    assert rec.creative is not None
    assert rec.creative.faces is True
    assert rec.creative.before_after is True


# --- graceful LLM degradation ----------------------------------------------


def test_enrich_graceful_when_llm_raises() -> None:
    class ExplodingLlm(FakeLlm):
        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            raise RuntimeError("provider down")

    raw = _raw(
        "gads-ms-001",
        headline="Affordable Botox in Los Angeles | From $9/Unit",
        body="Board-certified injectors. Free consult.",
        first_shown=date(2025, 1, 12),
        last_shown=date(2026, 6, 10),
        still_active=True,
        variant_count=6,
        impressions_bucket="100k-1M",
        regions=["Los Angeles", "Pasadena", "Glendale"],
    )
    rec = enrich_ad(raw, ExplodingLlm(), today=TODAY)
    # Deterministic fields survive.
    assert rec.days_running == 514
    assert rec.still_active is True
    assert rec.variant_count == 6
    assert rec.scale_tier is ScaleTier.high
    # LLM fields are None (degraded, not crashed).
    assert rec.primary_value_prop is None
    assert rec.cta_verb is None


def test_enrich_merges_llm_fields() -> None:
    seeded = _AdInsights(
        primary_value_prop="affordable botox",
        emotional_hook="price",
        cta_verb="Book",
        offer_type="free consult",
        price_points=["$9/unit"],
        repeated_phrases=["affordable botox", "los angeles"],
        platforms=[AdNetwork.search],
    )
    llm = FakeLlm({"_AdInsights": seeded})
    raw = _raw(
        "gads-ms-001",
        headline="Affordable Botox in Los Angeles | From $9/Unit",
        body="Free consult.",
        first_shown=date(2025, 1, 12),
        last_shown=date(2026, 6, 10),
    )
    rec = enrich_ad(raw, llm, today=TODAY)
    assert rec.primary_value_prop == "affordable botox"
    assert rec.cta_verb == "Book"
    assert rec.price_points == ["$9/unit"]
    assert rec.platforms == [AdNetwork.search]


def test_enrich_no_text_skips_llm() -> None:
    class ExplodingLlm(FakeLlm):
        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            raise AssertionError("must not call LLM with no text")

    raw = _raw("empty", headline=None, body=None)
    rec = enrich_ad(raw, ExplodingLlm(), today=TODAY)
    assert rec.primary_value_prop is None


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
