"""REDUCE step (§4.4): EnrichedAdRecord[] -> AnalysisObject.

Hybrid: deterministic statistics first (the BASELINE), then ONE LLM synthesis
call that *labels and interprets* those statistics. The deterministic stats are
the ground truth; the LLM never invents the ranking.

Why longevity, not frequency (the headline ML decision)
-------------------------------------------------------
The naive baseline would rank angles by raw frequency ("most competitors do X").
That is explicitly banned (CLAUDE.md, §4.3): a swarm of short-lived discount ads
would dominate purely because they are cheap to spam. Frequency measures *what
competitors try*, not *what survives*. We rank by a LONGEVITY proxy instead:

    angle_weight = sum over ads in that angle of  per_ad_longevity
    per_ad_longevity = days_running * (active_bonus) * (conviction_bonus)

where (see ``_longevity_score``):
    * days_running is the core survivor signal (still being paid for => working),
    * active_bonus = ACTIVE_BONUS if still_active else 1.0,
    * conviction_bonus scales gently with variant_count (more variants = more
      budget/conviction behind the angle), capped so one ad can't dominate.

We then normalize each angle's summed weight to [0, 1] by the max angle weight,
so ``longevity_weight`` is a relative survivor score, not a probability.

This deterministic ranking IS the baseline; the LLM only attaches human-readable
angle labels, the example_ids we computed, and the strategic gap analysis. If the
LLM is unavailable, the deterministic ranking still stands on its own.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field

from pydantic import BaseModel

from gaa_ai.llm.base import LlmProvider
from gaa_ai.schemas import (
    AnalysisObject,
    ClientContext,
    CreativeNorms,
    EnrichedAdRecord,
    WinningAngle,
)

logger = logging.getLogger("gaa_ai.pipeline.aggregate")

# Longevity-weighting tunables (documented in module docstring).
ACTIVE_BONUS = 1.5
CONVICTION_PER_VARIANT = 0.15
CONVICTION_CAP = 1.75
# A still-active ad with no date span still carries some survivor signal.
ACTIVE_NO_DATES_FLOOR = 30.0

_STOPWORDS = frozenset(
    [
        "a", "an", "and", "the", "for", "you", "your", "our", "with", "in", "on",
        "of", "to", "from", "by", "is", "are", "this", "that", "these", "those",
        "we", "us", "it", "at", "or", "as", "be", "book", "now", "today", "get",
        "free", "near", "me",
    ]
)


@dataclass
class _AngleStat:
    """Deterministic per-angle accumulator (the baseline ranking unit)."""

    key: str
    weight: float = 0.0
    example_ids: list[str] = field(default_factory=list)
    ad_count: int = 0


class _Synthesis(BaseModel):
    """LLM-output schema for the single REDUCE synthesis call.

    The LLM labels angles and produces the strategic payload; it does not set the
    longevity weights (those are deterministic and merged back in by code).
    """

    winning_angle_labels: list[str] | None = None
    saturated_angles: list[str] | None = None
    gap_opportunities: list[str] | None = None
    persona: str | None = None


_SYNTH_SYSTEM = (
    "You are a competitive-strategy analyst for a paid-search agency. You are "
    "given pre-computed, longevity-weighted statistics about a competitor ad "
    "corpus plus the client's own positioning. Ground every statement in the "
    "evidence provided. Never claim an angle 'works' just because it is frequent; "
    "the provided weights already encode longevity (survivors), so respect them. "
    "Your most important output is gap_opportunities: angles the corpus does NOT "
    "cover that the client could own, informed by the client's USP and offerings."
)

_SYNTH_PROMPT = """\
Vertical: {vertical}
Geo: {geo}

Client positioning (for gap analysis):
- USP: {usp}
- Offerings: {offerings}

Longevity-ranked competitor angles (higher weight = longer-surviving, NOT just frequent):
{ranked_angles}

Saturated / short-lived angle candidates (high frequency, low longevity):
{saturated_candidates}

Common offers observed: {common_offers}
CTA patterns observed: {cta_patterns}
Creative norms (Display): faces={faces_frac}, before_after={ba_frac}, text_density={text_density}

Tasks:
1. winning_angle_labels: a short, human-readable label for each ranked angle
   above, IN THE SAME ORDER. Same length as the ranked list.
2. saturated_angles: angles that are crowded or short-lived (avoid copying).
3. gap_opportunities: 2-5 strategic angles the corpus does NOT cover that the
   client could own, grounded in the client's USP/offerings and the evidence.
4. persona: the dominant target persona implied by the surviving ads.
"""


def _longevity_score(rec: EnrichedAdRecord) -> float:
    """Per-ad survivor weight. The baseline's atomic unit.

    days_running is the core signal; still-active and variant_count are gentle
    multipliers. An active ad with missing dates gets a small floor so it isn't
    silently dropped, but never outweighs a measured long-runner.
    """
    base = float(rec.days_running) if rec.days_running is not None else 0.0
    if base == 0.0 and rec.still_active:
        base = ACTIVE_NO_DATES_FLOOR
    if base == 0.0:
        return 0.0
    active_mult = ACTIVE_BONUS if rec.still_active else 1.0
    variants = rec.variant_count or 0
    conviction = min(CONVICTION_CAP, 1.0 + CONVICTION_PER_VARIANT * variants)
    return base * active_mult * conviction


def _angle_key(rec: EnrichedAdRecord) -> str | None:
    """Coarse deterministic angle bucket for a record.

    We bucket on primary_value_prop when the LLM provided one, else fall back to
    emotional_hook, else offer_type. Lowercased/trimmed so trivially-different
    strings merge. Returns None when there is no angle signal at all.
    """
    for candidate in (rec.primary_value_prop, rec.emotional_hook, rec.offer_type):
        if candidate and candidate.strip():
            return candidate.strip().lower()
    return None


def _rank_angles(records: list[EnrichedAdRecord]) -> list[_AngleStat]:
    """Deterministic longevity-weighted angle ranking (the baseline)."""
    stats: dict[str, _AngleStat] = {}
    for rec in records:
        key = _angle_key(rec)
        if key is None:
            continue
        stat = stats.setdefault(key, _AngleStat(key=key))
        stat.weight += _longevity_score(rec)
        stat.ad_count += 1
        if rec.ad_id not in stat.example_ids:
            stat.example_ids.append(rec.ad_id)
    ranked = sorted(stats.values(), key=lambda s: (-s.weight, s.key))
    return ranked


def _normalized_winning_angles(ranked: list[_AngleStat]) -> list[WinningAngle]:
    """Convert ranked stats to WinningAngle with longevity_weight in [0, 1]."""
    positive = [s for s in ranked if s.weight > 0]
    if not positive:
        return []
    top = positive[0].weight
    return [
        WinningAngle(
            angle=s.key,
            longevity_weight=round(s.weight / top, 4) if top > 0 else 0.0,
            example_ids=s.example_ids or None,
        )
        for s in positive
    ]


def _saturated_candidates(ranked: list[_AngleStat]) -> list[str]:
    """Angles with high frequency but low longevity = short-lived noise.

    These are the inverse of winners: appear often (ad_count) yet score low.
    Surfaced as candidates for the LLM to label as saturated/avoid.
    """
    if not ranked:
        return []
    max_w = max((s.weight for s in ranked), default=0.0) or 1.0
    cands = [
        s
        for s in ranked
        if s.ad_count >= 2 and (s.weight / max_w) < 0.34
    ]
    cands.sort(key=lambda s: (-s.ad_count, s.weight))
    return [s.key for s in cands[:5]]


def _creative_norms(records: list[EnrichedAdRecord]) -> CreativeNorms | None:
    """Fractions over DISPLAY records that have a creative tagged.

    faces/before_after are fractions of display records where the attribute is
    True; modal text_density is the most common tagged density. Returns None when
    no display creatives carry signal.
    """
    display = [r for r in records if r.format == "display" and r.creative is not None]
    if not display:
        return None
    n = len(display)
    faces_true = sum(1 for r in display if r.creative and r.creative.faces)
    ba_true = sum(1 for r in display if r.creative and r.creative.before_after)
    densities = [
        r.creative.text_density for r in display if r.creative and r.creative.text_density
    ]
    modal = Counter(densities).most_common(1)[0][0] if densities else None
    # Only report a fraction when at least one record had a non-null value for it.
    faces_seen = any(r.creative and r.creative.faces is not None for r in display)
    ba_seen = any(r.creative and r.creative.before_after is not None for r in display)
    return CreativeNorms(
        faces=round(faces_true / n, 4) if faces_seen else None,
        before_after=round(ba_true / n, 4) if ba_seen else None,
        text_density=modal,
    )


def _keyword_seed(records: list[EnrichedAdRecord], limit: int = 12) -> list[str]:
    """Frequent repeated_phrases + headline bigrams/trigrams."""
    counter: Counter[str] = Counter()
    for rec in records:
        for phrase in rec.repeated_phrases or []:
            p = phrase.strip().lower()
            if p:
                counter[p] += 1
        counter.update(_ngrams(rec.headline))
    return [phrase for phrase, _ in counter.most_common(limit)]


def _ngrams(text: str | None) -> list[str]:
    if not text:
        return []
    tokens = [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]
    grams: list[str] = []
    for size in (2, 3):
        for i in range(len(tokens) - size + 1):
            grams.append(" ".join(tokens[i : i + size]))
    return grams


def _common_offers(records: list[EnrichedAdRecord], limit: int = 6) -> list[str]:
    counter: Counter[str] = Counter()
    for rec in records:
        if rec.offer_type and rec.offer_type.strip():
            counter[rec.offer_type.strip().lower()] += 1
    return [offer for offer, _ in counter.most_common(limit)]


def _cta_patterns(records: list[EnrichedAdRecord], limit: int = 6) -> list[str]:
    counter: Counter[str] = Counter()
    for rec in records:
        if rec.cta_verb and rec.cta_verb.strip():
            counter[rec.cta_verb.strip()] += 1
    return [cta for cta, _ in counter.most_common(limit)]


def _fmt(value: object) -> str:
    if value is None:
        return "(unknown)"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value) if value else "(none)"
    return str(value)


def aggregate(
    records: list[EnrichedAdRecord], client: ClientContext, llm: LlmProvider
) -> AnalysisObject:
    """REDUCE: deterministic baseline stats + one LLM synthesis -> AnalysisObject."""
    ranked = _rank_angles(records)
    winning = _normalized_winning_angles(ranked)
    saturated_cands = _saturated_candidates(ranked)
    norms = _creative_norms(records)
    keyword_seed = _keyword_seed(records)
    common_offers = _common_offers(records)
    cta_patterns = _cta_patterns(records)

    geo = ", ".join(client.geo) if client.geo else None

    # Compact digest for the LLM — never the raw corpus (no RAG; map-reduce).
    ranked_lines = (
        "\n".join(
            f"  {i + 1}. {w.angle} (weight={w.longevity_weight}, "
            f"examples={', '.join(w.example_ids or [])})"
            for i, w in enumerate(winning)
        )
        or "  (none)"
    )
    prompt = _SYNTH_PROMPT.format(
        vertical=client.vertical,
        geo=_fmt(client.geo),
        usp=_fmt(client.usp),
        offerings=_fmt(client.offerings),
        ranked_angles=ranked_lines,
        saturated_candidates=_fmt(saturated_cands),
        common_offers=_fmt(common_offers),
        cta_patterns=_fmt(cta_patterns),
        faces_frac=_fmt(norms.faces if norms else None),
        ba_frac=_fmt(norms.before_after if norms else None),
        text_density=_fmt(norms.text_density.value if norms and norms.text_density else None),
    )

    synth: _Synthesis
    try:
        synth = llm.generate_json(prompt, _Synthesis, system=_SYNTH_SYSTEM)
    except Exception as exc:  # noqa: BLE001 — fall back to deterministic-only
        logger.warning("aggregate synthesis failed, using deterministic baseline: %s", exc)
        synth = _Synthesis()

    # Merge: deterministic ranking is authoritative; LLM labels overlay it.
    labels = synth.winning_angle_labels or []
    for angle, label in zip(winning, labels, strict=False):
        if label and label.strip():
            angle.angle = label.strip()

    saturated = synth.saturated_angles or saturated_cands or None

    return AnalysisObject(
        vertical=client.vertical,
        geo=geo,
        winning_angles=winning,
        saturated_angles=saturated,
        gap_opportunities=synth.gap_opportunities or [],
        common_offers=common_offers or None,
        cta_patterns=cta_patterns or None,
        keyword_seed=keyword_seed or None,
        creative_norms=norms,
        persona=synth.persona,
    )
