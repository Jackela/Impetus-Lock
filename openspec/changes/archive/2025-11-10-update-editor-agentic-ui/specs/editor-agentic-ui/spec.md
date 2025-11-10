## ADDED Requirements

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
Locked content MUST visually communicate whether Muse or Loki performed the intervention through color/icon cues instead of textual prefixes.

#### Scenario: Muse block styling
- **WHEN** a provoke/rewrite originates from Muse
- **THEN** the inserted/locked nodes MUST have a `.source-muse` class with the documented palette/iconography.

#### Scenario: Loki block styling
- **WHEN** a provoke/rewrite originates from Loki
- **THEN** the locked nodes MUST have `.source-loki` styling to signal chaos interventions.

### Requirement: UI Tests Cover Agentic Actions
Automated tests MUST cover provoke/rewrite/delete rendering, lock enforcement, and vibe styling for both modes.

#### Scenario: Playwright demo
- **WHEN** `scripts/record-demo.sh` runs
- **THEN** it MUST execute a deterministic flow (Muse provoke, Loki rewrite/delete) and produce updated video artifacts demonstrating the new UI treatment.
