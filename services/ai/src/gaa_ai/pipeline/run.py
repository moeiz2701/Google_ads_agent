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
from gaa_ai.schemas import AnalysisInput, AnalysisObject, RawAd
from gaa_ai.scrape import ScrapeError, get_ad_source

logger = logging.getLogger("gaa_ai.pipeline.run")


def _fetch_corpus(inp: AnalysisInput, max_ads: int) -> list[RawAd]:
    """Fetch the corpus, falling back to the cached source on live failure.

    Graceful degradation: a live ScrapeError must not fail the request — the
    cached demo corpus always exists, so we log a warning and use it.
    """
    source = get_ad_source(use_cached=inp.use_cached_corpus)
    try:
        return source.fetch(inp.client, max_ads)
    except ScrapeError as exc:
        if inp.use_cached_corpus:
            # Cached path failing is a real error (fixture missing/corrupt).
            raise
        logger.warning("live scrape failed (%s); falling back to cached corpus", exc)
        cached = get_ad_source(use_cached=True)
        return cached.fetch(inp.client, max_ads)


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

    corpus = _fetch_corpus(inp, max_ads)
    records = enrich_corpus(corpus, llm)
    analysis = aggregate(records, inp.client, llm)

    analysis.source_ad_count = len(records)
    analysis.generated_at = datetime.now(timezone.utc).isoformat()
    return analysis
