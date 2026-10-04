"""OpenAI structured outputs with a narrow SDK parse adapter for official Sol."""

from __future__ import annotations

import logging
from threading import Lock

import instructor
from openai import (
    APIError,
    AuthenticationError,
    ContentFilterFinishReasonError,
    LengthFinishReasonError,
    OpenAI,
    RateLimitError,
)
from openai.types.chat import ChatCompletionMessageParam
from pydantic import ValidationError

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft

logger = logging.getLogger(__name__)


class InstructorLLMProvider(BasePromptLLMProvider):
    """Use SDK parse for official Sol and Instructor for legacy configurations."""

    provider_name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", temperature: float = 0.9) -> None:
        """Initialize the SDK client and legacy Instructor adapter.

        Args:
            api_key: OpenAI API key.
            model: Model identifier to use for completions.
            temperature: Sampling temperature.
        """
        super().__init__(model=model, temperature=temperature)
        raw_client = OpenAI(api_key=api_key)
        self.client = instructor.from_openai(raw_client)
        # Do not assume a proxy or a model alias supports the official Sol contract.
        self._sol_client = (
            raw_client
            if model == "gpt-6.1-sol" and str(raw_client.base_url) == "https://api.openai.com/v1/"
            else None
        )
        self._sol_lock = Lock()
        self._sol_active = 0
        self._sol_closing = False

    def close(self) -> None:
        """Release the Sol client after its last active completion finishes.

        Registry reload may retire a shared provider while a worker still uses
        it. Reject new completions and defer release; repeated close is safe.
        Legacy Instructor client ownership remains outside this migration.
        """
        if self._sol_client is None:
            return
        with self._sol_lock:
            self._sol_closing = True
            if self._sol_active == 0 and not self._sol_client.is_closed():
                self._sol_client.close()

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        if self._sol_client is not None:
            return self._complete_sol(system_prompt, user_message)
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
        except (OSError, ConnectionError) as exc:  # pragma: no cover - network errors
            raise LLMProviderError(
                code="llm_network_error",
                message="Network error connecting to OpenAI API.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:  # pragma: no cover - unexpected fallback
            raise LLMProviderError(
                code="llm_api_error",
                message="OpenAI request failed.",
                status_code=502,
                provider=self.provider_name,
            ) from exc

    def _complete_sol(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        assert self._sol_client is not None
        with self._sol_lock:
            if self._sol_closing:
                raise self._sol_failure("OpenAI provider is closed.")
            self._sol_active += 1
        try:
            return self._parse_sol(system_prompt, user_message)
        finally:
            with self._sol_lock:
                self._sol_active -= 1
                if self._sol_closing and self._sol_active == 0:
                    try:
                        self._sol_client.close()
                    except Exception:
                        # Match route/registry cleanup: never replace the worker's
                        # response or typed error, and do not log SDK/secret details.
                        logger.warning("Failed to close OpenAI Sol client.")

    def _parse_sol(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        assert self._sol_client is not None
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        try:
            # Four structural rounds preserve Instructor's initial + three reasks.
            # Each call retains the SDK's default two transient retries (max 12 HTTPs).
            for attempt in range(4):
                raw = self._sol_client.chat.completions.with_raw_response.parse(
                    model=self.model,
                    response_format=LLMInterventionDraft,
                    messages=messages,
                )
                # Inspect protocol boundaries before SDK parsing: a bad draft must
                # never hide refusal, extra choices, or an unsuccessful terminal state.
                body = raw.http_response.json()
                choices = body.get("choices") if isinstance(body, dict) else None
                if not isinstance(choices, list) or len(choices) != 1:
                    raise self._sol_failure("OpenAI returned an invalid completion.")
                choice = choices[0]
                message = choice.get("message") if isinstance(choice, dict) else None
                if (
                    not isinstance(message, dict)
                    or choice.get("finish_reason") != "stop"
                    or message.get("role") != "assistant"
                    or message.get("refusal") is not None
                    or message.get("tool_calls")
                    or message.get("function_call")
                ):
                    raise self._sol_failure("OpenAI returned an unusable completion.")
                try:
                    draft: LLMInterventionDraft | None = raw.parse().choices[0].message.parsed
                except ValidationError as exc:
                    if attempt == 3:
                        raise self._sol_failure("OpenAI draft validation failed.") from exc
                    messages.extend(
                        [
                            {"role": "assistant", "content": message.get("content")},
                            {
                                "role": "user",
                                "content": (
                                    "The draft failed JSON/schema validation. Return a valid "
                                    "JSON object with action (provoke, rewrite, or delete) "
                                    "and content (string or null)."
                                ),
                            },
                        ]
                    )
                    continue
                if draft is None:
                    raise self._sol_failure("OpenAI returned no parsed draft.")
                return draft
        except LLMProviderError:
            raise
        except RateLimitError as exc:
            raise LLMProviderError(
                code="quota_exceeded",
                message="OpenAI quota exceeded. Provide another key or try later.",
                status_code=402,
                provider=self.provider_name,
            ) from exc
        except AuthenticationError as exc:
            raise LLMProviderError(
                code="invalid_api_key",
                message="OpenAI API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except (LengthFinishReasonError, ContentFilterFinishReasonError) as exc:
            raise self._sol_failure("OpenAI returned an incomplete or filtered draft.") from exc
        except Exception as exc:
            raise self._sol_failure("OpenAI request failed.") from exc
        raise self._sol_failure("OpenAI draft validation failed.")  # pragma: no cover

    def _sol_failure(self, message: str) -> LLMProviderError:
        return LLMProviderError(
            code="llm_api_error",
            message=message,
            status_code=502,
            provider=self.provider_name,
        )
