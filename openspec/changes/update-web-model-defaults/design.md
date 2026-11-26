# Model selection and compatibility

Use Google's recommended successor for the retired Flash-Lite model. Gemini
3.1 Flash-Lite supports structured output and defaults to minimal thinking,
which suits the existing short JSON response. Keep the current API version
selection, JSON response MIME type and caller-supplied sampling parameters.

Use active Claude Haiku 4.5 and Sonnet 4.6 with the existing API version.
Both can keep the current sampling contract. Sonnet 4.6 also keeps the forced
Instructor tool with thinking off. The newer Haiku 5.5 rejects custom
sampling, and Sonnet 5.5 rejects both sampling and forced tool choice.
Migrating those request shapes would require separate output and retry
evaluation. See the [Claude model status](https://platform.claude.com/docs/en/about-claude/model-deprecations#model-status)
and the [Sonnet 5.5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide).

Share the server default IDs between the registry and its constructors.
Preserve any explicit model selection. A browser user chooses whether and
when to save a replacement. The existing vault handles the save in its
current storage mode. In a deployment, an operator can update or remove the
model environment variable.
