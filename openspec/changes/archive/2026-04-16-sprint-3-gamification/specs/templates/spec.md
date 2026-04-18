## ADDED Requirements

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
