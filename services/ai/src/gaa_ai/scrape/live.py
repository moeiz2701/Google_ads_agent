"""Live ad source: Google Ads Transparency Center (§4.1).

Real competitor ads, in two steps (verified against the live services):

  1. DISCOVERY — resolve advertiser names/vertical -> advertiser_ids via the
     Transparency Center autocomplete RPC. The Google Ads API does NOT expose
     competitors' creatives (it manages your own accounts only); the Transparency
     Center is the public disclosure surface, so it is the correct source. The
     autocomplete RPC is undocumented and occasionally returns non-JSON, so it is
     retried and failures degrade gracefully.
  2. CREATIVES — for each advertiser_id, SerpApi's
     ``google_ads_transparency_center`` engine returns real creatives with
     longevity (``total_days_shown``, first/last shown) + a RENDERED IMAGE. The
     ad COPY is never returned by this source (confirmed: even the details engine
     gives only the image), so downstream enrichment reads the copy from the image
     via vision.

Everything raises/returns-empty so the caller (run._fetch_corpus) can fall back
to the cached corpus — the demo never hard-breaks on a live failure.
"""

from __future__ import annotations

import json
import logging
import math
import time
import urllib.parse
from datetime import date, datetime, timezone

import httpx

from gaa_ai.config import Settings, get_settings
from gaa_ai.schemas import ClientContext, RawAd
from gaa_ai.scrape.base import NoRelevantAdsError, ScrapeError

logger = logging.getLogger("gaa_ai.scrape.live")

_SERPAPI = "https://serpapi.com/search.json"
_TC_ENGINE = "google_ads_transparency_center"
_GTC_SUGGEST = "https://adstransparency.google.com/anji/_/rpc/SearchService/SearchSuggestions"

# Browser-like headers so the autocomplete RPC accepts us as a same-origin XHR.
# (Does not defeat Google's IP-level anti-bot — that needs a proxy — but avoids
# trivial rejections in normal low-volume use.)
_SUGGEST_HEADERS = {
    "content-type": "application/x-www-form-urlencoded",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://adstransparency.google.com",
    "referer": "https://adstransparency.google.com/",
    "x-same-domain": "1",
}

# Transparency Center creative format -> our RawAd.format. Every format is served
# to us as a rendered image, so vision can read any of them.
_FORMAT_MAP = {"text": "search", "image": "display", "video": "video"}

# Discovery is name-fuzzy and country-tagged. We FILTER to the client's market
# (autocomplete tags every advertiser with an ISO-2 country code), so foreign-
# market / foreign-language advertisers never reach the corpus. Default market
# when the client has no country set (legacy rows).
_DEFAULT_COUNTRY = "US"

# Bounds (keep SerpApi usage predictable: ~1 search per advertiser). Breadth
# across more competitors matters more than depth for the gap map, so we keep a
# wide advertiser set and spread the ad budget across it (~4 ads each at 60 total).
_MAX_ADVERTISERS = 15
# Over-fetch suggestions per query: the country filter discards out-of-market
# advertisers, so request well above _MAX_ADVERTISERS to still fill it after.
_SUGGEST_PER_QUERY = 20
# Managed-scraper proxies (residential routing) are slow and occasionally reset
# the connection, so allow a few extra attempts and a generous per-call timeout.
_SUGGEST_RETRIES = 4
_SUGGEST_TIMEOUT = 35.0


class LiveAdSource:
    name = "live"

    def fetch(self, client: ClientContext, max_ads: int) -> list[RawAd]:
        settings = get_settings()
        key = settings.serpapi_api_key
        if not key:
            raise ScrapeError(
                "No live ad source configured. Set SERPAPI_API_KEY, or run with "
                "use_cached_corpus=true for the demo corpus."
            )
        if settings.scraper_api_url:
            logger.info("Transparency discovery: routing through scrape-API wrapper")
        elif settings.scraper_proxy_url:
            logger.info("Transparency discovery: routing through configured proxy")
        else:
            logger.info(
                "Transparency discovery: DIRECT (no scrape API/proxy) — Google may "
                "rate-limit; set SCRAPER_API_URL for reliable discovery"
            )

        advertisers = _discover_advertisers(client)
        if not advertisers:
            raise ScrapeError(
                "Transparency Center discovery found no competitor advertisers "
                f"(queries: {', '.join(_discovery_queries(client)) or 'none'})"
            )

        ads = _collect_creatives(advertisers, key, max_ads)
        if not ads:
            raise ScrapeError("Transparency Center returned no usable creatives")
        logger.info(
            "live corpus: %d ads from %d advertisers", len(ads), len({a.advertiser for a in ads})
        )
        return ads


# --- discovery -------------------------------------------------------------


def _normalize_query(q: str) -> str:
    """The autocomplete matches advertiser NAMES, so a slugified vertical
    ('customer_experience') must be turned back into natural text
    ('customer experience') and collapsed whitespace."""
    return " ".join(q.replace("_", " ").replace("-", " ").split())


def _discovery_queries(client: ClientContext) -> list[str]:
    """Search terms for advertiser discovery: named competitors first (most
    relevant), then the vertical as a supplement. Normalized, deduped, ordered."""
    raw = list(client.competitors or [])
    if client.vertical:
        raw.append(client.vertical)
    seen: set[str] = set()
    out: list[str] = []
    for q in raw:
        nq = _normalize_query(q or "")
        if nq and nq.lower() not in seen:
            seen.add(nq.lower())
            out.append(nq)
    return out


def _client_country(client: ClientContext) -> str:
    """ISO-2 market for the country filter; default US when the client has none."""
    return (client.country or "").strip().upper() or _DEFAULT_COUNTRY


def _discover_advertisers(client: ClientContext) -> list[tuple[str, str]]:
    """Resolve queries -> unique IN-MARKET (advertiser_name, advertiser_id).

    Over-fetches, then FILTERS to the client's country (not merely sorts), so a
    Thai air-conditioning company never seeds keywords for a US med-spa. Two
    distinct empties (the caller treats them differently):
      * found nothing at all          -> returns []; ``fetch`` raises ScrapeError
        (likely unreachable/blocked — the caller may fall back to cached).
      * found advertisers, none in-market -> raises NoRelevantAdsError (we reached
        the source; actionable, so the caller surfaces it without cached fallback).

    Untagged advertisers (autocomplete omitted the country) get the benefit of the
    doubt — the relevance gate downstream is the backstop. Returns at most
    _MAX_ADVERTISERS, exact-market matches first.
    """
    country = _client_country(client)
    seen_ids: set[str] = set()
    found: list[tuple[str, str, str]] = []  # (name, id, country)
    for query in _discovery_queries(client):
        for name, aid, ctry in _suggest(query, _SUGGEST_PER_QUERY):
            if aid in seen_ids:
                continue
            seen_ids.add(aid)
            found.append((name, aid, ctry))

    if not found:
        return []  # nothing discovered -> recoverable scrape miss (cached fallback)

    if not get_settings().discovery_country_filter:
        return [(name, aid) for name, aid, _ in found[:_MAX_ADVERTISERS]]

    matched = [(name, aid) for name, aid, ctry in found if ctry.upper() == country]
    untagged = [(name, aid) for name, aid, ctry in found if not ctry]
    in_market = matched + untagged  # exact matches first, then ambiguous
    if not in_market:
        raise NoRelevantAdsError(
            f"Found {len(found)} competitor advertiser(s) for '{client.vertical}', "
            f"but none in {country}. Try a different location or category."
        )
    return in_market[:_MAX_ADVERTISERS]


def _post_suggest(settings: Settings, body: dict[str, str]) -> httpx.Response:
    """POST the autocomplete request via the configured transport, in priority:
    scrape-API wrapper (reliable for POST) > proxy > direct.

    The wrapper rewrites the URL into the provider's API endpoint (e.g. ScraperAPI
    ``?url=<encoded target>``) — managed proxies reset HTTPS POST, the API endpoint
    does not. The target carries its own query string, encoded whole into {url}.
    """
    target = f"{_GTC_SUGGEST}?authuser=0&hl=en"
    if settings.scraper_api_url:
        wrapped = settings.scraper_api_url.replace("{url}", urllib.parse.quote(target, safe=""))
        return httpx.post(wrapped, headers=_SUGGEST_HEADERS, data=body, timeout=_SUGGEST_TIMEOUT)
    proxy = settings.scraper_proxy_url or None
    with httpx.Client(
        timeout=_SUGGEST_TIMEOUT, proxy=proxy, verify=settings.scraper_proxy_verify_ssl
    ) as client:
        return client.post(target, headers=_SUGGEST_HEADERS, data=body)


def _suggest(query: str, limit: int) -> list[tuple[str, str, str]]:
    """Transparency Center autocomplete: query -> [(name, advertiser_id, country)].

    Undocumented RPC; the request body is ``f.req={"1": query, "2": limit}`` and a
    transient call can return non-JSON, so retry a few times and return empty on
    persistent failure (the caller still has other queries / the cached fallback).
    """
    body = {"f.req": json.dumps({"1": query, "2": limit})}
    settings = get_settings()
    for attempt in range(_SUGGEST_RETRIES):
        try:
            resp = _post_suggest(settings, body)
        except httpx.HTTPError as exc:  # network/timeout/reset — transient, retry
            logger.warning("autocomplete network error for %r: %s", query, exc)
            time.sleep(0.5 * (attempt + 1))
            continue
        # A 3xx is Google's consent / anti-bot ("/sorry") redirect — IP-level and
        # won't clear within this request, so fail fast (the caller falls back).
        if 300 <= resp.status_code < 400:
            logger.warning(
                "autocomplete for %r blocked/redirected (HTTP %s) — likely rate-limited; "
                "skipping live discovery",
                query,
                resp.status_code,
            )
            return []
        if resp.status_code != 200:
            logger.warning("autocomplete for %r returned HTTP %s", query, resp.status_code)
            if resp.status_code >= 500:  # server-side — retry
                time.sleep(0.5 * (attempt + 1))
                continue
            return []
        try:
            return _parse_suggestions(resp.json())
        except ValueError:  # transient non-JSON body — retry
            logger.warning("autocomplete for %r returned non-JSON; retrying", query)
            time.sleep(0.5 * (attempt + 1))
    return []


def _parse_suggestions(data: object) -> list[tuple[str, str, str]]:
    """Pure parser for the autocomplete payload:
    ``{"1": [{"1": {"1": name, "2": advertiser_id, "3": country}}, ...]}``."""
    out: list[tuple[str, str, str]] = []
    if not isinstance(data, dict):
        return out
    for item in data.get("1") or []:
        node = item.get("1") if isinstance(item, dict) else None
        if not isinstance(node, dict):
            continue
        aid = node.get("2")
        if not aid:
            continue
        out.append((node.get("1") or aid, aid, node.get("3") or ""))
    return out


# --- creatives -------------------------------------------------------------


def _collect_creatives(
    advertisers: list[tuple[str, str]], key: str, max_ads: int
) -> list[RawAd]:
    """Fetch creatives per advertiser and SPREAD across them (longevity-first),
    so the corpus reflects several competitors, not one. ~1 SerpApi call/advertiser."""
    n_adv = max(1, min(len(advertisers), max_ads, _MAX_ADVERTISERS))
    per_adv = max(1, math.ceil(max_ads / n_adv))
    out: list[RawAd] = []
    for name, aid in advertisers[:n_adv]:
        creatives = _fetch_advertiser_creatives(aid, name, key)
        out.extend(creatives[:per_adv])
        if len(out) >= max_ads:
            break
    return out[:max_ads]


def _fetch_advertiser_creatives(advertiser_id: str, name: str, key: str) -> list[RawAd]:
    """One advertiser's creatives, longevity-first. Per-advertiser failures return
    empty (logged) — never sink the whole fetch."""
    try:
        resp = httpx.get(
            _SERPAPI,
            params={"engine": _TC_ENGINE, "advertiser_id": advertiser_id, "api_key": key},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("SerpApi creatives for %s (%s) failed: %s", name, advertiser_id, exc)
        return []
    creatives = data.get("ad_creatives") or []
    # Longevity-first: the deterministic ranking treats long-running ads as proven.
    creatives.sort(key=lambda c: c.get("total_days_shown") or 0, reverse=True)
    out: list[RawAd] = []
    for c in creatives:
        ad = _to_rawad(c, name)
        if ad is not None:
            out.append(ad)
    return out


def _to_rawad(creative: dict[str, object], advertiser_name: str) -> RawAd | None:
    """Map one SerpApi Transparency creative -> RawAd. Copy is intentionally left
    None (this source never returns it); vision reads it from ``image_url``."""
    cid = creative.get("ad_creative_id")
    if not cid:
        return None
    fmt = _FORMAT_MAP.get(str(creative.get("format") or "").lower(), "unknown")
    return RawAd(
        ad_id=f"gtc-{cid}",
        advertiser=str(creative.get("advertiser") or advertiser_name),
        source="google_transparency",
        format=fmt,
        image_url=_as_str(creative.get("image")),
        landing_url=_as_str(creative.get("details_link")),
        first_shown=_ts_to_date(creative.get("first_shown")),
        last_shown=_ts_to_date(creative.get("last_shown")),
        still_active=_still_active(creative.get("last_shown")),
    )


# --- small helpers ---------------------------------------------------------


def _as_str(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _ts_to_date(ts: object) -> date | None:
    """Unix seconds -> UTC date. Tolerant of None / bad / non-numeric values."""
    if not isinstance(ts, (int, str)) or ts in ("", 0):
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
    except (ValueError, OSError, OverflowError):
        return None


def _still_active(last_shown_ts: object, *, today: date | None = None) -> bool | None:
    """Treat an ad last shown within a week as still running (a longevity signal)."""
    d = _ts_to_date(last_shown_ts)
    if d is None:
        return None
    return (((today or date.today()) - d).days) <= 7
