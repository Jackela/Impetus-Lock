## MODIFIED Requirements
### Requirement: Vibe Styling Reflects Intervention Source
Locked content MUST visually communicate whether Muse or Loki performed the intervention through color/icon cues instead of textual prefixes, and MUST NOT display debug markers or raw lock comments.

#### Scenario: Source Styling Without Debug Text
- **WHEN** a provoke/rewrite originates from Muse or Loki
- **THEN** the locked nodes SHALL render with `.source-muse` / `.source-loki` styling
- **AND** SHALL NOT include visible `[debug:*]` prefixes or `<!-- lock:... -->` comments in user-facing text
- **AND** lock_id/source SHALL remain available via attributes for enforcement and testing.

## ADDED Requirements
### Requirement: Loki Chaos Cooldown
The editor SHALL throttle Loki chaos triggers (manual and timer-driven) to prevent screen-flooding while preserving randomness.

#### Scenario: Loki triggers respect cooldown
- **GIVEN** Loki mode is active
- **WHEN** a Loki trigger fires (manual button or timer)
- **AND** another trigger occurs within the configured cooldown window
- **THEN** the subsequent trigger SHALL be skipped (or deferred) so that no additional locked blocks are injected during the cooldown period.
