"""End-to-end pipeline tests (offline, FakeLlm, cached corpus, no key)."""

from __future__ import annotations

import pytest

from gaa_ai.llm.base import FakeLlm
from gaa_ai.pipeline import run as run_module
from gaa_ai.pipeline import run_analysis
from gaa_ai.pipeline.aggregate import _Synthesis
from gaa_ai.pipeline.enrich import _AdInsights
from gaa_ai.schemas import AdNetwork, AnalysisInput, AnalysisObject, ClientContext, RawAd
from gaa_ai.scrape import NoRelevantAdsError, ScrapeError
from gaa_ai.scrape import get_ad_source as real_get_ad_source


def _fake_llm() -> FakeLlm:
    """Seed both MAP and REDUCE schemas so the run produces a populated object.

    FakeLlm keys responses by schema name, so every ad gets the same _AdInsights
    (fine for an end-to-end smoke of plumbing + counts)."""
    return FakeLlm(
        {
            "_AdInsights": _AdInsights(
                primary_value_prop="board-certified trust",
                emotional_hook="trust",
                cta_verb="Book",
                offer_type="free consult",
                repeated_phrases=["botox los angeles"],
                platforms=[AdNetwork.search],
            ),
            "_Synthesis": _Synthesis(
                gap_opportunities=[
                    "same-week availability nobody advertises",
                    "male clientele unaddressed",
                ],
                persona="price-aware first-timer, 28-45",
            ),
        }
    )


def _input(**kw: object) -> AnalysisInput:
    return AnalysisInput(
        client=ClientContext(
            name="GlowSkin",
            vertical="med_spa",
            geo=["Los Angeles"],
            usp="same-week availability",
            offerings=["botox", "filler"],
        ),
        use_cached_corpus=True,
        **kw,
    )


def test_run_analysis_end_to_end_cached() -> None:
    result = run_analysis(_input(), llm=_fake_llm())
    assert isinstance(result, AnalysisObject)
    # Cached med_spa corpus is 14 ads.
    assert result.source_ad_count == 14
    assert result.vertical == "med_spa"
    assert result.geo == "Los Angeles"
    assert result.generated_at is not None
    assert len(result.gap_opportunities) == 2
    # Round-trips through the schema cleanly.
    AnalysisObject.model_validate(result.model_dump())


def test_run_analysis_respects_max_ads() -> None:
    result = run_analysis(_input(max_ads=5), llm=_fake_llm())
    assert result.source_ad_count == 5


def test_run_analysis_deterministic() -> None:
    a = run_analysis(_input(), llm=_fake_llm())
    b = run_analysis(_input(), llm=_fake_llm())
    # generated_at is a wall-clock timestamp; everything else must be identical.
    a_d = a.model_dump(exclude={"generated_at"})
    b_d = b.model_dump(exclude={"generated_at"})
    assert a_d == b_d


def test_run_analysis_no_llm_fields_still_valid() -> None:
    """Even with a bare FakeLlm (all-None LLM output), the deterministic
    baseline yields a valid AnalysisObject with the correct ad count."""
    result = run_analysis(_input(), llm=FakeLlm())
    assert result.source_ad_count == 14
    AnalysisObject.model_validate(result.model_dump())


# --- live discovery funnel (country + relevance) semantics --------------------


def _live_input() -> AnalysisInput:
    """Same client as ``_input`` but on the live discovery path."""
    return AnalysisInput(
        client=ClientContext(
            name="GlowSkin", vertical="med_spa", geo=["Los Angeles"], country="US"
        ),
        use_cached_corpus=False,
    )


class _FakeLiveSource:
    """Live source stub that returns a few ads (discovery reached the source)."""

    name = "live"

    def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
        return [
            RawAd(ad_id=f"live-{i}", source="google_transparency", format="search")
            for i in range(5)
        ]


def test_live_path_errors_when_relevance_gate_empties_corpus(monkeypatch) -> None:
    """Reached the source, but the relevance gate drops everything -> actionable
    NoRelevantAdsError once the relevant count falls below the floor."""
    monkeypatch.setattr(run_module, "get_ad_source", lambda *, use_cached: _FakeLiveSource())
    monkeypatch.setattr(run_module, "filter_relevant", lambda recs, client, llm: [])
    with pytest.raises(NoRelevantAdsError):
        run_analysis(_live_input(), llm=FakeLlm())


def test_no_relevant_from_discovery_is_not_swallowed_by_cached_fallback(monkeypatch) -> None:
    """A NoRelevantAdsError from discovery (e.g. country filter emptied) must
    propagate — the cached corpus must NOT be requested as a fallback."""

    class _NoMarketSource:
        name = "live"

        def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
            raise NoRelevantAdsError("found advertisers but none in US")

    def _source(*, use_cached: bool):
        if use_cached:
            pytest.fail("cached fallback must not run for NoRelevantAdsError")
        return _NoMarketSource()

    monkeypatch.setattr(run_module, "get_ad_source", _source)
    with pytest.raises(NoRelevantAdsError):
        run_analysis(_live_input(), llm=FakeLlm())


def test_infra_scrapeerror_falls_back_to_cached_and_skips_gate(monkeypatch) -> None:
    """An infra ScrapeError (unreachable/blocked) still degrades to the cached
    corpus, which is curated, so the relevance gate is skipped and no error fires."""

    class _Blocked:
        name = "live"

        def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
            raise ScrapeError("rate-limited / blocked")

    def _source(*, use_cached: bool):
        return real_get_ad_source(use_cached=True) if use_cached else _Blocked()

    # The gate must not even be consulted on the cached fallback path.
    monkeypatch.setattr(run_module, "get_ad_source", _source)
    monkeypatch.setattr(
        run_module,
        "filter_relevant",
        lambda recs, client, llm: pytest.fail("gate must be skipped on cached fallback"),
    )
    result = run_analysis(_live_input(), llm=_fake_llm())
    assert result.source_ad_count == 14  # full cached med_spa corpus


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
