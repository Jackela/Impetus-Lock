## ADDED Requirements
### Requirement: Lock Decorations Reinstall Per Editor View
Lock styling and enforcement MUST install for every EditorView instance (including remounts/HMR) so locked content remains visibly indicated and enforced after lifecycle changes.

#### Scenario: Remount retains lock styling
- **GIVEN** locked content exists and the editor remounts or a new EditorView is created
- **WHEN** the editor initializes
- **THEN** the lock decoration plugin SHALL be (re)installed for that view
- **AND** previously locked blocks SHALL render with `.locked-content` styling without manual refresh
- **AND** deletions of those blocks remain blocked via lock enforcement.

### Requirement: Session Vault Clears Persisted Secrets
When a writer switches the BYOK vault to `session` mode, the client SHALL purge any persisted local or encrypted API key payloads so session mode never reuses stored secrets.

#### Scenario: Switch to session wipes storage
- **GIVEN** a user previously saved a provider/model/apiKey in local or encrypted storage
- **WHEN** they change storage mode to `session`
- **THEN** the client SHALL delete persisted payloads (localStorage/encrypted blob) and reset in-memory cache
- **AND** subsequent reloads SHALL require re-entering credentials until saved again.
