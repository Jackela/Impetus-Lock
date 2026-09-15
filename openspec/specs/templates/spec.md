# templates Specification

## Purpose
TBD - created by archiving change sprint-3-gamification. Update Purpose after archive.
## Requirements
### Requirement: Task Templates

The system SHALL provide reusable task templates for quick task creation.

#### Scenario: List user templates

- **WHEN** authenticated user requests their templates
- **THEN** return all templates owned by user

#### Scenario: Create template

- **WHEN** user creates a new template with name and content
- **THEN** store template linked to user

#### Scenario: Use template to create task

- **WHEN** user creates task from template
- **THEN** pre-fill task content with template content

#### Scenario: Delete template

- **WHEN** user deletes their own template
- **THEN** remove template from database

### Requirement: Template Fields

Templates SHALL have required fields for identification and content.

#### Scenario: Template fields are validated

- **WHEN** a template is created or updated
- **THEN** it MUST include id, name, content, created_at, and user_id fields

### Requirement: Template Routes Delegate Without Changing Ownership Semantics
Template endpoints SHALL delegate persistence and business operations to injected user-scoped services while retaining the existing API contract.

#### Scenario: Template operations remain owner scoped
- **WHEN** an authenticated user lists, creates, fetches or deletes templates
- **THEN** the service SHALL scope every operation to that user's ID
- **AND** foreign or missing fetches SHALL return 404, while deleting a foreign or missing template SHALL retain 204 without deleting another user's template.

#### Scenario: Optional database behavior remains stable
- **WHEN** template endpoints execute without a database session
- **THEN** listing SHALL return the current empty paginated response
- **AND** create, fetch and delete SHALL retain the current 500 database-unavailable response.

