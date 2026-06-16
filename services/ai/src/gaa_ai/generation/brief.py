"""Brief assembly (§5.3): structured prompt, NOT RAG.

The analysis is pre-distilled (map-reduce, Module 2), so the whole thing fits in a
few-thousand-token brief that we include verbatim — that is context caching, not
retrieval. There is no vector store and no per-variant lookup.

Caching discipline (prompt-agent #8): the brief splits into a STABLE PREFIX
(``client_context`` + ``market_analysis`` + ``style_spec`` — identical across every
variant for one client) and a per-variant ``<task>`` that is the only thing that
varies. Generating N variants reuses the prefix N times, so a provider with prefix
caching pays for it once. We therefore build the two halves separately and the
caller concatenates ``stable_prefix() + task_block(...)``.

Grounding (CLAUDE.md): the market_analysis section leads with gap_opportunities (the
strategic payload) and presents winning_angles with their longevity_weight so the
model never reads "frequent" as "works". Every variant instruction names the exact
insight it must exploit.

This module is pure string assembly — no LLM call.
"""

from __future__ import annotations

from gaa_ai.schemas import GenerationInput, StyleSpec


def _fmt_list(values: list[str] | None, *, empty: str = "(none)") -> str:
    if not values:
        return empty
    return ", ".join(str(v) for v in values)


def _client_context_block(inp: GenerationInput) -> str:
    c = inp.client
    geo = _fmt_list(c.geo, empty="(unspecified)")
    return (
        "<client_context>\n"
        f"  name: {c.name}\n"
        f"  vertical: {c.vertical}\n"
        f"  geo: {geo}\n"
        f"  usp: {c.usp or '(unspecified)'}\n"
        f"  offerings: {_fmt_list(c.offerings)}\n"
        "</client_context>"
    )


def _market_analysis_block(inp: GenerationInput) -> str:
    a = inp.analysis
    # gap_opportunities first: this is the strategic payload we want owned.
    gaps = (
        "\n".join(f"    - {g}" for g in a.gap_opportunities)
        if a.gap_opportunities
        else "    (none surfaced)"
    )
    winners = (
        "\n".join(
            f"    - {w.angle} (longevity_weight={w.longevity_weight})"
            for w in a.winning_angles
        )
        if a.winning_angles
        else "    (none)"
    )
    saturated = (
        "\n".join(f"    - {s}" for s in a.saturated_angles)
        if a.saturated_angles
        else "    (none)"
    )
    return (
        "<market_analysis>\n"
        "  gap_opportunities (angles the corpus does NOT cover — prioritize these):\n"
        f"{gaps}\n"
        "  winning_angles (longevity_weight = how long the angle survived, NOT how\n"
        "  frequent it is; a high weight means it kept being paid for):\n"
        f"{winners}\n"
        "  saturated_angles (crowded or short-lived — do not copy):\n"
        f"{saturated}\n"
        f"  common_offers: {_fmt_list(a.common_offers)}\n"
        f"  cta_patterns: {_fmt_list(a.cta_patterns)}\n"
        f"  persona: {a.persona or '(unspecified)'}\n"
        "</market_analysis>"
    )


def _style_spec_block(style: StyleSpec | None) -> str:
    if style is None:
        return (
            "<style_spec>\n"
            "  (no brand kit provided — use neutral, professional styling)\n"
            "</style_spec>"
        )
    palette = (
        ", ".join(f"{k}={v}" for k, v in style.palette.items() if v)
        if style.palette
        else "(unspecified)"
    )
    fonts = (
        ", ".join(f"{k}={v}" for k, v in style.fonts.items() if v)
        if style.fonts
        else "(unspecified)"
    )
    return (
        "<style_spec>\n"
        f"  palette: {palette}\n"
        f"  fonts: {fonts}\n"
        f"  tone: {style.tone or '(unspecified)'}\n"
        f"  do_not_use: {_fmt_list(style.do_not_use)}\n"
        "</style_spec>"
    )


def stable_prefix(inp: GenerationInput) -> str:
    """The cache-friendly prefix: identical for every variant of one client.

    client_context + market_analysis + style_spec. The per-variant ``<task>`` is
    appended separately by ``task_block`` so only that suffix changes per call.
    """
    return "\n".join(
        [
            _client_context_block(inp),
            _market_analysis_block(inp),
            _style_spec_block(inp.style),
        ]
    )


def task_block(
    *,
    instruction: str,
    output_contract: str,
    critique_notes: str | None = None,
) -> str:
    """The only part that varies per variant (the per-axis instruction).

    ``instruction`` names the axis + the exact insight to exploit; ``output_contract``
    states the structured-output expectation; ``critique_notes`` (regen pass only)
    feeds back what failed so the rewrite fixes it.
    """
    parts = [
        "<task>",
        f"  {instruction}",
        f"  {output_contract}",
        "  Ground the variant in the named insight above — copy must clearly express it.",
        "  Use one clear message and a concrete call to action.",
        "  Keep all claims defensible: state facts, not superlatives.",
    ]
    if critique_notes:
        parts.append(
            "  This is a rewrite. The previous attempt was rejected for: "
            f"{critique_notes}. Fix exactly that while keeping the angle."
        )
    parts.append("</task>")
    return "\n".join(parts)


def build_brief(
    inp: GenerationInput,
    *,
    instruction: str,
    output_contract: str,
    critique_notes: str | None = None,
) -> str:
    """Full brief = stable prefix + per-variant task. Caller passes prefix-cacheable
    blocks first, varying suffix last (prompt-agent #8)."""
    return (
        stable_prefix(inp)
        + "\n"
        + task_block(
            instruction=instruction,
            output_contract=output_contract,
            critique_notes=critique_notes,
        )
    )


GENERATION_SYSTEM = (
    "You are a senior paid-search copywriter for a Google Ads agency. You write "
    "differentiated, policy-safe ad copy grounded in the supplied competitive "
    "analysis. You fill structured slots; you never invent layout. You prioritize "
    "the gap_opportunities (angles competitors miss) over copying crowded angles. "
    "Treat a high longevity_weight as evidence an angle survives, never as proof it "
    "is the only option. State concrete, defensible benefits and avoid superlatives "
    "like 'best', '#1', or 'guaranteed'."
)
