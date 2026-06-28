"""Client context fed INTO analysis — a compact subset of the TS client_profile.

The analysis pipeline only needs enough about the client to scope the corpus and
steer aggregation (vertical, geo, competitors, USP). The full client_profile
lives on the Node side; this is the request payload.
"""

from __future__ import annotations

from pydantic import BaseModel


class ClientContext(BaseModel):
    name: str
    vertical: str
    geo: list[str]
    # ISO-3166-1 alpha-2 (e.g. "US"). Drives the discovery country filter; the
    # live source defaults a missing value to "US" (see scrape/live.py).
    country: str | None = None
    website: str | None = None
    competitors: list[str] | None = None
    usp: str | None = None
    offerings: list[str] | None = None


class AnalysisInput(BaseModel):
    """Request body for POST /analyze."""

    client: ClientContext
    # When true, use only the pre-cached corpus (deterministic demo path).
    use_cached_corpus: bool = True
    max_ads: int | None = None
