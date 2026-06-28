"""MAP step (§4.3): RawAd -> EnrichedAdRecord.

Split of responsibility (deliberate, leakage-aware):

  * DETERMINISTIC code owns every *performance-proxy* signal. These are the most
    valuable fields (§4.3) and must be reproducible and auditable, so the LLM
    never touches them:
      - ``days_running``  = (last_shown - first_shown).days, clamped >= 0, None if
        either date is missing.
      - ``still_active``, ``variant_count`` : passed through from the scraper.
      - ``scale_tier``    : a COARSE tier derived from impressions_bucket x region
        spread (see ``_scale_tier``). Impression ranges are wide buckets, never
        precise (§4.3 reliability note), so this is intentionally a 3-way tier.
      - identity / text / url / region / date fields are carried through verbatim.

  * The LLM owns *interpretation* of the ad text (value prop, hook, persona,
    claims, CTA, offer, pricing, cadence, repeated phrases, platforms) via ONE
    ``generate_json`` call per ad against a tight internal schema. Output is
    validated by pydantic; a per-ad failure degrades that record to
    deterministic-only (LLM fields None) and never kills the corpus.

  * VISION (Display only) is guarded: the cached corpus uses placeholder
    (example-*.com) image URLs that are not reachable, so we only attempt
    ``tag_image`` for URLs that look real. Otherwise ``creative`` is left None.
    Vision failures never crash enrichment.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from urllib.parse import urlparse

from pydantic import BaseModel

from gaa_ai.config import get_settings
from gaa_ai.llm.base import LlmProvider
from gaa_ai.schemas import (
    AdNetwork,
    CreativeAttributes,
    EnrichedAdRecord,
    RawAd,
    ScaleTier,
)

logger = logging.getLogger("gaa_ai.pipeline.enrich")

# Impression buckets are coarse tiers only (§4.3). We map the scraped bucket
# string to an ordinal 0..3, then optionally bump one tier for wide region
# spread. The final tier is a 3-way ScaleTier, never a precise number.
_BUCKET_ORDINAL: dict[str, int] = {
    "0-1k": 0,
    "1k-10k": 1,
    "10k-100k": 2,
    "100k-1m": 3,
    "1m+": 3,
}

# Domains that are obviously placeholder fixtures (not reachable). We never call
# the vision model on these to avoid crashing on an unreachable image.
_PLACEHOLDER_HOST_MARKERS = ("example", "localhost", "test.", "invalid")


class _AdInsights(BaseModel):
    """Internal LLM-output schema for the text->structured MAP call.

    Kept separate from EnrichedAdRecord so the LLM only ever produces the
    interpretive fields; deterministic fields are merged in by code.
    """

    primary_value_prop: str | None = None
    emotional_hook: str | None = None
    implied_persona: str | None = None
    claims: list[str] | None = None
    cta_verb: str | None = None
    offer_type: str | None = None
    price_points: list[str] | None = None
    promotion_cadence: str | None = None
    repeated_phrases: list[str] | None = None
    platforms: list[AdNetwork] | None = None


_INSIGHTS_SYSTEM = (
    "You are an advertising analyst extracting structured signals from a single "
    "competitor ad. Report only what the ad text supports; use null when a field "
    "is not present. Do not infer pricing or offers that are not stated."
)

_INSIGHTS_PROMPT = """\
Extract structured marketing signals from this competitor ad.

Identity: advertiser={advertiser!r}, format={fmt!r}
Headline: {headline!r}
Body: {body!r}

Return:
- primary_value_prop: the single core promise (short phrase)
- emotional_hook: the feeling the ad targets (e.g. trust, urgency, aspiration)
- implied_persona: who this ad is written for (short description)
- claims: factual/marketing claims made (list of short strings)
- cta_verb: the call-to-action verb (e.g. "Book", "Schedule"), null if none
- offer_type: e.g. "free consult", "first-visit discount", "membership", null if none
- price_points: any explicit prices/discounts as written (list, e.g. ["$9/unit", "50% off"])
- promotion_cadence: e.g. "limited-time", "ongoing", "seasonal", null if unclear
- repeated_phrases: 2-4 word phrases likely useful as keyword seeds (list)
- platforms: which networks this maps to, from {{search, display, youtube}}
"""

_CREATIVE_SYSTEM = (
    "You are a creative-design analyst tagging a display ad image. Report only "
    "what is visible; use null when unsure."
)

_CREATIVE_PROMPT = (
    "Tag this display-ad creative. Identify: faces (people visible?), "
    "before_after (is it a before/after comparison?), product_vs_lifestyle, "
    "text_density (low/medium/high), tone, and dominant_colors."
)

_VISION_INSIGHTS_SYSTEM = (
    "You are an advertising analyst reading a single competitor ad shown as an "
    "IMAGE (a rendered Google ad creative). Extract the messaging visible in the "
    "image. Report only what the ad actually shows; use null when a field is not "
    "present. Do not infer pricing or offers that are not shown."
)

# No .format() placeholders here, so literal braces are fine (unlike _INSIGHTS_PROMPT).
_VISION_INSIGHTS_PROMPT = """\
Read this competitor ad image and extract its structured marketing signals.

Return:
- primary_value_prop: the single core promise (short phrase)
- emotional_hook: the feeling the ad targets (e.g. trust, urgency, aspiration)
- implied_persona: who this ad is written for (short description)
- claims: factual/marketing claims made (list of short strings)
- cta_verb: the call-to-action verb (e.g. "Book", "Schedule"), null if none
- offer_type: e.g. "free consult", "first-visit discount", "membership", null if none
- price_points: any explicit prices/discounts shown (list, e.g. ["$9/unit", "50% off"])
- promotion_cadence: e.g. "limited-time", "ongoing", "seasonal", null if unclear
- repeated_phrases: 2-4 word phrases likely useful as keyword seeds (list)
- platforms: which networks this maps to, from {search, display, youtube}
"""


def _days_running(first: date | None, last: date | None) -> int | None:
    """Deterministic performance proxy: span in days, clamped >= 0.

    None when either endpoint is missing (degrade gracefully, never guess).
    """
    if first is None or last is None:
        return None
    return max(0, (last - first).days)


def _region_spread(regions: list[str] | None) -> int:
    return len(regions) if regions else 0


def _scale_tier(impressions_bucket: str | None, regions: list[str] | None) -> ScaleTier | None:
    """Coarse scale tier from impression bucket x region spread.

    Mapping (documented, intentionally coarse — buckets are not precise, §4.3):
      bucket ordinal: 0-1k=0, 1k-10k=1, 10k-100k=2, 100k-1M/1M+=3
      region bump:    >= 3 distinct regions adds +1 ordinal (broad geo = scale)
      ordinal -> tier: 0..1 -> low, 2 -> medium, >=3 -> high

    Returns None when the bucket is unknown AND there is no region signal, so a
    record with no scale evidence stays None rather than being fabricated.
    """
    key = impressions_bucket.strip().lower() if impressions_bucket else None
    ordinal = _BUCKET_ORDINAL.get(key) if key is not None else None

    spread = _region_spread(regions)
    if ordinal is None:
        if spread == 0:
            return None
        # No bucket but we have geo breadth: infer a floor from spread alone.
        ordinal = 0
    if spread >= 3:
        ordinal += 1

    if ordinal <= 1:
        return ScaleTier.low
    if ordinal == 2:
        return ScaleTier.medium
    return ScaleTier.high


def _is_real_image_url(url: str | None) -> bool:
    """True only when the URL looks like a reachable http(s) image.

    Placeholder fixture hosts (example-*.com) are excluded so we never attempt
    vision on an unreachable image (would crash / waste a call).
    """
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    host = parsed.netloc.lower()
    return not any(marker in host for marker in _PLACEHOLDER_HOST_MARKERS)


def _text_density_heuristic(raw: RawAd) -> CreativeAttributes | None:
    """Cheap deterministic fallback for Display creatives we can't see.

    We can't tag faces/before_after without the image, but headline+body length
    is a reasonable proxy for on-creative text density. Leaves visual-only
    fields None so the aggregate doesn't over-count them.
    """
    text = " ".join(filter(None, [raw.headline, raw.body]))
    if not text:
        return None
    from gaa_ai.schemas import TextDensity

    n = len(text)
    if n < 40:
        density = TextDensity.low
    elif n < 90:
        density = TextDensity.medium
    else:
        density = TextDensity.high
    return CreativeAttributes(text_density=density)


def _enrich_creative(raw: RawAd, llm: LlmProvider) -> CreativeAttributes | None:
    """Display-only vision tagging, guarded against unreachable images."""
    if raw.format != "display":
        return None
    if not _is_real_image_url(raw.image_url):
        # Placeholder / missing image: fall back to a text-density heuristic.
        return _text_density_heuristic(raw)
    assert raw.image_url is not None  # narrowed by _is_real_image_url
    try:
        return llm.tag_image(
            raw.image_url, _CREATIVE_PROMPT, CreativeAttributes, system=_CREATIVE_SYSTEM
        )
    except Exception as exc:  # noqa: BLE001 — vision must never crash enrichment
        logger.warning("vision tagging failed for %s: %s", raw.ad_id, exc)
        return _text_density_heuristic(raw)


def _deterministic_record(raw: RawAd) -> EnrichedAdRecord:
    """Build the record with only the deterministic (non-LLM) fields set."""
    return EnrichedAdRecord(
        ad_id=raw.ad_id,
        advertiser=raw.advertiser,
        source=raw.source,
        format=raw.format,
        headline=raw.headline,
        body=raw.body,
        image_url=raw.image_url,
        landing_url=raw.landing_url,
        first_shown=raw.first_shown,
        last_shown=raw.last_shown,
        days_running=_days_running(raw.first_shown, raw.last_shown),
        still_active=raw.still_active,
        variant_count=raw.variant_count,
        scale_tier=_scale_tier(raw.impressions_bucket, raw.regions),
        regions=raw.regions,
    )


def _apply_insights(record: EnrichedAdRecord, insights: _AdInsights) -> None:
    """Overlay the LLM-interpreted fields onto a deterministic record."""
    record.primary_value_prop = insights.primary_value_prop
    record.emotional_hook = insights.emotional_hook
    record.implied_persona = insights.implied_persona
    record.claims = insights.claims
    record.cta_verb = insights.cta_verb
    record.offer_type = insights.offer_type
    record.price_points = insights.price_points
    record.promotion_cadence = insights.promotion_cadence
    record.repeated_phrases = insights.repeated_phrases
    record.platforms = insights.platforms


def _extract_insights(raw: RawAd, llm: LlmProvider) -> _AdInsights | None:
    """Interpret the ad's messaging. TEXT path when copy exists; otherwise VISION
    on the rendered image (live Transparency ads arrive as images with no copy —
    the only way to read their messaging). Returns None (logged) on failure so the
    record degrades to deterministic-only and never sinks the corpus.
    """
    if raw.headline or raw.body:
        prompt = _INSIGHTS_PROMPT.format(
            advertiser=raw.advertiser,
            fmt=raw.format,
            headline=raw.headline,
            body=raw.body,
        )
        try:
            return llm.generate_json(prompt, _AdInsights, system=_INSIGHTS_SYSTEM)
        except Exception as exc:  # noqa: BLE001 — one bad ad must not kill the corpus
            logger.warning("LLM text enrichment failed for %s: %s", raw.ad_id, exc)
            return None

    if _is_real_image_url(raw.image_url):
        assert raw.image_url is not None  # narrowed by _is_real_image_url
        try:
            return llm.tag_image(
                raw.image_url,
                _VISION_INSIGHTS_PROMPT,
                _AdInsights,
                system=_VISION_INSIGHTS_SYSTEM,
            )
        except Exception as exc:  # noqa: BLE001 — one bad ad must not kill the corpus
            logger.warning("vision enrichment failed for %s: %s", raw.ad_id, exc)
            return None

    return None


def enrich_ad(raw: RawAd, llm: LlmProvider, *, today: date | None = None) -> EnrichedAdRecord:
    """Enrich one ad. ``today`` is accepted for signature symmetry / future use
    (e.g. recency) and to keep enrichment a pure function of its inputs.

    Deterministic fields are always set. LLM interpretation is best-effort: text
    copy is read directly, image-only ads (live Transparency creatives) are read
    via vision, and any failure degrades the record to deterministic-only.
    """
    record = _deterministic_record(raw)

    # VISION (Display visual attributes only, guarded).
    record.creative = _enrich_creative(raw, llm)

    # INTERPRETATION: text-or-vision -> structured insights. Degrade gracefully.
    insights = _extract_insights(raw, llm)
    if insights is not None:
        _apply_insights(record, insights)
    return record


def enrich_corpus(
    raws: list[RawAd],
    llm: LlmProvider,
    *,
    today: date | None = None,
    concurrency: int | None = None,
) -> list[EnrichedAdRecord]:
    """MAP over the corpus CONCURRENTLY, preserving input order.

    Each ad is one (or two, with vision) blocking LLM call; a large live corpus
    (up to ~100 ads) would take minutes run sequentially and blow the request
    timeout. We fan out over a bounded thread pool — the calls are I/O-bound
    (HTTP to the model), so threads give near-linear speedup. ``enrich_ad`` already
    degrades a failed ad to deterministic-only, so one bad ad never sinks the run.

    ``concurrency`` defaults to ``settings.enrich_concurrency``; 1 forces the
    sequential path (used by determinism-sensitive tests).
    """
    if not raws:
        return []
    workers = concurrency if concurrency is not None else get_settings().enrich_concurrency
    workers = max(1, min(workers, len(raws)))
    if workers == 1:
        return [enrich_ad(raw, llm, today=today) for raw in raws]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        # pool.map preserves order; exceptions inside enrich_ad are already handled.
        return list(pool.map(lambda raw: enrich_ad(raw, llm, today=today), raws))
