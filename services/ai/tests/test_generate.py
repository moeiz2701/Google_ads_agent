"""Generation tests (§5.4) — offline FakeLlm, deterministic.

Covers: n_per_format per format; valid display template_id (and coercion of an
invalid one); every variant carries an insight_ref/axis; RSA char-limit repair;
axes span gap vs proven.
"""

from __future__ import annotations

from gaa_ai.generation.generate import (
    DEFAULT_TEMPLATE_ID,
    _LooseRsaDescription,
    _LooseRsaHeadline,
    _LooseSearchRenderSpec,
    _plan_axes,
    _repair_display,
    _repair_search,
    generate_variants_for_format,
)
from gaa_ai.llm.base import FakeLlm
from gaa_ai.schemas import (
    AdFormat,
    AnalysisObject,
    ClientContext,
    DisplayRenderSpec,
    GenerationInput,
    RsaDescription,
    RsaHeadline,
    SearchRenderSpec,
    WinningAngle,
)
from gaa_ai.schemas.render_spec import DESCRIPTION_MAX, HEADLINE_MAX
from gaa_ai.templates import is_valid_template

CLIENT = ClientContext(
    name="GlowSkin",
    vertical="med_spa",
    geo=["Los Angeles"],
    usp="same-week availability",
    offerings=["botox"],
)

ANALYSIS = AnalysisObject(
    vertical="med_spa",
    geo="Los Angeles",
    winning_angles=[
        WinningAngle(angle="board-certified trust", longevity_weight=1.0),
        WinningAngle(angle="natural results", longevity_weight=0.6),
    ],
    gap_opportunities=["weekend male clientele", "transparent flat pricing"],
)


def _inp(n: int = 3, formats: list[AdFormat] | None = None) -> GenerationInput:
    return GenerationInput(
        client=CLIENT,
        analysis=ANALYSIS,
        n_per_format=n,
        formats=formats or [AdFormat.search, AdFormat.display],
    )


def _display_llm(template_id: str = "split_image_left") -> FakeLlm:
    return FakeLlm(
        {
            "DisplayRenderSpec": DisplayRenderSpec(
                template_id=template_id,
                headline="Same-Week Care",
                subhead="Board-certified team",
                cta="Book Consult",
                angle="",  # left blank to prove we backfill from the insight
            )
        }
    )


def _search_llm(headlines: int = 10, descriptions: int = 4) -> FakeLlm:
    return FakeLlm(
        {
            "_LooseSearchRenderSpec": SearchRenderSpec(
                headlines=[RsaHeadline(text=f"Headline {i}") for i in range(headlines)],
                descriptions=[
                    RsaDescription(text=f"Description number {i} here.")
                    for i in range(descriptions)
                ],
                angle="",
            )
        }
    )


def test_n_per_format_display() -> None:
    out = generate_variants_for_format(_inp(n=3), AdFormat.display, _display_llm())
    assert len(out) == 3
    for v in out:
        assert isinstance(v.spec, DisplayRenderSpec)
        assert v.insight_ref  # grounded
        assert v.axis


def test_n_per_format_search() -> None:
    out = generate_variants_for_format(_inp(n=4), AdFormat.search, _search_llm())
    assert len(out) == 4
    for v in out:
        assert isinstance(v.spec, SearchRenderSpec)
        assert v.insight_ref


def test_display_template_id_always_valid() -> None:
    out = generate_variants_for_format(_inp(n=2), AdFormat.display, _display_llm())
    for v in out:
        assert isinstance(v.spec, DisplayRenderSpec)
        assert is_valid_template(v.spec.template_id)


def test_invalid_template_id_coerced() -> None:
    out = generate_variants_for_format(
        _inp(n=1), AdFormat.display, _display_llm(template_id="totally_made_up")
    )
    assert isinstance(out[0].spec, DisplayRenderSpec)
    assert out[0].spec.template_id == DEFAULT_TEMPLATE_ID


def test_display_authoring_size_pinned() -> None:
    out = generate_variants_for_format(_inp(n=1), AdFormat.display, _display_llm())
    assert isinstance(out[0].spec, DisplayRenderSpec)
    assert out[0].spec.size == "1200x628"


def test_angle_backfilled_from_insight() -> None:
    out = generate_variants_for_format(_inp(n=1), AdFormat.display, _display_llm())
    assert isinstance(out[0].spec, DisplayRenderSpec)
    # angle was blank from the LLM; repaired to the insight_ref.
    assert out[0].spec.angle == out[0].insight_ref
    assert out[0].spec.angle == "weekend male clientele"  # first gap


def test_axes_span_gap_then_proven() -> None:
    plans = _plan_axes(_inp(n=4), 4)
    axes = [p.axis for p in plans]
    refs = [p.insight_ref for p in plans]
    # Two gaps come first, then proven angles — a legible matrix, gaps prioritized.
    assert axes[0] == "gap-angle"
    assert axes[1] == "gap-angle-2"
    assert "proven-angle" in axes
    assert refs[0] == "weekend male clientele"
    assert refs[1] == "transparent flat pricing"
    assert refs[2] == "board-certified trust"


def test_rsa_char_limits_repaired() -> None:
    # The LLM is parsed into the lenient model, which accepts over-limit copy; the
    # repair is what enforces the strict RSA maxima. Build that lenient input here.
    over = _LooseSearchRenderSpec(
        headlines=[
            _LooseRsaHeadline(text="x" * 80, pin=None),  # over 30
            _LooseRsaHeadline(text="Short One", pin=None),
        ],
        descriptions=[
            _LooseRsaDescription(text="y" * 200, pin=None),  # over 90
        ],
        angle="",
    )
    plan = _plan_axes(_inp(n=1), 1)[0]
    repaired = _repair_search(over, plan)
    # Validation now passes and no asset exceeds its limit.
    SearchRenderSpec.model_validate(repaired.model_dump())
    for h in repaired.headlines:
        assert len(h.text) <= HEADLINE_MAX
    for d in repaired.descriptions:
        assert len(d.text) <= DESCRIPTION_MAX
    # Padded to schema minima (>=3 headlines, >=2 descriptions).
    assert len(repaired.headlines) >= 3
    assert len(repaired.descriptions) >= 2


def test_display_repair_validates() -> None:
    raw = DisplayRenderSpec.model_construct(
        format="display",
        template_id="nope",
        size="999x999",
        headline="Hi",
        subhead=None,
        cta="Go",
        palette_ref=None,
        image=None,
        angle="",
    )
    plan = _plan_axes(_inp(n=1), 1)[0]
    fixed = _repair_display(raw, plan)
    DisplayRenderSpec.model_validate(fixed.model_dump())
    assert fixed.template_id == DEFAULT_TEMPLATE_ID
    assert fixed.size == "1200x628"
    assert fixed.angle == plan.insight_ref


def test_per_variant_failure_does_not_kill_batch() -> None:
    class FlakyLlm(FakeLlm):
        def __init__(self) -> None:
            super().__init__()
            self.calls = 0

        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("transient provider error")
            return DisplayRenderSpec(
                template_id="bold_centered", headline="Ok", cta="Book", angle="x"
            )

    out = generate_variants_for_format(_inp(n=3), AdFormat.display, FlakyLlm())
    # First variant failed and was skipped; the other two survived.
    assert len(out) == 2
