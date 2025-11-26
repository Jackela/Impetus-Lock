# editor-agentic-ui Specification

## Purpose
TBD - created by archiving change update-editor-agentic-ui. Update Purpose after archive.
## Requirements
### Requirement: Editor Executes Agentic Actions Atomically
The editor MUST apply provoke, rewrite, and delete instructions atomically using the anchor ranges returned by the backend.

#### Scenario: Rewrite applies inline lock
- **WHEN** the client receives `action: "rewrite"` with `anchor.type = "range"`
- **THEN** the editor MUST replace the specified range with the provided content in a single transaction
- **AND** append an inline lock marker (e.g., HTML comment or mark) using `lock_id`
- **AND** prevent undo/delete attempts against that locked span via the transaction filter.

#### Scenario: Delete removes last sentence
- **WHEN** the action is `delete` with a valid range
- **THEN** the editor MUST delete the targeted text without adding lock metadata and mark the transaction as non-undoable.

### Requirement: Vibe Styling Reflects Intervention Source
Locked content MUST visually communicate whether Muse or Loki performed the intervention through color/icon cues instead of textual prefixes, and MUST NOT display debug markers or raw lock comments.

#### Scenario: Source Styling Without Debug Text
- **WHEN** a provoke/rewrite originates from Muse or Loki
- **THEN** the locked nodes SHALL render with `.source-muse` / `.source-loki` styling
- **AND** SHALL NOT include visible `[debug:*]` prefixes or `<!-- lock:... -->` comments in user-facing text
- **AND** lock_id/source SHALL remain available via attributes for enforcement and testing.

### Requirement: UI Tests Cover Agentic Actions
Automated tests MUST cover provoke/rewrite/delete rendering, lock enforcement, and vibe styling for both modes.

#### Scenario: Playwright demo
- **WHEN** `scripts/record-demo.sh` runs
- **THEN** it MUST execute a deterministic flow (Muse provoke, Loki rewrite/delete) and produce updated video artifacts demonstrating the new UI treatment.

### Requirement: Writers Configure LLM Provider & Key In-App
The editor SHALL expose an "LLM Settings" control that lets users pick a provider, recommended model, and API key, storing the choice locally (never on the server) and indicating when configuration is missing.

#### Scenario: User switches to Gemini with own key
- **GIVEN** the writer opens the LLM Settings modal
- **WHEN** they select provider "Google Gemini", choose the suggested `gemini-2.0-flash-lite` model, and paste an API key
- **THEN** the UI SHALL persist `{ provider, model, apiKey }` in `localStorage`
- **AND** surface a "Gemini connected" confirmation state
- **AND** subsequent page loads SHALL auto-populate the form and mark Muse/Loki as ready without server restarts.

#### Scenario: Missing config blocks Muse
- **GIVEN** no default server key is available and the user has not entered BYOK data
- **WHEN** they press "I'm stuck!"
- **THEN** the UI SHALL show a blocking error nudging them to open LLM Settings and provide a key instead of leaving the user guessing.

### Requirement: Client Sends Provider Overrides Securely
Intervention requests SHALL attach the locally stored provider/model/key via HTTPS headers, redacting secrets in logs and allowing users to clear the configuration at any time.

#### Scenario: Headers injected for Muse trigger
- **GIVEN** BYOK data exists in `localStorage`
- **WHEN** Muse trigger is executed
- **THEN** `interventionClient` SHALL include `X-LLM-Provider`, `X-LLM-Model`, and `X-LLM-Api-Key` headers in the fetch call
- **AND** redact the key from any debug logging but allow toggling verbose logs without revealing the secret.

#### Scenario: User clears BYOK data
- **GIVEN** the writer clicks "Clear key" in LLM Settings
- **WHEN** they confirm the action
- **THEN** local storage SHALL delete the provider/model/apiKey trio
- **AND** subsequent API calls SHALL omit override headers and rely on server defaults (if any), prompting again if unavailable.

### Requirement: Loki Chaos Cooldown
The editor SHALL throttle Loki chaos triggers (manual and timer-driven) to prevent screen-flooding while preserving randomness.

#### Scenario: Loki triggers respect cooldown
- **GIVEN** Loki mode is active
- **WHEN** a Loki trigger fires (manual button or timer)
- **AND** another trigger occurs within the configured cooldown window
- **THEN** the subsequent trigger SHALL be skipped (or deferred) so that no additional locked blocks are injected during the cooldown period.

