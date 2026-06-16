"""Validated settings loaded from the environment (12-factor; fail fast)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM — provider-abstracted, default Gemini (mirrors the Node side).
    llm_provider: Literal["gemini", "anthropic", "openai"] = "gemini"
    llm_model: str = "gemini-2.5-flash"
    llm_vision_model: str = "gemini-2.5-flash"
    gemini_api_key: str | None = None

    # Competitor data sources.
    serpapi_api_key: str | None = None

    # Pipeline knobs.
    max_corpus_size: int = 200
    enrich_concurrency: int = 8

    @property
    def has_llm_key(self) -> bool:
        if self.llm_provider == "gemini":
            return bool(self.gemini_api_key)
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()
