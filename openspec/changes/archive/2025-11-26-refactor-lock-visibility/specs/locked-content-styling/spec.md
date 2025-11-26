## MODIFIED Requirements
### Requirement: ProseMirror Decoration Integration
Locked content styling SHALL be implemented using ProseMirror decorations to avoid modifying document state, and lock persistence markers (e.g., HTML comments) SHALL be hidden from user-facing text while still used for lock_id detection.

#### Scenario: Decorations Hide Lock Comments
- **GIVEN** the editor document contains Markdown comments with lock IDs: `<!-- lock:abc123 source:muse -->`
- **WHEN** EditorCore renders the document
- **THEN** decorations SHALL apply `.locked-content` styling to the visible text only
- **AND** the HTML comment range SHALL be hidden (not rendered in the viewport)
- **AND** `data-lock-id` / `data-source` attributes SHALL remain for testing and styling.

#### Scenario: Decorations Update on New Locks
- **GIVEN** new locked content is inserted with lock attributes but no visible comment text
- **WHEN** the document changes
- **THEN** decorations SHALL re-scan for lock_id via attrs or hidden comments and re-apply styling without exposing the comment text.
