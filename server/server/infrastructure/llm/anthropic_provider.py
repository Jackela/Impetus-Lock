"""Anthropic Claude provider for Muse/Loki interventions."""

from __future__ import annotations

from anthropic import (
    Anthropic,
    APIError,
    AuthenticationError,
    RateLimitError,
)
from anthropic.types import Message, MessageParam, TextBlock

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft


class AnthropicLLMProvider(BasePromptLLMProvider):
    """Anthropic Messages API implementation."""

    provider_name = "anthropic"

    def __init__(
        self,
        api_key: str,
        model: str = "claude-3-5-haiku-latest",
        temperature: float = 0.8,
    ) -> None:
        super().__init__(model=model, temperature=temperature)
        self.client = Anthropic(api_key=api_key)

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        payload: list[MessageParam] = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_message,
                    }
                ],
            }
        ]

        try:
            message: Message = self.client.messages.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=400,
                system=system_prompt,
                messages=payload,
            )
        except RateLimitError as exc:  # pragma: no cover - SDK provides typed error
            raise LLMProviderError(
                code="quota_exceeded",
                message="Anthropic quota exceeded. Provide another key or try later.",
                status_code=402,
                provider=self.provider_name,
            ) from exc
        except AuthenticationError as exc:  # pragma: no cover
            raise LLMProviderError(
                code="invalid_api_key",
                message="Anthropic API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except APIError as exc:  # pragma: no cover
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Anthropic API error: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:  # pragma: no cover
            raise LLMProviderError(
                code="llm_api_error",
                message="Anthropic request failed.",
                status_code=502,
                provider=self.provider_name,
            ) from exc

        text_blocks = [block.text for block in message.content if isinstance(block, TextBlock)]
        if not text_blocks:
            raise LLMProviderError(
                code="invalid_response",
                message="Anthropic returned no text blocks",
                status_code=502,
                provider=self.provider_name,
            )

        return LLMInterventionDraft.model_validate_json(text_blocks[0])
