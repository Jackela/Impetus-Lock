# Lock Enforcement

## Capability Description
Prevent deletion of AI-added locked content through ProseMirror transaction filtering.

## ADDED Requirements

### Requirement: Block deletion of locked content

The system SHALL prevent deletion of AI-added blockquotes with `data-lock-id` attributes.

#### Scenario: User attempts to delete locked blockquote text
**Given** a locked blockquote with `data-lock-id="lock_abc123"` exists in the editor
**When** the user selects the blockquote text and presses Delete or Backspace
**Then** the transaction is blocked (returns `false`)
**And** the content remains unchanged
**And** shake animation plays (`onReject()` callback triggered)

#### Scenario: User attempts to delete unlocked content
**Given** regular paragraph text with no lock ID exists in the editor
**When** the user selects the text and presses Delete
**Then** the transaction proceeds normally
**And** the content is deleted successfully

#### Scenario: User attempts to backspace into locked content
**Given** cursor is positioned immediately after a locked blockquote
**When** the user presses Backspace
**Then** the transaction affecting the locked node is blocked
**And** shake animation plays

### Requirement: Detect lock IDs in document nodes

The transaction filter MUST identify which nodes have lock IDs to determine blocking behavior.

#### Scenario: Check if blockquote node has lock ID
**Given** a ProseMirror blockquote node with attribute `data-lock-id="lock_xyz"`
**When** transaction filter examines the node
**Then** `isNodeLocked(node, lockManager)` returns `true`

#### Scenario: Check if regular node has no lock ID
**Given** a ProseMirror paragraph node without `data-lock-id` attribute
**When** transaction filter examines the node
**Then** `isNodeLocked(node, lockManager)` returns `false`

## Related Capabilities
- **sensory-feedback**: Shake animation triggered on rejection
- **content-injection**: Lock IDs applied when AI content injected
