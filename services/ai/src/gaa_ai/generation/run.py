"""Module 3 orchestration: brief -> generate (per format x axes) -> critique/gate/regen.

Public entry point ``generate_variants``; api.py and tests depend on it.

Flow per requested format:
    1. Plan deterministic axes (gaps first), generate one variant per axis.
    2. Critique each variant (LLM rubric + deterministic policy hard-gate).
    3. If a variant fails ``.passed``, regenerate it up to MAX_REGEN times, feeding
       the critique notes back into the brief so the rewrite fixes the named issue.
    4. If it still fails, DROP it (we never ship policy-unsafe ads) and log.

Only passing variants (each carrying its CritiqueScore) are returned. ``llm`` is
injectable so tests pass a FakeLlm; production defaults to ``get_llm()`` (which
raising on a missing key is the correct, expected behavior).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from gaa_ai.generation.critique import MAX_REGEN, critique_variant
from gaa_ai.generation.generate import _plan_axes, generate_one
from gaa_ai.llm.base import LlmProvider
from gaa_ai.llm.factory import get_llm
from gaa_ai.schemas import GenerationInput, GenerationResult, Variant

logger = logging.getLogger("gaa_ai.generation.run")


def _resolve_variant(
    inp: GenerationInput, fmt: object, plan: object, llm: LlmProvider, variant: Variant
) -> Variant | None:
    """Critique, then regenerate-with-feedback up to MAX_REGEN. None if unshippable."""
    from gaa_ai.schemas import AdFormat  # local: keep top imports lean

    assert isinstance(fmt, AdFormat)
    score = critique_variant(inp, variant, llm)
    variant = variant.model_copy(update={"critique": score})
    if score.passed:
        return variant

    notes = score.notes
    for attempt in range(1, MAX_REGEN + 1):
        logger.info(
            "regenerating variant (axis=%s, attempt=%d/%d): %s",
            getattr(plan, "axis", "?"),
            attempt,
            MAX_REGEN,
            notes,
        )
        regen = generate_one(inp, fmt, plan, llm, critique_notes=notes)  # type: ignore[arg-type]
        if regen is None:
            continue
        score = critique_variant(inp, regen, llm)
        regen = regen.model_copy(update={"critique": score, "regenerated": True})
        if score.passed:
            return regen
        notes = score.notes
        variant = regen

    logger.warning(
        "dropping variant after %d regen attempts (axis=%s): %s",
        MAX_REGEN,
        getattr(plan, "axis", "?"),
        notes,
    )
    return None


def generate_variants(
    inp: GenerationInput, llm: LlmProvider | None = None
) -> GenerationResult:
    """Run Module 3 end-to-end and return only passing, validated variants."""
    llm = llm or get_llm()

    variants: list[Variant] = []
    for fmt in inp.formats:
        plans = _plan_axes(inp, inp.n_per_format)
        for plan in plans:
            initial = generate_one(inp, fmt, plan, llm)
            if initial is None:
                continue
            resolved = _resolve_variant(inp, fmt, plan, llm, initial)
            if resolved is not None:
                variants.append(resolved)

    return GenerationResult(
        variants=variants,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
