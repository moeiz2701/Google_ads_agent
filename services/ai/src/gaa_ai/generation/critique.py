"""Critique / scoring pass (§5.5).

A second LLM pass scores each variant against a rubric and returns a CritiqueScore:
    * single_message   — is there ONE clear message? (0..1)
    * cta_strength     — is the call to action strong and concrete? (0..1)
    * differentiation  — does it stand out from the competitor set? (0..1)
    * policy_safe      — HARD GATE: Google ad-policy safety (bool)

``CritiqueScore.passed`` (schema property) requires policy_safe AND all three soft
scores >= 0.5.

Defense in depth on the hard gate
---------------------------------
We do NOT trust the LLM alone to catch policy violations. A deterministic scan runs
FIRST and can only ever DOWNGRADE policy_safe to False — it catches banned
superlatives ("best", "#1", "guaranteed", ...), clickbait, and brand ``do_not_use``
guardrail terms. If the deterministic scan finds a violation, the variant is unsafe
regardless of what the LLM said. The LLM can flag additional nuance but cannot
override a deterministic violation back to safe.

Regen / drop policy (run.py applies this):
    * A variant that fails ``.passed`` is regenerated up to MAX_REGEN times, feeding
      the critique notes back into the brief.
    * If it still fails after the budget, it is DROPPED (we never ship a
      policy-unsafe ad) and the drop is logged.
"""

from __future__ import annotations

import logging
import re

from gaa_ai.generation.brief import stable_prefix
from gaa_ai.llm.base import LlmProvider
from gaa_ai.schemas import (
    CritiqueScore,
    DisplayRenderSpec,
    GenerationInput,
    SearchRenderSpec,
    Variant,
)

logger = logging.getLogger("gaa_ai.generation.critique")

MAX_REGEN = 2

# Banned superlatives / unverifiable claims (Google policy disapproval bait).
_BANNED_PATTERNS = [
    r"\bbest\b",
    r"\b#\s*1\b",
    r"\bnumber\s+one\b",
    r"\bguarantee(d|s)?\b",
    r"\bcheapest\b",
    r"\bperfect\b",
    r"\bmiracle\b",
    r"\b100%\b",
    r"\brisk[\s-]?free\b",
    r"\bonly\s+the\s+best\b",
    r"!!!+",  # clickbait punctuation
]
_BANNED_RE = re.compile("|".join(_BANNED_PATTERNS), re.IGNORECASE)


class _CritiqueLlmScore(CritiqueScore):
    """Same shape as CritiqueScore — the LLM returns this; we re-gate it.

    A distinct subclass name keeps FakeLlm seeding unambiguous and signals that this
    is the *raw* LLM judgment before the deterministic policy override.
    """


def _variant_text(variant: Variant) -> str:
    """All human-visible copy in the variant, for the deterministic policy scan."""
    spec = variant.spec
    parts: list[str] = []
    if isinstance(spec, DisplayRenderSpec):
        parts += [spec.headline, spec.subhead or "", spec.cta]
    elif isinstance(spec, SearchRenderSpec):
        parts += [h.text for h in spec.headlines]
        parts += [d.text for d in spec.descriptions]
    return " ".join(p for p in parts if p)


def _policy_violations(text: str, do_not_use: list[str] | None) -> list[str]:
    """Deterministic hard-gate scan. Returns the list of violations found."""
    found: list[str] = []
    for m in _BANNED_RE.finditer(text):
        found.append(f"banned term '{m.group(0).strip()}'")
    for term in do_not_use or []:
        t = term.strip()
        if t and re.search(rf"\b{re.escape(t)}\b", text, re.IGNORECASE):
            found.append(f"do_not_use term '{t}'")
    return found


_CRITIQUE_SYSTEM = (
    "You are a Google Ads policy and quality reviewer. You score ad copy on a "
    "rubric and apply ad-policy safety as a hard pass/fail gate. Disallow "
    "unverifiable superlatives (best, #1, guaranteed, cheapest), trademark misuse, "
    "and clickbait. Score conservatively: when in doubt on policy, mark it unsafe."
)

_CRITIQUE_TASK = (
    "<variant_copy>\n{copy}\n</variant_copy>\n"
    "<task>\n"
    "  Score this ad against the rubric and return the structured judgment:\n"
    "  - single_message: is there one clear message? (0..1)\n"
    "  - cta_strength: is the call to action strong and concrete? (0..1)\n"
    "  - differentiation: does it stand out from typical competitors? (0..1)\n"
    "  - policy_safe: true only if it is free of banned superlatives, trademark\n"
    "    misuse, and clickbait.\n"
    "  - notes: one sentence on the biggest weakness (used to rewrite if it fails).\n"
    "</task>"
)


def critique_variant(
    inp: GenerationInput, variant: Variant, llm: LlmProvider
) -> CritiqueScore:
    """Score one variant. Deterministic policy scan can only downgrade to unsafe."""
    text = _variant_text(variant)
    do_not_use = inp.style.do_not_use if inp.style else None
    violations = _policy_violations(text, do_not_use)

    prompt = stable_prefix(inp) + "\n" + _CRITIQUE_TASK.format(copy=text)
    try:
        raw = llm.generate_json(prompt, _CritiqueLlmScore, system=_CRITIQUE_SYSTEM)
        score = CritiqueScore.model_validate(raw.model_dump())
    except Exception as exc:  # noqa: BLE001 — a failed critique is treated as a fail
        logger.warning("critique failed for axis=%s: %s", variant.axis, exc)
        score = CritiqueScore(
            single_message=0.0,
            cta_strength=0.0,
            differentiation=0.0,
            policy_safe=False,
            notes=f"critique call failed: {exc}",
        )

    if violations:
        note = "; ".join(violations)
        logger.info("deterministic policy gate failed for axis=%s: %s", variant.axis, note)
        score = score.model_copy(
            update={
                "policy_safe": False,
                "notes": f"policy: {note}"
                + (f" | {score.notes}" if score.notes else ""),
            }
        )
    return score
