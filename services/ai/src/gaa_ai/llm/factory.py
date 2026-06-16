"""LLM factory — selects the provider from settings (config change, not rewrite)."""

from __future__ import annotations

from functools import lru_cache

from gaa_ai.config import get_settings
from gaa_ai.llm.base import LlmError, LlmProvider


@lru_cache
def get_llm() -> LlmProvider:
    s = get_settings()
    if s.llm_provider == "gemini":
        if not s.gemini_api_key:
            raise LlmError("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set")
        from gaa_ai.llm.gemini import GeminiProvider

        return GeminiProvider(s.llm_model, s.gemini_api_key, s.llm_vision_model)
    raise LlmError(
        f'LLM provider "{s.llm_provider}" is not implemented yet. '
        "Add it under gaa_ai/llm and register it here."
    )
