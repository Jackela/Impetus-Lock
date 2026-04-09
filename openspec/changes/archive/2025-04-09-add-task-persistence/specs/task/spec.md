# Task Management Capability

## Overview

The Task Management capability enables users to create, persist, organize, and manage their writing tasks. Tasks are the primary unit of work in Impetus Lock - each task represents a writing session with associated content, constraints, and metadata.

## ADDED Requirements

### Requirement: Task Data Model

The system SHALL provide a data model for tasks with the following attributes:

- **id**: Unique identifier (UUID)
- **user_id**: Reference to task owner
- **title**: Task name (required, max 200 characters)
- **content**: Markdown content with optional lock annotations
- **status**: Enum - `draft`, `in_progress`, `completed`, `archived`
- **priority**: Enum - `low`, `medium`, `high`
- **category_id**: Optional reference to category
- **due_date**: Optional datetime for deadline
- **word_count_target**: Optional integer for writing goals
- **created_at**: Timestamp of creation
- **updated_at**: Timestamp of last modification
- **completed_at**: Timestamp when marked complete

#### Scenario: Create new task
- **GIVEN** an authenticated user
- **WHEN** the user creates a task with title "My Novel Chapter 1"
- **THEN** the task is persisted with status `draft`
- **AND** the task is associated with the user's account
- **AND** timestamps are automatically set

#### Scenario: Task with content
- **GIVEN** an authenticated user
- **WHEN** the user creates a task with Markdown content including lock annotations
- **THEN** the content is persisted as-is
- **AND** lock annotations are preserved for editor processing

#### Scenario: Task with metadata
- **GIVEN** an authenticated user
- **WHEN** the user creates a task with priority `high` and due date
- **THEN** all metadata fields are persisted correctly
- **AND** the task appears in filtered views appropriately

### Requirement: Task CRUD Operations

The system SHALL provide full CRUD operations for tasks via REST API.

#### Create Task

#### Scenario: Successful task creation
- **GIVEN** an authenticated user with valid JWT token
- **WHEN** POST /api/v1/tasks with valid task data
- **THEN** return 201 Created with task object
- **AND** the task is stored in database
- **AND** the response includes generated id and timestamps

#### Scenario: Task creation with invalid data
- **GIVEN** an authenticated user
- **WHEN** POST /api/v1/tasks with title exceeding 200 characters
- **THEN** return 422 Unprocessable Entity
- **AND** response includes validation error details

#### Scenario: Unauthenticated task creation
- **GIVEN** no authentication token
- **WHEN** POST /api/v1/tasks with valid data
- **THEN** return 401 Unauthorized
- **AND** no task is created

#### Read Task

#### Scenario: List user tasks
- **GIVEN** an authenticated user with 5 tasks
- **WHEN** GET /api/v1/tasks
- **THEN** return 200 OK with array of user's tasks
- **AND** tasks from other users are not included
- **AND** default sorting is by updated_at descending

#### Scenario: Get single task
- **GIVEN** an authenticated user owns a task
- **WHEN** GET /api/v1/tasks/{id}
- **THEN** return 200 OK with task details
- **AND** all fields are included in response

#### Scenario: Access other user's task
- **GIVEN** an authenticated user
- **WHEN** GET /api/v1/tasks/{id} where task belongs to another user
- **THEN** return 404 Not Found (security through obscurity)

#### Scenario: Task not found
- **GIVEN** an authenticated user
- **WHEN** GET /api/v1/tasks/{nonexistent-id}
- **THEN** return 404 Not Found

#### Update Task

#### Scenario: Update task content
- **GIVEN** an authenticated user owns a task
- **WHEN** PUT /api/v1/tasks/{id} with updated content
- **THEN** return 200 OK with updated task
- **AND** updated_at timestamp is refreshed
- **AND** content changes are persisted

#### Scenario: Partial update
- **GIVEN** an authenticated user owns a task
- **WHEN** PATCH /api/v1/tasks/{id} with only title change
- **THEN** return 200 OK with updated task
- **AND** unchanged fields retain their values

#### Scenario: Update other user's task
- **GIVEN** an authenticated user
- **WHEN** PUT /api/v1/tasks/{id} where task belongs to another user
- **THEN** return 404 Not Found

#### Delete Task

#### Scenario: Soft delete task
- **GIVEN** an authenticated user owns a task
- **WHEN** DELETE /api/v1/tasks/{id}
- **THEN** return 204 No Content
- **AND** task status is set to `archived`
- **AND** task remains in database for recovery

#### Scenario: Hard delete task (admin only)
- **GIVEN** an admin user
- **WHEN** DELETE /api/v1/tasks/{id}?permanent=true
- **THEN** return 204 No Content
- **AND** task is permanently removed from database

### Requirement: Task Filtering and Sorting

The system SHALL support filtering and sorting for task lists.

#### Scenario: Filter by status
- **GIVEN** an authenticated user with tasks in various statuses
- **WHEN** GET /api/v1/tasks?status=in_progress
- **THEN** return only tasks with status `in_progress`

#### Scenario: Filter by priority
- **GIVEN** an authenticated user with tasks of various priorities
- **WHEN** GET /api/v1/tasks?priority=high
- **THEN** return only tasks with priority `high`

#### Scenario: Filter by category
- **GIVEN** an authenticated user with categorized tasks
- **WHEN** GET /api/v1/tasks?category_id={category_id}
- **THEN** return only tasks in specified category

#### Scenario: Sort by due date
- **GIVEN** an authenticated user with tasks having due dates
- **WHEN** GET /api/v1/tasks?sort_by=due_date&sort_order=asc
- **THEN** return tasks sorted by due date ascending

#### Scenario: Combined filters
- **GIVEN** an authenticated user with many tasks
- **WHEN** GET /api/v1/tasks?status=draft&priority=high&sort_by=updated_at
- **THEN** return high priority draft tasks sorted by update time

### Requirement: Task Categories

The system SHALL allow users to organize tasks into categories.

#### Scenario: Create category
- **GIVEN** an authenticated user
- **WHEN** POST /api/v1/categories with name "Novel Writing"
- **THEN** return 201 Created with category object
- **AND** category is associated with user

#### Scenario: List categories
- **GIVEN** an authenticated user with categories
- **WHEN** GET /api/v1/categories
- **THEN** return array of user's categories
- **AND** include task count per category

#### Scenario: Assign task to category
- **GIVEN** an authenticated user owns a task and category
- **WHEN** PATCH /api/v1/tasks/{id} with category_id
- **THEN** task is associated with category
- **AND** task appears in category filtered views

#### Scenario: Category color coding
- **GIVEN** an authenticated user creates a category
- **WHEN** specifying color "#FF5733"
- **THEN** category is stored with color code
- **AND** UI displays category with color indicator

### Requirement: Task Status Workflow

The system SHALL enforce a status workflow for tasks.

Valid transitions:
- `draft` → `in_progress`
- `draft` → `archived`
- `in_progress` → `draft`
- `in_progress` → `completed`
- `in_progress` → `archived`
- `completed` → `archived`
- `archived` → `draft` (restore)

#### Scenario: Start task
- **GIVEN** a task in `draft` status
- **WHEN** user marks as in progress
- **THEN** status changes to `in_progress`
- **AND** task appears in active work list

#### Scenario: Complete task
- **GIVEN** a task in `in_progress` status
- **WHEN** user marks as completed
- **THEN** status changes to `completed`
- **AND** completed_at timestamp is set
- **AND** celebration feedback is triggered

#### Scenario: Archive completed task
- **GIVEN** a completed task
- **WHEN** user archives the task
- **THEN** status changes to `archived`
- **AND** task moves to archive view

#### Scenario: Restore archived task
- **GIVEN** an archived task
- **WHEN** user restores the task
- **THEN** status changes to `draft`
- **AND** task reappears in active lists

### Requirement: Task Persistence in Editor

The system SHALL integrate task persistence with the editor experience.

#### Scenario: Auto-save while editing
- **GIVEN** a user is editing a task in the editor
- **WHEN** content changes and debounce timer (2s) expires
- **THEN** changes are automatically saved to server
- **AND** user sees save indicator

#### Scenario: Load task into editor
- **GIVEN** a user selects a task from task list
- **WHEN** navigating to editor view
- **THEN** task content is loaded into editor
- **AND** lock annotations are processed by editor

#### Scenario: Handle save conflicts
- **GIVEN** a user is editing on two devices
- **WHEN** changes are made on both devices simultaneously
- **THEN** last-write-wins strategy is applied
- **AND** user is notified of potential conflict

### Requirement: Task List UI

The system SHALL provide a task list interface for task management.

#### Scenario: View task list
- **GIVEN** an authenticated user with tasks
- **WHEN** navigating to task list page
- **THEN** display list of tasks with title, status, priority
- **AND** show loading state while fetching
- **AND** show empty state if no tasks

#### Scenario: Task card display
- **GIVEN** a task with title, status, and priority
- **WHEN** displayed in task list
- **THEN** show title prominently
- **AND** show status badge with appropriate color
- **AND** show priority indicator
- **AND** show last updated time

#### Scenario: Quick actions
- **GIVEN** a task in task list
- **WHEN** user clicks quick action button
- **THEN** show options: Edit, Delete, Change Status
- **AND** actions execute without page reload

#### Scenario: Empty state
- **GIVEN** a new user with no tasks
- **WHEN** viewing task list
- **THEN** display friendly empty state message
- **AND** show "Create First Task" call-to-action
- **AND** suggest using a template

### Requirement: Task Creation UI

The system SHALL provide an interface for creating new tasks.

#### Scenario: Create task modal
- **GIVEN** a user clicks "New Task" button
- **WHEN** modal opens
- **THEN** show form with title input (required)
- **AND** optional description field
- **AND** optional priority selector
- **AND** optional category selector
- **AND** optional due date picker

#### Scenario: Quick create
- **GIVEN** a user is on task list page
- **WHEN** typing in quick-create field and pressing Enter
- **THEN** task is created with just title
- **AND** default values for other fields
- **AND** task appears immediately in list (optimistic)

#### Scenario: Template selection
- **GIVEN** a user creates a new task
- **WHEN** selecting a template
- **THEN** task is pre-populated with template content
- **AND** title is set from template name

## MODIFIED Requirements

None - this is a new capability.

## REMOVED Requirements

None - this is a new capability.

## Technical Notes

### Database Schema

```sql
-- users table (authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366F1',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'draft',
    priority VARCHAR(20) DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    word_count_target INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- indexes for performance
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/tasks | Create task |
| GET | /api/v1/tasks | List tasks (with filters) |
| GET | /api/v1/tasks/{id} | Get single task |
| PUT | /api/v1/tasks/{id} | Full update |
| PATCH | /api/v1/tasks/{id} | Partial update |
| DELETE | /api/v1/tasks/{id} | Delete/Archive task |
| POST | /api/v1/categories | Create category |
| GET | /api/v1/categories | List categories |
| DELETE | /api/v1/categories/{id} | Delete category |

### Frontend Components

- `TaskList` - Main task list view
- `TaskCard` - Individual task display
- `TaskForm` - Create/edit task form
- `TaskFilters` - Filter and sort controls
- `CategoryManager` - Category CRUD
- `QuickCreate` - Fast task creation input

---

*Capability: Task Management*
*Change: add-task-persistence*
*Created: 2026-04-09*
