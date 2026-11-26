## MODIFIED Requirements

### Requirement: Writers Configure LLM Provider & Key In-App

The editor SHALL expose an "LLM Settings" control that lets users pick a provider, recommended model, and API key, storing the choice locally (never on the server) and indicating when configuration is missing.

#### Scenario: User switches to Gemini with own key

- **GIVEN** the writer opens the LLM Settings modal
- **WHEN** they select provider "Google Gemini", choose the suggested `gemini-3.1-flash-lite` model, and paste an API key
- **THEN** the UI SHALL persist `{ provider, model, apiKey }` in `localStorage`
- **AND** surface a "Gemini connected" confirmation state
- **AND** subsequent page loads SHALL auto-populate the form and mark Muse/Loki as ready without server restarts.

#### Scenario: Missing config blocks Muse

- **GIVEN** no default server key is available and the user has not entered BYOK data
- **WHEN** they press "I'm stuck!"
- **THEN** the UI SHALL show a blocking error nudging them to open LLM Settings and provide a key instead of leaving the user guessing.

#### Scenario: Writer replaces a retired model

- **GIVEN** the local configuration contains a known retired Gemini Flash-Lite or Anthropic Haiku identifier
- **WHEN** the writer opens LLM Settings
- **THEN** the editor SHALL display the saved model and offer to fill the current recommendation
- **AND** the editor SHALL persist the selected replacement only after the writer saves
- **AND** an explicit custom model SHALL remain editable and persist as entered when saved.
