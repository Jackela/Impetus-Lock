# Prompt Registry

Muse/Loki prompts now live in versioned TOML files under `server/server/prompts/`.
Each file exposes:

- `version`: semantic/date identifier for auditing
- `system`: the full system prompt (Markdown allowed)
- `user_template`: multi-line template with a `{{context}}` placeholder

## Loading at Runtime

`server.infrastructure.llm.prompts.prompt_registry` loads the TOML files with
`importlib.resources`, returning a `PromptTemplate` object.
Helper functions (`get_muse_prompts`, `get_loki_prompts`) simply delegate to
`get_prompt_pair(mode, context)`.

## Regenerating Constants

If you need a pure-Python module (for packaging or offline tooling), run:

```bash
python scripts/generate_prompt_module.py
```

The script emits `server/server/infrastructure/llm/prompts/generated_templates.py`
(which is ignored by git). The generated module is optional—the runtime loader is the
source of truth.

## Offline Evaluations

For a lightweight sanity check (similar to a promptfoo run), execute:

```bash
python scripts/prompt_eval.py
```

It renders the current Muse/Loki prompts with canned contexts and prints the
deterministic output from `DebugLLMProvider`, ensuring schemas stay stable without
calling real LLMs.

## Tests & Guardrails

- `server/tests/test_prompt_templates.py` keeps golden assertions (e.g., "Return JSON only",
  no Markdown prefixes) and ensures user prompts replace `{{context}}`.
- `server/tests/test_prompt_parser.py` uses Hypothesis to fuzz `BasePromptLLMProvider`
  outputs, guaranteeing we reject malformed drafts.

Update these docs whenever you add a new mode or rev the prompts.
