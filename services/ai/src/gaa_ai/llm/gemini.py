"""Gemini provider via LangChain (langchain-google-genai).

Uses `with_structured_output` for schema-validated JSON and multimodal messages
for creative tagging. Bounded retry with backoff via tenacity.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from gaa_ai.llm.base import LlmError

T = TypeVar("T", bound=BaseModel)

F = TypeVar("F", bound=Callable[..., Any])


def _retry(fn: F) -> F:
    """Bounded retry with backoff. Typed helper so mypy keeps the wrapped
    function's signature (unpacking a dict into retry() yields an untyped
    decorator and erases the method types)."""
    decorated = retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=0.4, max=5.0),
        retry=retry_if_exception_type(LlmError),
        reraise=True,
    )(fn)
    return decorated


class GeminiProvider:
    name = "gemini"

    def __init__(self, model: str, api_key: str, vision_model: str | None = None) -> None:
        self.model = model
        self._api_key = api_key
        self._vision_model = vision_model or model

    def _chat(self, model: str, temperature: float) -> ChatGoogleGenerativeAI:
        return ChatGoogleGenerativeAI(
            model=model, google_api_key=self._api_key, temperature=temperature
        )

    @_retry
    def generate_text(
        self, prompt: str, *, system: str | None = None, temperature: float = 0.7
    ) -> str:
        msgs: list[SystemMessage | HumanMessage] = []
        if system:
            msgs.append(SystemMessage(content=system))
        msgs.append(HumanMessage(content=prompt))
        try:
            resp = self._chat(self.model, temperature).invoke(msgs)
        except Exception as exc:  # noqa: BLE001 — wrap transport errors as retryable
            raise LlmError(f"Gemini text call failed: {exc}", retryable=True) from exc
        return resp.content if isinstance(resp.content, str) else str(resp.content)

    @_retry
    def generate_json(
        self,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
        temperature: float = 0.3,
    ) -> T:
        msgs: list[SystemMessage | HumanMessage] = []
        if system:
            msgs.append(SystemMessage(content=system))
        msgs.append(HumanMessage(content=prompt))
        model = self._chat(self.model, temperature).with_structured_output(schema)
        try:
            result = model.invoke(msgs)
        except Exception as exc:  # noqa: BLE001
            raise LlmError(f"Gemini json call failed: {exc}", retryable=True) from exc
        if not isinstance(result, schema):
            raise LlmError("Gemini returned output that failed schema validation", retryable=True)
        return result

    @_retry
    def tag_image(
        self,
        image_url: str,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
    ) -> T:
        content: list[str | dict[Any, Any]] = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": image_url},
        ]
        msgs: list[SystemMessage | HumanMessage] = []
        if system:
            msgs.append(SystemMessage(content=system))
        msgs.append(HumanMessage(content=content))
        model = self._chat(self._vision_model, 0.2).with_structured_output(schema)
        try:
            result = model.invoke(msgs)
        except Exception as exc:  # noqa: BLE001
            raise LlmError(f"Gemini vision call failed: {exc}", retryable=True) from exc
        if not isinstance(result, schema):
            raise LlmError("Gemini vision output failed schema validation", retryable=True)
        return result
