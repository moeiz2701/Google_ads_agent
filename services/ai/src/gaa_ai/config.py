"""Validated settings loaded from the environment (12-factor; fail fast)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read the service-local .env first, then the repo-root .env as a fallback
    # (CWD is services/ai when run via `uv run`). Later files do NOT override
    # earlier, so service-local wins; the root .env supplies anything it omits.
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    # LLM — provider-abstracted, default Gemini (mirrors the Node side).
    llm_provider: Literal["gemini", "anthropic", "openai"] = "gemini"
    llm_model: str = "gemini-2.5-flash"
    llm_vision_model: str = "gemini-2.5-flash"
    gemini_api_key: str | None = None

    # Competitor data sources. Accept SERP_API_KEY too (common alternate spelling).
    serpapi_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SERPAPI_API_KEY", "SERP_API_KEY"),
    )
    # Scrape-API wrapper (URL-rewriting mode — e.g. ScraperAPI/ZenRows API
    # endpoint). A template containing "{url}" which is replaced by the URL-encoded
    # target. More reliable than proxy mode for POST RPCs (managed proxies reset
    # HTTPS POST connections). Takes PRECEDENCE over scraper_proxy_url when set.
    # Example: https://api.scraperapi.com/?api_key=KEY&url={url}&keep_headers=true
    scraper_api_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SCRAPER_API_URL", "SCRAPE_API_URL"),
    )
    # Optional HTTP(S) proxy for Transparency Center discovery. The autocomplete
    # endpoint is anti-bot protected and IP-rate-limits sustained use; route it
    # through a (rotating residential) proxy for reliable discovery. Empty =>
    # direct (best-effort, may hit Google's /sorry block).
    scraper_proxy_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SCRAPER_PROXY_URL", "SCRAPER_PROXY"),
    )
    # Managed-scraper proxies (e.g. ScraperAPI/ZenRows in proxy mode) terminate TLS
    # with their own cert, so verification must be off. Raw residential proxies
    # (Smartproxy/IPRoyal) tunnel via CONNECT and keep verification on (default).
    scraper_proxy_verify_ssl: bool = Field(
        default=True,
        validation_alias=AliasChoices("SCRAPER_PROXY_VERIFY_SSL", "SCRAPER_PROXY_VERIFY"),
    )

    # Pipeline knobs.
    max_corpus_size: int = 200
    enrich_concurrency: int = 8
    # Discovery relevance funnel (live path only). The country filter keeps
    # same-market advertisers; the relevance gate drops off-topic ads. If fewer
    # than this many relevant ads survive, the live path raises an actionable
    # NoRelevantAdsError instead of analyzing noise (see pipeline/run.py).
    relevance_min_ads: int = 3
    # Escape hatch: set false to disable the discovery country filter (keep all
    # discovered advertisers regardless of market).
    discovery_country_filter: bool = True

    @property
    def has_llm_key(self) -> bool:
        if self.llm_provider == "gemini":
            return bool(self.gemini_api_key)
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()
