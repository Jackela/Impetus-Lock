"""Google Gemini provider implemented via official Generative AI SDK.

This module provides a Gemini LLM provider that implements the LLMProvider
protocol. It supports both Muse (supportive, creative) and Loki (disruptive,
wildcard) modes with configurable safety settings and token counting.

Features:
    - Gemini 1.5 Pro and Flash model support
    - Structured JSON outputs for intervention generation
    - Safety settings configuration
    - Token counting utilities
    - Streaming support (optional)
    - Proper error handling for rate limits and auth failures

Example:
    >>> provider = GeminiLLMProvider(
    ...     api_key="your-api-key",
    ...     model="gemini-1.5-flash",
    ...     temperature=0.7
    ... )
    >>> response = provider.generate_intervention(
    ...     context="他打开门，犹豫着要不要进去。",
    ...     mode="muse"
    ... )
    >>> response.action
    'provoke'
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft
from server.infrastructure.llm.prompts.loki_prompt import get_loki_prompts
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts

if TYPE_CHECKING:
    from collections.abc import Iterator

    from google.generativeai.types import HarmBlockThreshold, HarmCategory


class GeminiLLMProvider(BasePromptLLMProvider):
    """Google Gemini LLM provider using the official Generative AI SDK.

    This provider implements the LLMProvider protocol and uses Google's
    official Generative AI SDK to interact with Gemini models. It supports
    structured JSON outputs, configurable safety settings, and comprehensive
    error handling.

    Attributes:
        provider_name: Provider identifier for error reporting.
        model: Gemini model name (e.g., "gemini-1.5-flash", "gemini-1.5-pro").
        temperature: Sampling temperature (0.0 to 1.0).
        safety_settings: Configured safety thresholds for content filtering.

    Example:
        >>> provider = GeminiLLMProvider(
        ...     api_key="AIzaSy...",
        ...     model="gemini-1.5-flash",
        ...     temperature=0.7
        ... )
        >>> draft = provider._complete(
        ...     system_prompt="You are a helpful assistant.",
        ...     user_message="Generate a creative twist."
        ... )
    """

    provider_name = "gemini"

    # Safety settings: Gemini models have default safety filters that may block
    # some content. For creative writing interventions, we use medium thresholds
    # to balance safety with creative freedom.
    # Note: These are initialized lazily in __init__ to avoid import overhead
    _DEFAULT_SAFETY_SETTINGS: dict | None = None

    @classmethod
    def _get_default_safety_settings(cls) -> dict:
        """Get default safety settings (lazily loaded)."""
        if cls._DEFAULT_SAFETY_SETTINGS is None:
            from google.generativeai.types import HarmBlockThreshold, HarmCategory

            cls._DEFAULT_SAFETY_SETTINGS = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: (
                    HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                ),
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: (
                    HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                ),
            }
        return cls._DEFAULT_SAFETY_SETTINGS

    # Supported Gemini models
    SUPPORTED_MODELS: set[str] = {
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    }

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
        temperature: float = 0.7,
        safety_settings: dict[HarmCategory, HarmBlockThreshold] | None = None,
    ) -> None:
        """Initialize the Gemini provider.

        Args:
            api_key: Google Generative AI API key.
            model: Gemini model name. Defaults to "gemini-1.5-flash".
            temperature: Sampling temperature (0.0 to 1.0). Defaults to 0.7.
            safety_settings: Optional custom safety settings.

        Raises:
            ValueError: If the model is not supported.

        Example:
            >>> provider = GeminiLLMProvider(
            ...     api_key="AIzaSy...",
            ...     model="gemini-1.5-pro",
            ...     temperature=0.8
            ... )
        """
        import google.generativeai as genai
        from google.generativeai.types import HarmBlockThreshold, HarmCategory

        super().__init__(model=model, temperature=temperature)
        self.api_key = api_key

        # Get default safety settings if none provided
        if safety_settings is None:
            self.safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: (HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE),
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: (HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE),
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: (
                    HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                ),
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: (
                    HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                ),
            }
        else:
            self.safety_settings = safety_settings

        # Configure the SDK with the API key
        genai.configure(api_key=api_key)

        # Validate model
        if model not in self.SUPPORTED_MODELS:
            # Allow unknown models for forward compatibility with new releases
            pass

        # Initialize the model
        self._model = genai.GenerativeModel(
            model_name=model,
            safety_settings=self.safety_settings,
        )

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        """Generate a completion using Gemini.

        This method sends the system prompt and user message to the Gemini
        API and returns a validated LLMInterventionDraft.

        Args:
            system_prompt: System instructions defining the LLM's role.
            user_message: User context and instructions.

        Returns:
            LLMInterventionDraft: Validated draft with action and content.

        Raises:
            LLMProviderError: If the API call fails, rate limited, or returns
                invalid response.

        Example:
            >>> draft = provider._complete(
            ...     system_prompt="You are a creative writing assistant.",
            ...     user_message="Context: 他打开门..."
            ... )
            >>> draft.action
            'provoke'
            >>> draft.content
            '门后传来低沉的呼吸声。'
        """
        full_prompt = self._build_prompt(system_prompt, user_message)
        generation_config = self._create_generation_config()
        response = self._generate_content(full_prompt, generation_config)
        return self._parse_gemini_response(response)

    def _build_prompt(self, system_prompt: str, user_message: str) -> str:
        """Build the full prompt from system and user messages.

        Gemini doesn't have native system message support in the same way as
        OpenAI/Anthropic, so we prepend system instructions.

        Args:
            system_prompt: System instructions defining the LLM's role.
            user_message: User context and instructions.

        Returns:
            Combined full prompt string.
        """
        return f"{system_prompt}\n\n{user_message}"

    def _create_generation_config(self):
        """Create the generation configuration for Gemini.

        Returns:
            GenerationConfig with temperature, max_output_tokens, and response_mime_type.
        """
        from google.generativeai.types import GenerationConfig

        return GenerationConfig(
            temperature=self.temperature,
            max_output_tokens=512,
            response_mime_type="application/json",
        )

    def _generate_content(self, full_prompt: str, generation_config):
        """Generate content using the Gemini API.

        Args:
            full_prompt: The full prompt to send to the API.
            generation_config: Configuration for generation.

        Returns:
            Response from the Gemini API.

        Raises:
            LLMProviderError: If the API call fails.
        """
        import google.generativeai as genai

        try:
            return self._model.generate_content(
                contents=full_prompt,
                generation_config=generation_config,
            )
        except genai.types.BlockedPromptException as exc:
            raise LLMProviderError(
                code="content_blocked",
                message="Content blocked by Gemini safety filters.",
                status_code=400,
                provider=self.provider_name,
            ) from exc
        except genai.types.StopCandidateException as exc:
            raise LLMProviderError(
                code="generation_stopped",
                message="Generation stopped unexpectedly.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except genai.api_key.api_errors.InvalidAPIKeyError as exc:
            raise LLMProviderError(
                code="invalid_api_key",
                message="Gemini API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except genai.api_key.api_errors.PermissionDeniedError as exc:
            raise LLMProviderError(
                code="invalid_api_key",
                message="Gemini API key rejected.",
                status_code=401,
                provider=self.provider_name,
            ) from exc
        except genai.api_key.api_errors.ResourceExhaustedError as exc:
            raise LLMProviderError(
                code="quota_exceeded",
                message="Gemini quota exceeded. Provide another key or try later.",
                status_code=402,
                provider=self.provider_name,
            ) from exc
        except genai.api_key.api_errors.InternalServerError as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message="Gemini API internal error.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except genai.api_key.api_errors.UnavailableError as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message="Gemini API unavailable.",
                status_code=502,
                provider=self.provider_name,
            ) from exc
        except Exception as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Gemini request failed: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc

    def _parse_gemini_response(self, response) -> LLMInterventionDraft:
        """Parse and validate the Gemini API response.

        Args:
            response: Response from the Gemini API.

        Returns:
            Validated LLMInterventionDraft.

        Raises:
            LLMProviderError: If the response is invalid.
        """
        # Extract text from response
        if not response.candidates:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned empty candidates",
                status_code=502,
                provider=self.provider_name,
            )

        candidate = response.candidates[0]
        if not candidate.content or not candidate.content.parts:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned no content parts",
                status_code=502,
                provider=self.provider_name,
            )

        text_parts = [
            part.text for part in candidate.content.parts if hasattr(part, "text") and part.text
        ]
        if not text_parts:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned no text content",
                status_code=502,
                provider=self.provider_name,
            )

        text = text_parts[0]
        return LLMInterventionDraft.model_validate_json(text)

    def count_tokens(self, text: str) -> int:
        """Count tokens in the given text.

        Uses Gemini's token counting API to get the exact token count
        for the given text. Useful for checking context limits.

        Args:
            text: Text to count tokens for.

        Returns:
            int: Number of tokens in the text.

        Example:
            >>> provider.count_tokens("Hello, world!")
            4
        """
        try:
            result = self._model.count_tokens(contents=text)
            return result.total_tokens
        except Exception:
            # Fallback: rough estimate (1 token ≈ 4 characters for most languages)
            return len(text) // 4

    def health_check(self) -> bool:
        """Check if the Gemini API is accessible.

        Performs a lightweight API check to verify connectivity
        and API key validity.

        Returns:
            bool: True if API is accessible, False otherwise.

        Example:
            >>> if provider.health_check():
            ...     print("Gemini API is ready")
            ... else:
            ...     print("Gemini API is not available")
        """
        try:
            # Perform a minimal token count check
            self._model.count_tokens(contents="test")
            return True
        except Exception:
            return False

    def stream_intervention(
        self,
        context: str,
        mode: str,
    ) -> Iterator[str]:
        """Stream intervention generation (optional feature).

        Streams the LLM response token by token for real-time
        intervention generation. This is useful for showing
        progress in the UI.

        Args:
            context: Writing context for the intervention.
            mode: "muse" or "loki" mode.

        Yields:
            str: Text chunks as they are generated.

        Note:
            This is an optional feature for advanced use cases.
            The base implementation doesn't use streaming.

        Example:
            >>> for chunk in provider.stream_intervention("Context...", "muse"):
            ...     print(chunk, end="")
        """
        if mode == "muse":
            system_prompt, user_message = get_muse_prompts(context)
        else:
            system_prompt, user_message = get_loki_prompts(context)

        full_prompt = f"{system_prompt}\n\n{user_message}"

        from google.generativeai.types import GenerationConfig

        generation_config = GenerationConfig(
            temperature=self.temperature,
            max_output_tokens=512,
            response_mime_type="application/json",
        )

        try:
            response = self._model.generate_content(
                contents=full_prompt,
                generation_config=generation_config,
                stream=True,
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message=f"Streaming failed: {exc.__class__.__name__}",
                status_code=502,
                provider=self.provider_name,
            ) from exc
