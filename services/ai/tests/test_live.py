"""LiveAdSource tests (§4.1) — pure parse/mapping/spread, no network.

Network calls (autocomplete RPC, SerpApi) are not exercised here; we test the
deterministic logic that maps their (verified) response shapes into RawAd and
spreads creatives across advertisers.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from gaa_ai.schemas import ClientContext, RawAd
from gaa_ai.scrape import live
from gaa_ai.scrape.base import NoRelevantAdsError
from gaa_ai.scrape.live import (
    _collect_creatives,
    _discover_advertisers,
    _discovery_queries,
    _parse_suggestions,
    _still_active,
    _to_rawad,
    _ts_to_date,
)


def test_parse_suggestions_extracts_name_id_country() -> None:
    data = {
        "1": [
            {"1": {"1": "LaserAway, LLC", "2": "AR0375", "3": "US"}},
            {"1": {"1": "LaserAway Cyprus LTD", "2": "AR1492", "3": "CY"}},
            {"1": {"3": "US"}},  # no advertiser_id -> skipped
        ]
    }
    assert _parse_suggestions(data) == [
        ("LaserAway, LLC", "AR0375", "US"),
        ("LaserAway Cyprus LTD", "AR1492", "CY"),
    ]


def test_parse_suggestions_tolerates_garbage() -> None:
    assert _parse_suggestions({}) == []
    assert _parse_suggestions("nope") == []
    assert _parse_suggestions({"1": [None, 5, {"x": 1}, {"1": "str"}]}) == []


def test_discovery_queries_competitors_first_then_vertical_deduped() -> None:
    client = ClientContext(
        name="X",
        vertical="med spa",
        geo=["Los Angeles"],
        competitors=["LaserAway", "Ideal Image", "  med spa  "],  # dupe of vertical
    )
    assert _discovery_queries(client) == ["LaserAway", "Ideal Image", "med spa"]


def test_discovery_queries_vertical_only_when_no_competitors() -> None:
    client = ClientContext(name="X", vertical="med spa", geo=["LA"])
    assert _discovery_queries(client) == ["med spa"]


def test_to_rawad_maps_fields_format_and_leaves_copy_for_vision() -> None:
    creative = {
        "ad_creative_id": "CR9",
        "advertiser": "Mediko SpA",
        "format": "text",
        "image": "https://tpc.googlesyndication.com/archive/simgad/1",
        "details_link": "https://adstransparency.google.com/advertiser/AR/creative/CR9",
        "first_shown": 1730420256,
        "last_shown": 1782563275,
        "total_days_shown": 551,
    }
    ad = _to_rawad(creative, "fallback name")
    assert ad is not None
    assert ad.ad_id == "gtc-CR9"
    assert ad.advertiser == "Mediko SpA"
    assert ad.source == "google_transparency"
    assert ad.format == "search"  # "text" -> search
    assert ad.image_url is not None and ad.image_url.startswith("https://tpc")
    assert ad.headline is None and ad.body is None  # copy is read from the image
    assert isinstance(ad.first_shown, date)
    assert isinstance(ad.last_shown, date)


def test_to_rawad_format_mapping_and_fallbacks() -> None:
    assert _to_rawad({"ad_creative_id": "C1", "format": "image"}, "x").format == "display"
    assert _to_rawad({"ad_creative_id": "C2", "format": "video"}, "x").format == "video"
    assert _to_rawad({"ad_creative_id": "C3", "format": "weird"}, "x").format == "unknown"
    # advertiser falls back to the discovery name when the creative omits it
    assert _to_rawad({"ad_creative_id": "C4"}, "Disco Name").advertiser == "Disco Name"


def test_to_rawad_requires_creative_id() -> None:
    assert _to_rawad({"format": "image"}, "x") is None


def test_ts_to_date_tolerant() -> None:
    assert _ts_to_date(None) is None
    assert _ts_to_date(0) is None
    assert _ts_to_date("") is None
    assert _ts_to_date("bad") is None
    assert _ts_to_date(1730420256) == datetime.fromtimestamp(1730420256, tz=timezone.utc).date()


def test_still_active_window() -> None:
    ts = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())
    assert _still_active(ts, today=date(2025, 1, 3)) is True   # 2 days -> active
    assert _still_active(ts, today=date(2025, 2, 1)) is False  # 31 days -> inactive
    assert _still_active(None) is None


def test_collect_creatives_spreads_across_advertisers_and_caps(monkeypatch) -> None:
    def fake_fetch(advertiser_id: str, name: str, key: str) -> list[RawAd]:
        return [
            RawAd(ad_id=f"{name}-{i}", source="google_transparency", format="search")
            for i in range(10)
        ]

    monkeypatch.setattr(live, "_fetch_advertiser_creatives", fake_fetch)
    advertisers = [("A", "a"), ("B", "b"), ("C", "c")]
    out = _collect_creatives(advertisers, "key", max_ads=6)
    assert len(out) == 6  # capped
    # 6 ads / 3 advertisers -> 2 each: spread across all three competitors
    assert {ad.ad_id.split("-")[0] for ad in out} == {"A", "B", "C"}


def test_suggest_fails_fast_on_consent_redirect(monkeypatch) -> None:
    """A 3xx (Google '/sorry' anti-bot redirect) is IP-level and won't clear in
    this request, so _suggest must give up immediately, not burn retries."""
    calls = {"n": 0}

    class _Resp:
        status_code = 302
        text = "<html>302 Moved</html>"

        def json(self) -> object:
            raise ValueError("not json")

    class _Client:
        def __init__(self, *args: object, **kwargs: object) -> None: ...
        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *args: object) -> bool:
            return False

        def post(self, *args: object, **kwargs: object) -> _Resp:
            calls["n"] += 1
            return _Resp()

    class _Settings:
        scraper_api_url = None
        scraper_proxy_url = None
        scraper_proxy_verify_ssl = True

    # Force the proxy/direct path (httpx.Client) regardless of the local .env.
    monkeypatch.setattr(live, "get_settings", lambda: _Settings())
    monkeypatch.setattr(live.httpx, "Client", _Client)
    assert live._suggest("nike", 5) == []
    assert calls["n"] == 1  # no retries on a hard block


# --- discovery country filter -------------------------------------------------


class _FilterSettings:
    """Minimal settings stub: country filter ON (independent of the local .env)."""

    discovery_country_filter = True


def _patch_suggest(monkeypatch, suggestions: list[tuple[str, str, str]]) -> None:
    monkeypatch.setattr(live, "get_settings", lambda: _FilterSettings())
    monkeypatch.setattr(live, "_suggest", lambda query, limit: list(suggestions))


def test_discover_filters_to_client_country(monkeypatch) -> None:
    _patch_suggest(
        monkeypatch,
        [("LaserAway", "AR1", "US"), ("Bangkok Air", "AR2", "TH"), ("Roma Spa", "AR3", "IT")],
    )
    client = ClientContext(name="X", vertical="med spa", geo=["LA"], country="US")
    # Foreign-market advertisers (TH, IT) are dropped at the source.
    assert _discover_advertisers(client) == [("LaserAway", "AR1")]


def test_discover_keeps_untagged_after_exact_matches(monkeypatch) -> None:
    _patch_suggest(
        monkeypatch,
        [("Tagged US", "AR1", "US"), ("Untagged", "AR2", ""), ("Thai", "AR3", "TH")],
    )
    client = ClientContext(name="X", vertical="med spa", geo=["LA"], country="US")
    # Exact matches first, then untagged (benefit of the doubt); Thai dropped.
    assert _discover_advertisers(client) == [("Tagged US", "AR1"), ("Untagged", "AR2")]


def test_discover_defaults_country_to_us_when_unset(monkeypatch) -> None:
    _patch_suggest(monkeypatch, [("LaserAway", "AR1", "US"), ("Thai", "AR2", "TH")])
    client = ClientContext(name="X", vertical="med spa", geo=["LA"])  # no country
    assert _discover_advertisers(client) == [("LaserAway", "AR1")]


def test_discover_raw_empty_returns_empty(monkeypatch) -> None:
    """Nothing discovered at all -> [] (recoverable; the caller may use cached)."""
    _patch_suggest(monkeypatch, [])
    client = ClientContext(name="X", vertical="med spa", geo=["LA"], country="US")
    assert _discover_advertisers(client) == []


def test_discover_none_in_market_raises_no_relevant(monkeypatch) -> None:
    """Reached the source but every advertiser is foreign -> actionable error."""
    _patch_suggest(monkeypatch, [("Thai", "AR1", "TH"), ("Roma", "AR2", "IT")])
    client = ClientContext(name="X", vertical="med spa", geo=["LA"], country="US")
    with pytest.raises(NoRelevantAdsError):
        _discover_advertisers(client)


def test_discover_filter_can_be_disabled(monkeypatch) -> None:
    class _NoFilter:
        discovery_country_filter = False

    monkeypatch.setattr(live, "get_settings", lambda: _NoFilter())
    monkeypatch.setattr(
        live, "_suggest", lambda q, n: [("US co", "AR1", "US"), ("Thai", "AR2", "TH")]
    )
    client = ClientContext(name="X", vertical="med spa", geo=["LA"], country="US")
    # Escape hatch: keep everything when the filter is off.
    assert _discover_advertisers(client) == [("US co", "AR1"), ("Thai", "AR2")]


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
