## ADDED Requirements

### Requirement: Existing Task Endpoints Use User-Scoped Services
The existing task CRUD and intervention-history endpoints SHALL delegate business operations to injected services using the authenticated user ID while retaining current authentication, schemas, paths, methods, statuses, pagination and optimistic version behavior.

#### Scenario: Cross-user access is rejected
- **WHEN** an authenticated user requests, updates, deletes or reads actions for another user's task
- **THEN** the service SHALL reject access before reading history or mutating data
- **AND** the route SHALL return the existing 404 response without revealing the owner's data.

#### Scenario: Task writes preserve versions and metadata
- **WHEN** an owner creates or updates a task through the existing endpoint
- **THEN** content, lock IDs and metadata SHALL retain existing validation and persistence behavior
- **AND** creation SHALL return 201, a matching-version update SHALL return 200 with the next version, and a mismatched version SHALL return 409 without mutation.

#### Scenario: Listing and persistence retain current contracts
- **WHEN** an authenticated user lists tasks or performs a write with or without the optional database session
- **THEN** lists and totals SHALL remain scoped to that user with current ordering and pagination
- **AND** repository fallback, commit outcomes and existing success/error statuses SHALL remain unchanged.
