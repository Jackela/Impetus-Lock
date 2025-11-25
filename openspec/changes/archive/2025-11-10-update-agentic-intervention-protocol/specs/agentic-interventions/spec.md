## ADDED Requirements

### Requirement: Agent Actions Support Rewrite Decisions
The intervention API MUST support `provoke`, `rewrite`, and `delete` actions with structured anchors and lock metadata so the frontend can execute atomically.

#### Scenario: Muse rewrites stalled sentence
- **GIVEN** the client submits a Muse-mode request with cursor at position `c`
- **WHEN** the LLM chooses `action: "rewrite"`
- **THEN** the backend MUST respond with `anchor.type = "range"` spanning the targeted sentence
- **AND** include `content` (replacement text), `lock_id`, `action_id`, `issued_at`, and `source = "muse"`
- **AND** Muse mode MUST NOT return `delete` actions.

#### Scenario: Loki chaos mix
- **GIVEN** the client submits a Loki-mode request with sufficient context (≥50 chars)
- **WHEN** the LLM chooses any action
- **THEN** the backend MUST return structured data for provoke/delete/rewrite as described above, including `source = "loki"`, with delete anchors validated against the provided context.

### Requirement: Short Context Safety Guard
Loki mode MUST prevent destructive delete/rewrite operations when the available context is insufficient.

#### Scenario: Short context forces provoke
- **GIVEN** a Loki-mode request whose context length is <50 characters
- **WHEN** the LLM output proposes `delete` or `rewrite`
- **THEN** the backend MUST override the action to `provoke` and synthesize safe content plus lock metadata.

### Requirement: Prompt Output Is Prefix-Free JSON
Muse/Loki prompts MUST instruct the LLM to emit JSON-only payloads without `> [AI施压 ...]` prefixes so UI can own the vibe styling.

#### Scenario: Prompt validation
- **GIVEN** updated system+user prompts for Muse and Loki
- **WHEN** a completion is generated
- **THEN** the payload MUST be parseable JSON matching the schema in this change (action + optional content), leaving presentation details to the client.
