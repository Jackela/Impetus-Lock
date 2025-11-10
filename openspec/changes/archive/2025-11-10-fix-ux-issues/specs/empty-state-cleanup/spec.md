# Empty State Cleanup

## Capability Description
Automatically remove empty blockquote nodes to prevent visual clutter.

## ADDED Requirements

### Requirement: Empty blockquotes MUST be auto-removed

The system SHALL automatically remove empty unlocked blockquote nodes after text deletion completes.

#### Scenario: Deleting all text removes blockquote
**Given** an unlocked blockquote with text "Hello world" exists
**When** the user selects all text in the blockquote
**And** presses Delete
**Then** the text is deleted
**And** the empty blockquote node is automatically removed
**And** cursor moves to previous/next block

#### Scenario: Partial deletion keeps blockquote
**Given** an unlocked blockquote with text "Hello world" exists
**When** the user selects "world" and presses Delete
**Then** the text becomes "Hello "
**And** the blockquote remains visible (not empty)

#### Scenario: Empty blockquote removed on focus loss
**Given** an unlocked blockquote exists with no text
**When** the editor updates (document change detected)
**Then** the empty blockquote is removed from the document

#### Scenario: Locked blockquotes are never removed
**Given** a locked blockquote with `data-lock-id` exists
**And** the blockquote becomes empty (edge case)
**When** the cleanup logic runs
**Then** the locked blockquote is NOT removed
**And** lock enforcement still applies

### Requirement: Cleanup MUST NOT interfere with typing

Auto-removal SHALL only trigger after edits complete, never during active typing sessions.

#### Scenario: Typing in empty blockquote doesn't trigger removal
**Given** an empty unlocked blockquote has focus
**When** the user starts typing "H"
**Then** the blockquote is NOT removed
**And** the character "H" appears in the blockquote

#### Scenario: Cleanup runs on transaction commit
**Given** a transaction deletes all text from unlocked blockquote
**When** the transaction is committed (dispatched)
**Then** cleanup logic runs after transaction completes
**And** empty node is removed in a separate transaction

## Related Capabilities
- **lock-enforcement**: Locked blockquotes exempt from cleanup
- **content-injection**: AI-added blockquotes may eventually become empty (edge case)
