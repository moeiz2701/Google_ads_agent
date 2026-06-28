"""Relevance gate tests (§4, live discovery funnel stage 2) — no network/LLM.

The gate drops off-topic ads via one batched LLM call but must NEVER nuke the
corpus on an LLM failure (the country filter is the floor). FakeLlm is seeded with
the internal verdict schema so the keep/drop logic is exercised deterministically.
"""

from __future__ import annotations

import pytest

from gaa_ai.llm.base import FakeLlm
from gaa_ai.pipeline.relevance import _RelevanceVerdict, filter_relevant
from gaa_ai.schemas import ClientContext, EnrichedAdRecord

CLIENT = ClientContext(name="Glow", vertical="Medical Spa", geo=["Los Angeles"], country="US")


def _rec(ad_id: str, value_prop: str) -> EnrichedAdRecord:
    return EnrichedAdRecord(ad_id=ad_id, advertiser="x", primary_value_prop=value_prop)


def test_relevance_drops_off_topic_ids() -> None:
    llm = FakeLlm({"_RelevanceVerdict": _RelevanceVerdict(off_topic_ids=["b"])})
    recs = [_rec("a", "Botox & fillers"), _rec("b", "Mattress sale"), _rec("c", "Laser facials")]
    kept = filter_relevant(recs, CLIENT, llm)
    assert [r.ad_id for r in kept] == ["a", "c"]


def test_relevance_empty_verdict_keeps_all() -> None:
    llm = FakeLlm({"_RelevanceVerdict": _RelevanceVerdict(off_topic_ids=[])})
    recs = [_rec("a", "Botox"), _rec("b", "Laser hair removal")]
    assert filter_relevant(recs, CLIENT, llm) == recs


def test_relevance_unknown_ids_are_ignored() -> None:
    # A model that returns an id we never sent must not drop anything real.
    llm = FakeLlm({"_RelevanceVerdict": _RelevanceVerdict(off_topic_ids=["zzz", ""])})
    recs = [_rec("a", "Botox"), _rec("b", "Laser")]
    assert [r.ad_id for r in filter_relevant(recs, CLIENT, llm)] == ["a", "b"]


def test_relevance_llm_failure_keeps_all() -> None:
    class ExplodingLlm(FakeLlm):
        def generate_json(self, prompt, schema, *, system=None, temperature=0.3):  # type: ignore[no-untyped-def]
            raise RuntimeError("boom")

    recs = [_rec("a", "Botox"), _rec("b", "Laser")]
    assert filter_relevant(recs, CLIENT, ExplodingLlm()) == recs


def test_relevance_empty_input_returns_empty() -> None:
    assert filter_relevant([], CLIENT, FakeLlm()) == []


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
