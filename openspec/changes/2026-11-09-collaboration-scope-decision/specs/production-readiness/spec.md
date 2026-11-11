## ADDED Requirements

### Requirement: Unspecified Collaboration Surface Is Resolved Before Release

The system SHALL NOT expose a mounted collaboration surface that has no capability specification, no authenticated client, and no permission persistence. Before release, the `/collaboration` REST endpoints and the `/collaboration/ws/{document_id}` WebSocket SHALL either be specified and fully enforced, or removed together with their infrastructure and lifespan wiring.

#### Scenario: Collaboration is retired

- **WHEN** the recorded decision is to remove collaboration
- **THEN** the `/collaboration` router and its application registration, the lifespan initialization and shutdown of the collaboration service, the WebSocket infrastructure package, the generated client types, and the collaboration-only tests SHALL be removed in the same change
- **AND** the application SHALL start and shut down without initializing a collaboration or pub/sub service
- **AND** shutdown-ordering tests SHALL continue to assert the ordering of the remaining services rather than stubbing a removed one.

#### Scenario: Collaboration is completed

- **WHEN** the recorded decision is to keep collaboration
- **THEN** a `collaboration` capability specification SHALL exist before schema work, defining room lifecycle, presence, read/write/admin permissions and document ownership
- **AND** document and permission data SHALL be persisted in schema present in the repository, and permission updates SHALL be stored rather than acknowledged without effect
- **AND** every REST endpoint and the WebSocket join SHALL deny access that the persisted permissions do not grant
- **AND** WebSocket authentication SHALL NOT rely on a bearer token supplied in the query string, and the testing-mode auth bypass SHALL NOT be reachable outside explicit test fixtures.

#### Scenario: Neither path is approved yet

- **WHEN** no decision has been recorded
- **THEN** routes, lifespan wiring, schema and generated types SHALL remain unchanged
- **AND** the project SHALL NOT claim working realtime collaboration in documentation, release notes or API contracts.
