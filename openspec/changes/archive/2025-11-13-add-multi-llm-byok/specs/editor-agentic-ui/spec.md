# editor-agentic-ui Specification Delta

## ADDED Requirements

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
