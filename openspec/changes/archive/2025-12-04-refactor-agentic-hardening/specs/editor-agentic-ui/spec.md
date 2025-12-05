## ADDED Requirements
### Requirement: Editor Hydrates Document and Locks from Task API
The editor SHALL load initial document content and lock IDs from the Task API when available, registering locks for enforcement and styling.

#### Scenario: Task load populates content and locks
- **GIVEN** the Task API returns `{ content, lock_ids, version }`
- **WHEN** the editor initializes
- **THEN** it SHALL render the returned content
- **AND** register each `lock_id` so delete/undo is blocked and lock styling is applied.

#### Scenario: API unreachable falls back to local cache
- **GIVEN** the Task API call fails
- **WHEN** the editor initializes
- **THEN** it SHALL load the last locally cached content/locks (if any)
- **AND** surface a non-blocking warning so the user can continue writing.

### Requirement: Editor Saves with Optimistic Versioning
The editor SHALL persist document and lock IDs to the Task API using optimistic versioning and recover gracefully from conflicts.

#### Scenario: Successful save increments version
- **GIVEN** the editor has unsaved changes
- **WHEN** it sends `{ content, lock_ids, version }` to the Task API
- **THEN** a 200 response SHALL provide the next `version`
- **AND** the editor SHALL update its local version counter.

#### Scenario: Version conflict triggers reload prompt
- **GIVEN** the Task API responds 409 version mismatch
- **WHEN** the editor receives the error
- **THEN** it SHALL fetch the latest `{ content, lock_ids, version }`, merge or prompt the user, and retry without losing user edits.
