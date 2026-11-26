# Update Web model defaults

## Why

The Gemini and Anthropic models previously recommended for Muse/Loki have been retired. Both vendor configuration and the writer's saved choice affect the model actually sent upstream.

## What changes

- Recommend Gemini 3.1 Flash-Lite and Claude Haiku 4.5 in LLM Settings. Offer an explicit replacement when the form shows a known retired identifier.
- Refresh server fallbacks, including Claude Sonnet 4.6 for the separate Instructor-backed `claude` provider. Retain the existing provider adapters and precedence for explicit model settings.
- Keep the adapters compatible with existing requests. See the [model selection and compatibility notes](design.md).

Google documents the [Flash-Lite retirement and replacement](https://aistudio.google.com/docs/deprecations#gemini-2.0-deprecated-models) and [structured output support](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite). Anthropic documents the [Haiku 3.5 retirement and replacement](https://platform.claude.com/docs/en/about-claude/model-deprecations), its [available models](https://platform.claude.com/docs/en/models/overview) and the [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide) and [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide) migration requirements.

## Impact

- Specifications: `editor-agentic-ui` and `agentic-interventions`.
- Code: Web model recommendation and settings modal, server provider defaults and SDK request tests.
- Saved API keys, vault modes, explicit model settings, and the WeChat story provider remain in their existing storage and configuration paths.
