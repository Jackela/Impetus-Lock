"""OpenAI-based provider using Instructor for structured outputs."""

from __future__ import annotations

import instructor
from openai import APIError, AuthenticationError, OpenAI, RateLimitError

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft


class InstructorLLMProvider(BasePromptLLMProvider):
    """OpenAI provider that leverages Instructor for Pydantic validation."""

    provider_name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", temperature: float = 0.9) -> None:
        super().__init__(model=model, temperature=temperature)
        self.client = instructor.from_openai(OpenAI(api_key=api_key))

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        try:
            completion: LLMInterventionDraft = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                response_model=LLMInterventionDraft,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            return completion
        except RateLimitError as exc:  # pragma: no cover - SDK provides typed error
            raise LLMProviderError(
                code="quota_exceeded",
                message="OpenAI quota exceeded. Provide another key or try later.",
                status_code=402,
                provider=self.provider_name,
            ) from exc
        except AuthenticationError as exc:  # pragma: no cover
            raise LLMProviderError(
                code="invalid_api_key",
                message="OpenAI API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except APIError as exc:  # pragma: no cover
            raise LLMProviderError(
                code="llm_api_error",
                message=f"OpenAI API error: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:  # pragma: no cover - fallback
            raise LLMProviderError(
                code="llm_api_error",
                message="OpenAI request failed.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
