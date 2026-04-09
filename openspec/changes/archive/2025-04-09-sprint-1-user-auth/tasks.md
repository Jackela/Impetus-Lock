# Sprint 1: User Authentication - Task Breakdown

## Phase 1: 需求澄清 (Requirement Clarification) ⏳

### T001: Review Change Proposal
- **Owner**: PO
- **Status**: pending
- **Description**: Review and finalize user stories for Sprint 1
- **Deliverable**: Approved proposal.md
- **Blockers**: None

### T002: Technical Feasibility Assessment
- **Owner**: Tech Lead
- **Status**: pending
- **Description**: Assess auth approach (JWT vs sessions), password hashing strategy, token storage
- **Key Questions**:
  - JWT with HttpOnly cookies vs localStorage?
  - bcrypt work factor?
  - Token expiration time?
- **Deliverable**: Technical decision record in design.md
- **Blockers**: T001

## Phase 2: 接口定义 (Interface Definition) ⏳

### T003: API Contract Definition
- **Owner**: Senior Dev
- **Status**: pending
- **Description**: Define API schemas and endpoints
- **Deliverable**: OpenAPI spec in specs/auth-api.yaml
- **Endpoints**:
  - POST /auth/register
  - POST /auth/login
  - POST /auth/logout
  - GET /auth/me
- **Blockers**: T002

### T004: Database Schema Design
- **Owner**: Tech Lead
- **Status**: pending
- **Description**: Design user table and task-user association
- **Deliverable**: Migration script + updated models
- **Blockers**: T002

### T005: Frontend Interface Design
- **Owner**: Mid Dev
- **Status**: pending
- **Description**: Define TypeScript interfaces for auth state and API
- **Deliverable**: Updated types/auth.ts
- **Blockers**: T003

## Phase 3: 并行实现 (Parallel Implementation) ⏳

### US-004: User Registration

#### T006: Backend - User Model
- **Owner**: Senior Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Create User SQLAlchemy model with bcrypt password hashing
- **Acceptance Criteria**:
  - User model with email (unique), password_hash, created_at, updated_at
  - Password hashing with bcrypt (12 rounds)
  - Email validation
- **Tests**: server/tests/test_user_model.py
- **Blockers**: T004

#### T007: Backend - Registration Endpoint
- **Owner**: Senior Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Implement POST /auth/register
- **Acceptance Criteria**:
  - 201 on success with user data (no password)
  - 400 for duplicate email
  - 400 for invalid email format
  - 400 for weak password (< 8 chars)
- **Tests**: server/tests/test_auth_register.py
- **Blockers**: T006

#### T008: Frontend - Registration Form
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required (component tests)
- **Description**: Create registration form component
- **Acceptance Criteria**:
  - Email input with validation
  - Password input with strength indicator
  - Confirm password match
  - Error display for API errors
  - Redirect to login on success
- **Files**: client/src/components/Auth/RegisterForm.tsx
- **Tests**: client/src/components/Auth/RegisterForm.test.tsx
- **Blockers**: T005, T007

### US-005: User Login

#### T009: Backend - JWT Token Generation
- **Owner**: Senior Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Implement JWT token creation and validation
- **Acceptance Criteria**:
  - Token contains user_id, exp, iat
  - HS256 signing
  - 24h expiration
  - Secure secret from env
- **Tests**: server/tests/test_jwt.py
- **Blockers**: T006

#### T010: Backend - Login Endpoint
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Implement POST /auth/login
- **Acceptance Criteria**:
  - 200 on success with token and user data
  - 401 for invalid credentials (generic message)
  - Rate limiting (5 attempts per 15 min)
- **Tests**: server/tests/test_auth_login.py
- **Blockers**: T009

#### T011: Frontend - Login Form
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required (component tests)
- **Description**: Create login form component
- **Acceptance Criteria**:
  - Email/password inputs
  - Remember me option
  - Error display for invalid credentials
  - Store token on success
  - Redirect to tasks on success
- **Files**: client/src/components/Auth/LoginForm.tsx
- **Tests**: client/src/components/Auth/LoginForm.test.tsx
- **Blockers**: T005, T010

### US-006: User Logout

#### T012: Backend - Logout Endpoint
- **Owner**: Junior Dev
- **Status**: pending
- **Priority**: P1
- **TDD**: Required
- **Description**: Implement POST /auth/logout
- **Acceptance Criteria**:
  - 204 on success
  - Token added to blocklist (optional: for immediate invalidation)
  - Idempotent (success even if token already expired)
- **Tests**: server/tests/test_auth_logout.py
- **Blockers**: T009

#### T013: Frontend - Auth Context
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Create React auth context for global session state
- **Acceptance Criteria**:
  - AuthProvider with login/logout/register methods
  - useAuth hook
  - Token persistence in localStorage
  - Automatic token refresh (if implemented)
- **Files**: client/src/contexts/AuthContext.tsx
- **Tests**: client/src/contexts/AuthContext.test.tsx
- **Blockers**: T011

#### T014: Frontend - Logout Button
- **Owner**: Junior Dev
- **Status**: pending
- **Priority**: P1
- **Description**: Add logout button to main UI
- **Acceptance Criteria**:
  - Visible when logged in
  - Clears token and state on click
  - Redirects to login page
- **Blockers**: T013

### US-007: Protected Task Operations

#### T015: Backend - Auth Middleware
- **Owner**: Senior Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Create FastAPI dependency for token validation
- **Acceptance Criteria**:
  - Extract token from Authorization header
  - Validate JWT signature and expiration
  - 401 for missing/invalid token
  - Inject current_user into request
- **Files**: server/server/auth/dependencies.py
- **Tests**: server/tests/test_auth_middleware.py
- **Blockers**: T009

#### T016: Backend - Update Task Endpoints
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Add auth requirement and user scoping to all task endpoints
- **Acceptance Criteria**:
  - All /tasks/* require auth
  - List returns only current user's tasks
  - Create associates task with current user
  - Update/delete verifies ownership (403 if not owner)
- **Tests**: server/tests/test_tasks_protected.py
- **Blockers**: T015, T007

#### T017: Frontend - Protected Routes
- **Owner**: Mid Dev
- **Status**: pending
- **Priority**: P0
- **TDD**: Required
- **Description**: Create protected route wrapper
- **Acceptance Criteria**:
  - Redirect to login if not authenticated
  - Preserve intended URL for post-login redirect
  - Show loading state while checking auth
- **Files**: client/src/components/Auth/ProtectedRoute.tsx
- **Tests**: client/src/components/Auth/ProtectedRoute.test.tsx
- **Blockers**: T013

#### T018: Frontend - API Client Auth
- **Owner**: Junior Dev
- **Status**: pending
- **Priority**: P0
- **Description**: Update API client to include auth token
- **Acceptance Criteria**:
  - Add Authorization header to all requests
  - 401 response triggers logout
  - Token is retrieved from auth context
- **Files**: Update client/src/hooks/useTaskSyncCloud.ts
- **Blockers**: T013

#### T019: Backend - Database Migration
- **Owner**: Senior Dev
- **Status**: pending
- **Priority**: P0
- **Description**: Create Alembic migration for user table and task association
- **Migration Includes**:
  - Create users table
  - Add user_id to tasks table
  - Foreign key constraint
  - Index on tasks.user_id
- **Blockers**: T004

## Phase 4: 集成验收 (Integration & Acceptance) ⏳

### T020: Integration Testing
- **Owner**: QA
- **Status**: pending
- **Description**: E2E tests for complete auth flow
- **Scenarios**:
  - Register → Login → Create Task → Logout
  - Login → View Tasks → Logout → Try Access (should redirect)
  - Two users cannot see each other's tasks
- **Files**: e2e/auth-flow.spec.ts
- **Blockers**: All implementation tasks

### T021: Security Review
- **Owner**: Tech Lead
- **Status**: pending
- **Description**: Security checklist review
- **Checklist**:
  - [ ] Passwords never logged
  - [ ] Bcrypt with appropriate work factor
  - [ ] JWT secret is strong and from env
  - [ ] No sensitive data in JWT payload
  - [ ] HTTPS required in production
  - [ ] Rate limiting implemented
  - [ ] CORS configured properly
- **Blockers**: All implementation tasks

### T022: PO Acceptance
- **Owner**: PO
- **Status**: pending
- **Description**: Validate all user stories meet acceptance criteria
- **Deliverable**: Signed off acceptance report
- **Blockers**: T020, T021

### T023: Documentation Update
- **Owner**: Junior Dev
- **Status**: pending
- **Description**: Update API docs and developer guide
- **Files**:
  - Update API documentation
  - Update CLAUDE.md with auth flow
- **Blockers**: T022

### T024: Archive Change
- **Owner**: Tech Lead
- **Status**: pending
- **Description**: Archive completed change to openspec/changes/archive/
- **Command**: `git mv openspec/changes/active/* openspec/changes/archive/`
- **Blockers**: T023

---

## Task Dependencies Graph

```
T001 → T002 → T004 → T006 → T007 → T008
            ↘ T003 → T005 ↗     ↘ T011
                          ↘ T009 → T010 ↗
                                    ↘ T012
                                    ↘ T015 → T016
                                    ↘ T013 → T014
                                          ↘ T017
                                          ↘ T018

T002 → T019 (parallel with implementation)

[All Impl] → T020 → T021 → T022 → T023 → T024
```

## Burndown Target

| Day | Tasks Complete | Cumulative |
|-----|----------------|------------|
| 1 AM | T001, T002 | 2 |
| 1 PM | T003, T004, T005 | 5 |
| 2 | T006, T007, T009, T019 | 9 |
| 3 | T008, T010, T011, T012, T013, T015 | 15 |
| 4 AM | T014, T016, T017, T018 | 19 |
| 4 PM | T020, T021, T022, T023, T024 | 24 |
