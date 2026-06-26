"""Generation along deliberate axes (§5.4).

We produce a legible TEST MATRIX, not random ads: each variant varies ONE axis at a
time so the agency can read "here are N strategic directions". The axes, in priority
order, exploit gap_opportunities first (the strategic payload, CLAUDE.md):

    axis 0  gap-angle      -> first gap_opportunity (own what competitors miss)
    axis 1  gap-angle-2 /  -> second gap, else a second winning angle (different hook)
            proven-angle
    axis 2  proven-angle   -> top winning_angle (a survivor, for contrast)
    axis 3+ proven-angle-k -> further winning angles, cycling

Each Variant records ``axis`` (which dimension it explores) and ``insight_ref`` (the
exact gap/angle string it exploits) so the Insights view can show the tie-back. A
variant with no insight_ref is not done.

RenderSpec union handling
-------------------------
``RenderSpec`` is an Annotated discriminated union, not a BaseModel — it cannot be
passed to ``generate_json`` as a schema. We pass the CONCRETE per-format model
(``DisplayRenderSpec`` or ``SearchRenderSpec``) and let the resulting object slot
into the union-typed ``Variant.spec`` field (which validates the discriminator).

Guardrails enforced here (deterministic, not trusted to the LLM):
    * Display ``template_id`` must be in DISPLAY_TEMPLATES — invalid -> coerced to a
      default + logged. The LLM never invents layout.
    * Display authoring size is pinned to 1200x628 (renderer fans out later, §5.6).
    * RSA char limits are repaired (truncate over-limit, pad if too few) BEFORE
      schema validation so we never ship over-limit assets and never crash the batch.
      The LLM is parsed into a LENIENT model (no length caps) — a real model
      routinely overshoots the 30/90-char RSA maxima, and the strict schema would
      reject it inside the structured-output parser before repair could run.

Per-variant LLM failure is logged and skipped — it must not kill the batch.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from pydantic import BaseModel

from gaa_ai.generation.brief import (
    GENERATION_SYSTEM,
    build_brief,
)
from gaa_ai.llm.base import LlmProvider
from gaa_ai.schemas import (
    AdFormat,
    DisplayRenderSpec,
    GenerationInput,
    RsaDescription,
    RsaHeadline,
    SearchRenderSpec,
    Variant,
)
from gaa_ai.schemas.render_spec import (
    DESCRIPTION_MAX,
    HEADLINE_MAX,
)
from gaa_ai.templates import DISPLAY_TEMPLATES, is_valid_template

logger = logging.getLogger("gaa_ai.generation.generate")

# Coercion target when the LLM returns an unknown template_id. A safe, generic
# layout that works for any vertical.
DEFAULT_TEMPLATE_ID = "bold_centered"
AUTHORING_SIZE = "1200x628"

# RSA shape targets (within Google maxima of 15 headlines / 4 descriptions).
HEADLINE_TARGET = 10
HEADLINE_MIN = 3  # schema min_length
DESCRIPTION_TARGET = 4
DESCRIPTION_MIN = 2  # schema min_length


@dataclass(frozen=True)
class _AxisPlan:
    """One row of the test matrix: an axis label + the insight it exploits."""

    axis: str
    insight_ref: str
    # Human-readable instruction fragment describing how to use the insight.
    direction: str


def _plan_axes(inp: GenerationInput, n: int) -> list[_AxisPlan]:
    """Build n axis plans, gap_opportunities first then winning angles.

    Deterministic so the test matrix is reproducible. Every plan carries a concrete
    insight_ref — if the analysis is empty we fall back to the client USP so a
    variant is never ungrounded.
    """
    a = inp.analysis
    gaps = list(a.gap_opportunities or [])
    winners = [w.angle for w in a.winning_angles]
    fallback = inp.client.usp or f"{inp.client.vertical} positioning"

    plans: list[_AxisPlan] = []
    # 1) Gaps first (strategic payload).
    for i, gap in enumerate(gaps):
        plans.append(
            _AxisPlan(
                axis="gap-angle" if i == 0 else f"gap-angle-{i + 1}",
                insight_ref=gap,
                direction=(
                    f"Exploit this market GAP that competitors do not cover: '{gap}'. "
                    "Make this the single message of the ad."
                ),
            )
        )
    # 2) Then proven survivor angles, for contrast.
    for i, angle in enumerate(winners):
        plans.append(
            _AxisPlan(
                axis="proven-angle" if i == 0 else f"proven-angle-{i + 1}",
                insight_ref=angle,
                direction=(
                    f"Lead with this PROVEN, long-surviving angle: '{angle}', but "
                    "differentiate the wording from typical competitor phrasing."
                ),
            )
        )
    # 3) Fallback so we always have >= n grounded plans.
    while len(plans) < n:
        k = len(plans) + 1
        plans.append(
            _AxisPlan(
                axis=f"usp-angle-{k}",
                insight_ref=fallback,
                direction=f"Lead with the client's own differentiator: '{fallback}'.",
            )
        )
    return plans[:n]


# --- Display ---------------------------------------------------------------


def _coerce_template(template_id: str | None) -> str:
    if template_id and is_valid_template(template_id):
        return template_id
    logger.warning(
        "LLM returned invalid display template_id %r; coercing to %r (valid: %s)",
        template_id,
        DEFAULT_TEMPLATE_ID,
        ", ".join(DISPLAY_TEMPLATES),
    )
    return DEFAULT_TEMPLATE_ID


def _repair_display(spec: DisplayRenderSpec, plan: _AxisPlan) -> DisplayRenderSpec:
    """Pin authoring size, validate template_id, ensure angle ties to the insight."""
    return spec.model_copy(
        update={
            "template_id": _coerce_template(spec.template_id),
            "size": AUTHORING_SIZE,
            "angle": spec.angle or plan.insight_ref,
        }
    )


def _generate_display(
    inp: GenerationInput, plan: _AxisPlan, llm: LlmProvider, *, critique_notes: str | None
) -> Variant:
    instruction = (
        f"Write ONE responsive DISPLAY creative. Axis: {plan.axis}. {plan.direction}"
    )
    contract = (
        "Output a DisplayRenderSpec: a template_id from "
        f"[{', '.join(DISPLAY_TEMPLATES)}], a headline (<= ~30 chars), an optional "
        "subhead, a cta (imperative, <= ~20 chars), an optional image query, and an "
        "'angle' string naming the insight this exploits."
    )
    prompt = build_brief(
        inp, instruction=instruction, output_contract=contract, critique_notes=critique_notes
    )
    raw = llm.generate_json(prompt, DisplayRenderSpec, system=GENERATION_SYSTEM)
    spec = _repair_display(raw, plan)
    return Variant(
        spec=spec,
        insight_ref=plan.insight_ref,
        axis=plan.axis,
        regenerated=critique_notes is not None,
    )


# --- Search ----------------------------------------------------------------


class _LooseRsaHeadline(BaseModel):
    """An RSA headline as the LLM emits it — no length cap, so the structured-output
    parser accepts over-limit text and the deterministic repair truncates it."""

    text: str = ""
    pin: int | None = None


class _LooseRsaDescription(BaseModel):
    text: str = ""
    pin: int | None = None


class _LooseSearchRenderSpec(BaseModel):
    """Lenient parse target for the RSA call. Mirrors SearchRenderSpec WITHOUT the
    char-length / list-length constraints so real-model overshoot never fails the
    parse; _repair_search converts this into a valid strict SearchRenderSpec."""

    headlines: list[_LooseRsaHeadline] = []
    descriptions: list[_LooseRsaDescription] = []
    angle: str | None = None


def _truncate(text: str, limit: int) -> str:
    """Truncate to ``limit`` at a WORD boundary so we never ship a mid-word fragment
    (which reads as an incomplete sentence and tanks the quality critique)."""
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if " " in cut:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,;:-")


def _pin(value: int | None, allowed: tuple[int, ...]) -> int | None:
    """Keep only RSA pin values the strict schema allows; drop anything else."""
    return value if value in allowed else None


def _repair_search(spec: _LooseSearchRenderSpec, plan: _AxisPlan) -> SearchRenderSpec:
    """Build a valid strict SearchRenderSpec from the lenient LLM output.

    Truncate over-limit assets (never ship over-limit copy); drop empties/dupes; pad
    with safe insight-derived assets if the LLM returned too few to satisfy schema
    minima. This is what makes the strict schema validation downstream always pass.
    """
    headlines: list[RsaHeadline] = []
    seen_h: set[str] = set()
    for h in spec.headlines or []:
        t = _truncate(h.text, HEADLINE_MAX)
        if t and t.lower() not in seen_h:
            seen_h.add(t.lower())
            headlines.append(RsaHeadline(text=t, pin=_pin(h.pin, (1, 2, 3))))
    descriptions: list[RsaDescription] = []
    seen_d: set[str] = set()
    for d in spec.descriptions or []:
        t = _truncate(d.text, DESCRIPTION_MAX)
        if t and t.lower() not in seen_d:
            seen_d.add(t.lower())
            descriptions.append(RsaDescription(text=t, pin=_pin(d.pin, (1, 2))))

    # Pad to schema minima with deterministic, insight-grounded fallbacks.
    pad_h = _truncate(plan.insight_ref, HEADLINE_MAX) or "Learn More Today"
    while len(headlines) < HEADLINE_MIN:
        headlines.append(RsaHeadline(text=_truncate(f"{pad_h} {len(headlines) + 1}", HEADLINE_MAX)))
    pad_d = _truncate(f"Discover {plan.insight_ref}. Get in touch today.", DESCRIPTION_MAX)
    while len(descriptions) < DESCRIPTION_MIN:
        descriptions.append(
            RsaDescription(text=_truncate(f"{pad_d} ({len(descriptions) + 1})", DESCRIPTION_MAX))
        )

    return SearchRenderSpec(
        headlines=headlines[:HEADLINE_TARGET + 2],  # within Google's 15 max
        descriptions=descriptions[:DESCRIPTION_TARGET],
        angle=spec.angle or plan.insight_ref,
    )


def _generate_search(
    inp: GenerationInput, plan: _AxisPlan, llm: LlmProvider, *, critique_notes: str | None
) -> Variant:
    instruction = (
        f"Write ONE Responsive Search Ad (RSA). Axis: {plan.axis}. {plan.direction}"
    )
    contract = (
        f"Output a SearchRenderSpec with {HEADLINE_TARGET}-12 distinct headlines and "
        f"{DESCRIPTION_TARGET} descriptions, plus an 'angle' naming the insight. "
        f"HARD CHARACTER LIMITS — count the characters and stay within them: each "
        f"headline <= {HEADLINE_MAX} chars; each description <= {DESCRIPTION_MAX} chars. "
        "Write each description as ONE complete sentence that ends with a clear call "
        "to action and fits the limit — never exceed it, never cram multiple sentences, "
        "and never end mid-thought."
    )
    prompt = build_brief(
        inp, instruction=instruction, output_contract=contract, critique_notes=critique_notes
    )
    raw = llm.generate_json(prompt, _LooseSearchRenderSpec, system=GENERATION_SYSTEM)
    spec = _repair_search(raw, plan)
    return Variant(
        spec=spec,
        insight_ref=plan.insight_ref,
        axis=plan.axis,
        regenerated=critique_notes is not None,
    )


# --- Public entry ----------------------------------------------------------


def generate_one(
    inp: GenerationInput,
    fmt: AdFormat,
    plan: _AxisPlan,
    llm: LlmProvider,
    *,
    critique_notes: str | None = None,
) -> Variant | None:
    """Generate a single variant for one format/axis. Returns None on LLM failure
    (logged) so the batch survives — graceful degradation."""
    try:
        if fmt == AdFormat.display:
            return _generate_display(inp, plan, llm, critique_notes=critique_notes)
        return _generate_search(inp, plan, llm, critique_notes=critique_notes)
    except Exception as exc:  # noqa: BLE001 — one bad variant must not kill the batch
        logger.warning(
            "variant generation failed (format=%s, axis=%s): %s", fmt.value, plan.axis, exc
        )
        return None


def generate_variants_for_format(
    inp: GenerationInput, fmt: AdFormat, llm: LlmProvider
) -> list[Variant]:
    """Produce ``inp.n_per_format`` variants for one format across deliberate axes."""
    plans = _plan_axes(inp, inp.n_per_format)
    out: list[Variant] = []
    for plan in plans:
        variant = generate_one(inp, fmt, plan, llm)
        if variant is not None:
            out.append(variant)
    return out
