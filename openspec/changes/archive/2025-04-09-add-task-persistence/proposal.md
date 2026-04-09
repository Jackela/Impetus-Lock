# Change: Add Task Persistence Storage

## Change ID
`add-task-persistence`

## Status
Proposed

## Why

Currently, Impetus Lock stores all task data in-memory only. Users lose their work when they:
- Refresh the browser page
- Close and reopen the application
- Switch devices

This fundamentally breaks the core value proposition of a writing tool - users need confidence that their creative work (especially locked constraints they cannot delete) will persist across sessions.

**Problem Statement**: Without persistence, Impetus Lock is a toy, not a tool. Users cannot build writing habits or trust the system with their work.

**Opportunity**: Implementing task persistence unlocks:
- Multi-session writing workflows
- Cross-device usage
- User accounts and personalization
- Analytics and progress tracking
- Future collaboration features

## What Changes

### Backend Changes

1. **Database Schema**
   - Create `users` table (id, email, password_hash, created_at, updated_at)
   - Create `tasks` table (id, user_id, title, content, status, priority, category, created_at, updated_at, completed_at)
   - Create `categories` table (id, user_id, name, color, sort_order)
   - Add database migrations with Alembic

2. **API Endpoints**
   - `POST /api/v1/tasks` - Create new task
   - `GET /api/v1/tasks` - List user's tasks (with filtering/pagination)
   - `GET /api/v1/tasks/{id}` - Get single task
   - `PUT /api/v1/tasks/{id}` - Update task
   - `DELETE /api/v1/tasks/{id}` - Delete task (soft delete)
   - `PATCH /api/v1/tasks/{id}/status` - Update task status

3. **Authentication Foundation**
   - JWT token generation and validation
   - Password hashing (bcrypt)
   - HttpOnly cookie-based session management
   - Registration and login endpoints

4. **Service Layer**
   - `TaskService` - Business logic for task operations
   - `UserService` - User management operations
   - `AuthService` - Authentication logic
   - Repository pattern for data access

### Frontend Changes

1. **Task List UI**
   - Task list component with sorting/filtering
   - Task card component (title, preview, status, priority)
   - Empty state for new users
   - Loading and error states

2. **Task Management**
   - Create task modal/form
   - Edit task functionality
   - Delete task with confirmation
   - Quick status updates

3. **API Integration**
   - Task API client service
   - React Query hooks for data fetching
   - Optimistic updates for better UX
   - Error handling and retry logic

4. **Authentication UI**
   - Login form
   - Registration form
   - Auth state management
   - Protected routes

### Infrastructure Changes

1. **Database Migrations**
   - Alembic setup and configuration
   - Initial migration scripts
   - Migration documentation

2. **Environment Configuration**
   - Database connection settings
   - JWT secret configuration
   - CORS settings for auth

3. **Testing**
   - Backend: Unit tests for services, integration tests for API
   - Frontend: Component tests, E2E tests for CRUD flows
   - Database: Migration tests, seed data

## Impact

### Affected Specs
- NEW: `specs/task/spec.md` - Task management capability
- NEW: `specs/auth/spec.md` - Authentication capability
- MAYBE: `specs/editor-agentic-ui/spec.md` - Editor may need task context

### Affected Code

**Backend:**
- `server/server/models/` - New SQLAlchemy models
- `server/server/repositories/` - Data access layer
- `server/server/services/` - Business logic
- `server/server/api/routes/` - API endpoints
- `server/server/core/security.py` - Auth utilities
- `server/alembic/` - Database migrations

**Frontend:**
- `client/src/components/TaskList/` - Task list UI
- `client/src/components/TaskCard/` - Task item display
- `client/src/components/TaskForm/` - Create/edit forms
- `client/src/services/api/taskClient.ts` - API client
- `client/src/hooks/useTasks.ts` - Data fetching hooks
- `client/src/pages/Tasks.tsx` - Tasks page

### Breaking Changes
- **API Contract**: New endpoints require authentication
- **Data Format**: Task objects now include user_id and timestamps
- **Editor Integration**: Editor will need to load/save from API instead of local state

### Migration Path
1. Deploy database schema changes
2. Deploy backend API changes
3. Deploy frontend changes
4. No data migration needed (no existing persistent data)

## Success Criteria

- [ ] Users can create tasks that persist after page refresh
- [ ] Users can view a list of all their tasks
- [ ] Users can update task content and metadata
- [ ] Users can delete tasks
- [ ] Users can register and log in
- [ ] Task data is isolated per user (security)
- [ ] All CRUD operations have <500ms response time
- [ ] Test coverage ≥80% for critical paths
- [ ] E2E tests pass for complete user flows

## Dependencies

### Technical Dependencies
- PostgreSQL database (already configured)
- SQLAlchemy 2.0 (already in use)
- FastAPI (already in use)
- React Query (already in use)

### New Dependencies
- `alembic` - Database migrations
- `python-jose` - JWT handling
- `passlib[bcrypt]` - Password hashing
- `@tanstack/react-query-devtools` - Development tools

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Database schema changes needed post-launch | Medium | High | Design flexible schema, use migrations from day one |
| Authentication complexity | Medium | Medium | Use proven patterns, consider Auth0 fallback |
| Performance issues with large task lists | Low | Medium | Implement pagination, lazy loading |
| Data loss during deployment | Low | Critical | Backup strategy, transaction safety, gradual rollout |

## Open Questions

1. Should we support guest/anonymous tasks (localStorage fallback)?
2. What's the maximum task content size we should support?
3. Do we need real-time collaboration features in the initial release?
4. Should task deletion be hard delete or soft delete?

## Related Documents

- [Product Roadmap](../team-setup/product-roadmap.md)
- [specs/task/spec.md](./specs/task/spec.md) - Detailed requirements
- [API Contract](../../API_CONTRACT.md) - API specification

---

*Proposed: 2026-04-09*
*Target: Week 1-3 of Q2 Roadmap*
