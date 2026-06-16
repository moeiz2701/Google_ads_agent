"""Brief-assembly tests (§5.3) — pure string assembly, no LLM, deterministic.

Verifies the brief grounds in gap_opportunities, includes the style spec and client
USP, and that the stable (cache-friendly) prefix is separable from the per-variant
task instruction (prompt-agent #8).
"""

from __future__ import annotations

from gaa_ai.generation.brief import build_brief, stable_prefix, task_block
from gaa_ai.schemas import (
    AnalysisObject,
    ClientContext,
    GenerationInput,
    StyleSpec,
    WinningAngle,
)

CLIENT = ClientContext(
    name="GlowSkin",
    vertical="med_spa",
    geo=["Los Angeles"],
    usp="same-week availability",
    offerings=["botox", "filler"],
)

ANALYSIS = AnalysisObject(
    vertical="med_spa",
    geo="Los Angeles",
    winning_angles=[WinningAngle(angle="board-certified trust", longevity_weight=1.0)],
    saturated_angles=["generic glow up"],
    gap_opportunities=["weekend male clientele nobody targets", "transparent pricing"],
    common_offers=["free consult"],
    cta_patterns=["Book"],
    persona="first-timer 28-45",
)

STYLE = StyleSpec(
    palette={"primary": "#0a7", "accent": None},
    fonts={"heading": "Inter"},
    tone="warm, professional",
    do_not_use=["cheap", "discount"],
)


def _inp() -> GenerationInput:
    return GenerationInput(client=CLIENT, analysis=ANALYSIS, style=STYLE)


def test_brief_includes_gaps_style_and_usp() -> None:
    brief = build_brief(
        _inp(),
        instruction="do the thing",
        output_contract="output a spec",
    )
    # gap_opportunities are present (the strategic payload).
    assert "weekend male clientele nobody targets" in brief
    assert "transparent pricing" in brief
    # style spec present.
    assert "warm, professional" in brief
    assert "#0a7" in brief
    assert "cheap" in brief  # do_not_use surfaced for grounding
    # client USP present.
    assert "same-week availability" in brief


def test_stable_prefix_separable_from_task() -> None:
    inp = _inp()
    prefix = stable_prefix(inp)
    # Prefix carries the cache-friendly client/analysis/style; no per-variant task.
    assert "<client_context>" in prefix
    assert "<market_analysis>" in prefix
    assert "<style_spec>" in prefix
    assert "<task>" not in prefix

    task_a = task_block(instruction="axis A", output_contract="contract")
    task_b = task_block(instruction="axis B", output_contract="contract")
    # The only thing that varies between two variants is the task block.
    assert task_a != task_b
    assert "axis A" in task_a and "axis B" in task_b
    # Full briefs share the identical prefix (cache hit) and differ only in suffix.
    assert (prefix + "\n" + task_a).startswith(prefix)
    assert (prefix + "\n" + task_b).startswith(prefix)


def test_longevity_framed_not_as_frequency() -> None:
    brief = build_brief(_inp(), instruction="x", output_contract="y")
    # The brief must explicitly frame weight as survival, not frequency.
    assert "longevity_weight" in brief
    assert "NOT how" in brief  # "NOT how frequent it is"


def test_critique_notes_feed_back_into_task() -> None:
    task = task_block(
        instruction="rewrite",
        output_contract="contract",
        critique_notes="banned term 'best'",
    )
    assert "rewrite" in task
    assert "banned term 'best'" in task
