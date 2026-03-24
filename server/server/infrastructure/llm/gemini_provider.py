"""Google Gemini provider implemented via direct HTTP requests."""

from __future__ import annotations

import httpx

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiLLMProvider(BasePromptLLMProvider):
    """Calls Gemini's generateContent endpoint with BYOK credentials."""

    provider_name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.0-flash-lite",
        temperature: float = 0.7,
    ) -> None:
        super().__init__(model=model, temperature=temperature)
        self.api_key = api_key

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_message},
                    ],
                }
            ],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": 512,
                "responseMimeType": "application/json",
            },
        }

        url = f"{_GEMINI_API_BASE}/models/{self.model}:generateContent?key={self.api_key}"

        try:
            response = httpx.post(url, json=payload, timeout=20)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 429:
                code = "quota_exceeded"
                http_status = 402
                message = "Gemini quota exceeded. Provide another key or try later."
            elif status in {401, 403}:
                code = "invalid_api_key"
                http_status = 401
                message = "Gemini API key rejected."
            else:
                code = "llm_api_error"
                http_status = 502
                message = "Gemini API error."
            raise LLMProviderError(
                code=code,
                message=message,
                status_code=http_status,
                provider=self.provider_name,
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(
                code="llm_api_error",
                message="Gemini request failed.",
                status_code=502,
                provider=self.provider_name,
            ) from exc

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned empty candidates",
                status_code=502,
                provider=self.provider_name,
            )

        parts = candidates[0].get("content", {}).get("parts") or []
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        text = next((t for t in text_parts if t), None)
        if not text:
            raise LLMProviderError(
                code="invalid_response",
                message="Gemini returned no text content",
                status_code=502,
                provider=self.provider_name,
            )

        return LLMInterventionDraft.model_validate_json(text)
