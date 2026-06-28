"""Ad source interface (§4.1).

Sources return a corpus of RawAd. Strategy:
  - cached  : pre-bundled demo corpus (so the demo always works, §13)
  - google  : Google Ads Transparency Center scraper (no official API)
  - serpapi : SerpApi free-tier fallback

MVP demo path uses `cached`. The live sources are real-world fragile, so they
degrade gracefully and the caller can fall back to cached.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from gaa_ai.schemas import ClientContext, RawAd


class ScrapeError(Exception):
    """A scrape failed. The caller may fall back to the cached corpus."""


class NoRelevantAdsError(ScrapeError):
    """Discovery reached the source but the country/relevance filters left too
    few usable ads. ACTIONABLE (change category or location) — the caller must
    NOT silently fall back to the cached corpus; it is surfaced to the user.
    Subclasses ScrapeError so existing ``except ScrapeError`` sites still catch
    it, but the fallback sites re-raise it explicitly.
    """


@runtime_checkable
class AdSource(Protocol):
    name: str

    def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]: ...


def get_ad_source(*, use_cached: bool) -> AdSource:
    """Return the configured ad source. Cached for the demo; live otherwise."""
    if use_cached:
        from gaa_ai.scrape.cached import CachedAdSource

        return CachedAdSource()

    # Live path: try Google Transparency, fall back to SerpApi. Both raise
    # ScrapeError when not configured/available so the caller can fall back.
    from gaa_ai.scrape.live import LiveAdSource

    return LiveAdSource()
