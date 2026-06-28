"""Relevance gate (live discovery funnel, stage 2).

The Transparency Center autocomplete is a fuzzy *name* match, so even after the
deterministic country filter (stage 1, in scrape/live.py) the corpus can contain
off-topic advertisers — furniture/mattress stores surfacing for a "Marketing
Agency" query because they advertise heavily and long. This gate drops ads that
don't fit the client's business category, AFTER enrichment (so it can judge
image-only Transparency creatives that vision has read into text).

Design choices:
  * ONE batched ``generate_json`` call over the whole corpus (cheap; not RAG).
  * The model returns the ids to DROP (``off_topic_ids``), not the ids to keep —
    conservative: a flaky LLM that under-returns drops FEWER ads (keeps noise),
    never nukes the corpus to empty. The min-count check in run.py is what turns
    a genuinely-empty result into the actionable NoRelevantAdsError.
  * Any LLM/validation failure degrades to keep-all (logged). The country filter
    already removed the worst (foreign-market) noise, so a failed gate is safe.
"""

from __future__ import annotations

import logging

from pydantic import BaseModel

from gaa_ai.llm.base import LlmProvider
from gaa_ai.schemas import ClientContext, EnrichedAdRecord

logger = logging.getLogger("gaa_ai.pipeline.relevance")


class _RelevanceVerdict(BaseModel):
    """Internal LLM-output schema: the ad_ids judged off-topic for the category."""

    off_topic_ids: list[str] = []


_SYSTEM = (
    "You are a market analyst deciding which competitor ads are RELEVANT to a "
    "specific business category. An ad is relevant if it is from a business in the "
    "same or an adjacent category (a real competitor whose ads could inform this "
    "client's campaign). An ad is OFF-TOPIC if it is from an unrelated industry. "
    "Be precise: report only the ids that are clearly off-topic."
)


def _ad_signal(rec: EnrichedAdRecord) -> str:
    """Short, human-readable summary of one ad for the relevance judgement."""
    parts = [
        rec.primary_value_prop,
        rec.headline,
        " · ".join(rec.claims) if rec.claims else None,
        rec.body,
        rec.offer_type,
    ]
    signal = next((p for p in parts if p), "") or "(no readable text)"
    return signal[:160]


def _build_prompt(records: list[EnrichedAdRecord], vertical: str) -> str:
    lines = [
        f"Client business category: {vertical!r}",
        "",
        "Competitor ads (id — advertiser — message):",
    ]
    for rec in records:
        advertiser = rec.advertiser or "unknown"
        lines.append(f"- {rec.ad_id} — {advertiser} — {_ad_signal(rec)}")
    lines += [
        "",
        f"Return the ids of ads that are OFF-TOPIC for a {vertical!r} business "
        "(unrelated industry). Return an empty list if all ads are relevant.",
    ]
    return "\n".join(lines)


def filter_relevant(
    records: list[EnrichedAdRecord],
    client: ClientContext,
    llm: LlmProvider,
) -> list[EnrichedAdRecord]:
    """Drop ads that don't fit the client's category. Never raises — on any LLM
    failure it returns the input unchanged (the country filter is the floor)."""
    if not records:
        return records

    prompt = _build_prompt(records, client.vertical)
    try:
        verdict = llm.generate_json(prompt, _RelevanceVerdict, system=_SYSTEM)
    except Exception as exc:  # noqa: BLE001 — a failed gate must not sink the corpus
        logger.warning("relevance gate failed (%s); keeping all %d ads", exc, len(records))
        return records

    off_topic = {aid for aid in verdict.off_topic_ids if aid}
    if not off_topic:
        return records
    kept = [rec for rec in records if rec.ad_id not in off_topic]
    logger.info(
        "relevance gate: dropped %d/%d off-topic ads for %r",
        len(records) - len(kept),
        len(records),
        client.vertical,
    )
    return kept
