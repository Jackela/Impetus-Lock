## MODIFIED Requirements
### Requirement: Prompt Output Is Prefix-Free JSON
Muse/Loki prompts MUST instruct the LLM to emit JSON-only payloads without `[debug:*]` prefixes or inline lock comments so the UI can own the vibe styling.

#### Scenario: Debug-free payload
- **GIVEN** a Muse or Loki request (including the debug provider)
- **WHEN** a completion is generated
- **THEN** the payload content SHALL omit debug prefixes/suffixes and HTML comments, returning only human-readable text plus structured fields (action, lock_id, anchor, source).

## ADDED Requirements
### Requirement: Intervention Lock IDs Are Unique Per Response
Intervention responses MUST issue unique lock IDs per action to avoid reusing the same lock identifier across multiple triggers.

#### Scenario: Distinct lock ids per trigger
- **WHEN** consecutive Muse or Loki interventions are generated (including via debug provider)
- **THEN** each response SHALL carry a distinct `lock_id`
- **AND** the `lock_id` SHALL be suitable for persistence and client-side enforcement without collisions.
