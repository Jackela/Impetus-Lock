"""LLM infrastructure package.

Concrete implementations of LLMProvider protocol.
Uses lazy imports to avoid hanging during test collection when optional
dependencies are not available.

Note: Providers with optional dependencies are not auto-imported at package level.
Import them directly when needed:
    from server.infrastructure.llm.claude_provider import ClaudeProvider
    from server.infrastructure.llm.anthropic_provider import AnthropicLLMProvider
    from server.infrastructure.llm.gemini_provider import GeminiLLMProvider
    from server.infrastructure.llm.instructor_provider import InstructorLLMProvider
"""

# Only export base provider which has no external dependencies
from server.infrastructure.llm.base_provider import (
    BasePromptLLMProvider,
    LLMInterventionDraft,
)
from server.infrastructure.llm.debug_provider import DebugLLMProvider

# Provider classes with optional dependencies are not auto-imported.
# They will be None until explicitly imported from their respective modules.
InstructorLLMProvider = None
AnthropicLLMProvider = None
ClaudeProvider = None
ClaudeLLMProvider = None
GeminiLLMProvider = None

__all__ = [
    "BasePromptLLMProvider",
    "LLMInterventionDraft",
    "InstructorLLMProvider",
    "AnthropicLLMProvider",
    "ClaudeProvider",
    "ClaudeLLMProvider",
    "GeminiLLMProvider",
    "DebugLLMProvider",
]
