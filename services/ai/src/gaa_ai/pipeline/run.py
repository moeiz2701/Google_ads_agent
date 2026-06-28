"""Orchestration (§4.2): scrape -> MAP (enrich) -> REDUCE (aggregate).

A plain functional pipeline. The spec mentions LangChain/LangGraph, but this flow
is a linear scrape->map->reduce with no branching, looping, or shared mutable
state — a graph framework would add ceremony without clarifying anything. Boring
and correct: three pure-ish steps wired together with explicit fallbacks.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from gaa_ai.config import get_settings
from gaa_ai.llm.base import LlmProvider
from gaa_ai.llm.factory import get_llm
from gaa_ai.pipeline.aggregate import aggregate
from gaa_ai.pipeline.enrich import enrich_corpus
from gaa_ai.pipeline.relevance import filter_relevant
from gaa_ai.schemas import AnalysisInput, AnalysisObject, RawAd
from gaa_ai.scrape import NoRelevantAdsError, ScrapeError, get_ad_source

logger = logging.getLogger("gaa_ai.pipeline.run")


def _fetch_corpus(inp: AnalysisInput, max_ads: int) -> tuple[list[RawAd], bool]:
    """Fetch the corpus. Returns ``(corpus, used_live)`` so the caller knows
    whether to apply the live-only relevance funnel.

    Graceful degradation: an INFRA ScrapeError (unreachable/blocked source) must
    not fail the request — the cached demo corpus always exists, so we log and
    fall back. A NoRelevantAdsError is different: discovery REACHED the source but
    the country filter emptied it, so it is actionable and propagates (no silent
    fallback to unrelated cached ads).
    """
    if inp.use_cached_corpus:
        return get_ad_source(use_cached=True).fetch(inp.client, max_ads), False
    source = get_ad_source(use_cached=False)
    try:
        return source.fetch(inp.client, max_ads), True
    except NoRelevantAdsError:
        raise  # reached the source, nothing in-market — surface it, do not fall back
    except ScrapeError as exc:
        logger.warning("live scrape failed (%s); falling back to cached corpus", exc)
        return get_ad_source(use_cached=True).fetch(inp.client, max_ads), False


def run_analysis(inp: AnalysisInput, llm: LlmProvider | None = None) -> AnalysisObject:
    """Run Module 2 end-to-end and return a validated AnalysisObject.

    ``llm`` is injectable so tests pass a FakeLlm (no API key needed). In
    production it defaults to the configured provider via ``get_llm()``; if no key
    is configured, ``get_llm()`` raising is the expected, correct behavior.
    """
    settings = get_settings()
    llm = llm or get_llm()

    # Respect the caller's cap and the global ceiling; max_ads None => ceiling.
    cap = inp.max_ads if inp.max_ads is not None else settings.max_corpus_size
    max_ads = min(cap, settings.max_corpus_size)

    corpus, used_live = _fetch_corpus(inp, max_ads)
    records = enrich_corpus(corpus, llm)

    # Live funnel, stage 2: drop off-topic ads, then require a relevant floor.
    # The cached demo corpus is curated, so it skips the gate entirely.
    if used_live:
        records = filter_relevant(records, inp.client, llm)
        if len(records) < settings.relevance_min_ads:
            geo = ", ".join(inp.client.geo) or "the selected location"
            raise NoRelevantAdsError(
                f"No relevant competitor ads found for {inp.client.vertical!r} in "
                f"{geo}. Try a different category or location."
            )

    analysis = aggregate(records, inp.client, llm)

    analysis.source_ad_count = len(records)
    analysis.generated_at = datetime.now(timezone.utc).isoformat()
    return analysis
