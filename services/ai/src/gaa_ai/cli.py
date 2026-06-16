"""CLI: run the analysis pipeline for a client and print the AnalysisObject.

    gaa-analyze --vertical med_spa --geo "Los Angeles" --name "GlowSkin"
"""

from __future__ import annotations

import argparse
import sys

from gaa_ai.schemas import AnalysisInput, ClientContext


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run Module 2 competitor analysis.")
    parser.add_argument("--name", default="Demo Client")
    parser.add_argument("--vertical", default="med_spa")
    parser.add_argument("--geo", action="append", default=[])
    parser.add_argument("--usp", default=None)
    parser.add_argument("--live", action="store_true", help="Use live scraping instead of cached.")
    args = parser.parse_args(argv)

    from gaa_ai.pipeline import run_analysis

    inp = AnalysisInput(
        client=ClientContext(
            name=args.name,
            vertical=args.vertical,
            geo=args.geo or ["Los Angeles"],
            usp=args.usp,
        ),
        use_cached_corpus=not args.live,
    )
    result = run_analysis(inp)
    print(result.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
