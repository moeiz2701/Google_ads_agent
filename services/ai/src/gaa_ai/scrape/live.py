"""Live ad sources: Google Ads Transparency Center + SerpApi fallback (§4.1).

Google has no official Transparency Center API; production-grade scraping needs
a headless browser + proxy rotation (a Phase-2-production concern, §12). This
module provides the SerpApi fallback (a real, supported API) and a documented
seam for the OSS Transparency scraper. Both raise ScrapeError when unavailable
so the caller falls back to the cached corpus.
"""

from __future__ import annotations

import httpx

from gaa_ai.config import get_settings
from gaa_ai.schemas import ClientContext, RawAd
from gaa_ai.scrape.base import ScrapeError

_SERPAPI = "https://serpapi.com/search.json"


class LiveAdSource:
    name = "live"

    def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
        settings = get_settings()
        if settings.serpapi_api_key:
            return _fetch_serpapi(client, max_ads, settings.serpapi_api_key)
        raise ScrapeError(
            "No live ad source configured. Set SERPAPI_API_KEY, or run with "
            "use_cached_corpus=true for the demo corpus."
        )


def _fetch_serpapi(client: ClientContext, max_ads: int, api_key: str) -> list[RawAd]:
    """Query SerpApi for ads in the client's market.

    SerpApi's ad coverage is shallow vs. the Transparency Center; this is the
    zero-cost fallback, not the primary source. Maps results into RawAd best-effort.
    """
    query = " ".join(filter(None, [client.vertical, *(client.geo or [])]))[:200]
    try:
        resp = httpx.get(
            _SERPAPI,
            params={"engine": "google", "q": query, "api_key": api_key},
            timeout=20.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ScrapeError(f"SerpApi request failed: {exc}") from exc

    ads_raw = data.get("ads") or []
    out: list[RawAd] = []
    for i, ad in enumerate(ads_raw[:max_ads]):
        out.append(
            RawAd(
                ad_id=f"serpapi-{i}",
                advertiser=ad.get("source"),
                source="serpapi",
                format="search",
                headline=ad.get("title"),
                body=ad.get("description"),
                landing_url=ad.get("link"),
            )
        )
    if not out:
        raise ScrapeError("SerpApi returned no ads for this query")
    return out
