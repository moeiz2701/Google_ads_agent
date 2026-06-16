"""Module 2 analysis pipeline: scrape -> enrich (MAP) -> aggregate (REDUCE).

Public entry point is ``run_analysis``; api.py and cli.py depend on it.
"""

from gaa_ai.pipeline.aggregate import aggregate
from gaa_ai.pipeline.enrich import enrich_ad, enrich_corpus
from gaa_ai.pipeline.run import run_analysis

__all__ = ["run_analysis", "enrich_ad", "enrich_corpus", "aggregate"]
