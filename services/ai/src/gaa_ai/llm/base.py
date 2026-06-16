"""Provider-abstracted LLM interface for the Python service.

Mirrors the Node abstraction (apps/web/src/lib/llm): every model call goes through
this so the provider is a config change. Output is always validated against a
pydantic model — never trust raw LLM output.
"""

from __future__ import annotations

from typing import Protocol, TypeVar, runtime_checkable

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LlmError(Exception):
    """Raised on provider/transport/validation failure."""

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


@runtime_checkable
class LlmProvider(Protocol):
    name: str
    model: str

    def generate_text(
        self, prompt: str, *, system: str | None = None, temperature: float = 0.7
    ) -> str: ...

    def generate_json(
        self,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
        temperature: float = 0.3,
    ) -> T: ...

    def tag_image(
        self,
        image_url: str,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
    ) -> T: ...


class FakeLlm:
    """Deterministic offline provider for tests and key-less dry runs.

    Returns pre-seeded objects keyed by schema name; falls back to a model built
    from defaults. Lets the whole pipeline run and validate without a real key.
    """

    name = "fake"
    model = "fake"

    def __init__(self, responses: dict[str, BaseModel] | None = None) -> None:
        self._responses = responses or {}

    def generate_text(
        self, prompt: str, *, system: str | None = None, temperature: float = 0.7
    ) -> str:
        return "fake response"

    def generate_json(
        self,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
        temperature: float = 0.3,
    ) -> T:
        seeded = self._responses.get(schema.__name__)
        if seeded is not None:
            return schema.model_validate(seeded.model_dump())
        return schema.model_construct()

    def tag_image(
        self,
        image_url: str,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
    ) -> T:
        return self.generate_json(prompt, schema, system=system)
