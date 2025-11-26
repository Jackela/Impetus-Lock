# locked-content-styling Specification

## Purpose
TBD - created by archiving change chrome-audit-polish. Update Purpose after archive.
## Requirements
### Requirement: Locked Content Visual Distinction

AI-added locked content SHALL be visually distinguished from user content through subtle styling (border, background, icon).

**Rationale**: New user audit question: "What does locked content look like visually? I assume AI will add text, but how do I know which text is 'locked'?" Visual clarity reduces user frustration when attempting to delete locked content.

#### Scenario: Locked Content Has Visual Indicators

**Given** the editor contains locked content blocks (AI-added with lock IDs)
**When** the user views the editor
**Then** locked content SHALL display:
- **Left border**: 3px solid purple (#7c3aed)
- **Background tint**: rgba(124, 58, 237, 0.05) (5% purple transparency)
- **Data attribute**: `data-lock-id="<uuid>"` for testing/debugging

**Acceptance Criteria**:
- [ ] Border and background applied to all locked content blocks
- [ ] Styling does not break editor layout or text flow
- [ ] Visual distinction immediately recognizable (user testing: "I can clearly see locked text")
- [ ] E2E test validates locked content has expected CSS classes
- [ ] Screenshot comparison confirms visual styling

---

### Requirement: Lock Icon on Hover

Locked content SHALL display a lock icon on hover to reinforce locked state and provide progressive disclosure of lock status.

**Rationale**: Icon provides secondary visual cue without cluttering the interface. Hover interaction reveals detail only when user is investigating locked content.

#### Scenario: Lock Icon Appears on Hover

**Given** locked content is visible in the editor
**And** the content has lock ID `abc123`
**When** the user hovers over the locked content block
**Then** a lock icon (🔒 or SVG) SHALL appear on the right side of the block
**And** the icon SHALL include a tooltip: "AI-added content (locked)"

**Acceptance Criteria**:
- [ ] Icon appears only on hover (not always visible)
- [ ] Icon positioned at right edge of locked block (does not obscure text)
- [ ] Icon includes accessible tooltip (aria-label: "AI-added content (locked)")
- [ ] Icon does not interfere with text selection
- [ ] E2E test validates icon appears on hover event

---

### Requirement: Lock Styling Does Not Affect User Content

User-authored content SHALL remain unstyled (no borders, backgrounds, or lock icons).

**Rationale**: Only AI-added content should have visual distinction. User content must remain clean and unobtrusive.

#### Scenario: User Content Remains Unstyled

**Given** the editor contains both user content and locked content
**When** the user views the editor
**Then** user content SHALL NOT have:
- Lock border styling
- Purple background tint
- Lock icon on hover
- `data-lock-id` attribute

**Acceptance Criteria**:
- [ ] User content has default styling (no lock visual indicators)
- [ ] E2E test validates user content lacks lock CSS classes
- [ ] Screenshot comparison shows clean user content vs styled locked content

---

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

