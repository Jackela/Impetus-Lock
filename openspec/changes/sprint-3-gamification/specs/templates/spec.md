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

Templates SHALL have:

- id (UUID)
- name (string, max 100 chars)
- content (text, initial task content)
- created_at (timestamp)
- user_id (UUID, foreign key)
