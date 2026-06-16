"""Cached ad source — loads a pre-bundled demo corpus by vertical.

Ensures the demo always works regardless of scraper/network state (§13).
"""

from __future__ import annotations

import json
from pathlib import Path

from gaa_ai.schemas import ClientContext, RawAd

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"


class CachedAdSource:
    name = "cached"

    def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
        vertical = _normalize(client.vertical)
        path = _FIXTURES / vertical / "ads.json"
        if not path.exists():
            # Fall back to med_spa demo corpus if the vertical isn't cached.
            path = _FIXTURES / "med_spa" / "ads.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        ads = [RawAd.model_validate(item) for item in raw]
        return ads[:max_ads]


def _normalize(vertical: str) -> str:
    return vertical.strip().lower().replace(" ", "_").replace("-", "_")
