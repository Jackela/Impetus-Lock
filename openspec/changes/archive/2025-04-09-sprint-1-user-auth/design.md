# Sprint 1: User Authentication - Technical Design

## Status
Phase 2: 接口定义 (Interface Definition) ✅ COMPLETE

**Phase 2 Gate Check**:
- ✅ Mid Dev reviewed: API interfaces are intuitive
- ✅ Checked existing code: Can reuse database patterns from Sprint 0
- ✅ All interfaces defined: API spec, database schema, frontend types

**Created Artifacts**:
- specs/auth-api.yaml (OpenAPI spec)
- design.md (this file - technical decisions documented)
- Database schema defined
- Architecture decisions approved

## Technical Decisions

### Decision 1: JWT with HttpOnly Cookies
**Context**: Need to choose between JWT (stateless) vs Sessions (stateful)

**Decision**: Use JWT tokens transported in HttpOnly cookies

**Rationale**:
- Stateless authentication scales better
- No server-side session storage needed
- HttpOnly cookies prevent XSS token theft
- Automatic cookie handling in browser
- CSRF protection via SameSite cookies

**Alternative Rejected**: localStorage JWT
- More vulnerable to XSS attacks
- Requires manual token management in JS

### Decision 2: bcrypt with Work Factor 12
**Context**: Password hashing algorithm and strength

**Decision**: Use bcrypt with work factor 12

**Rationale**:
- bcrypt is time-tested and resistant to GPU attacks
- Work factor 12 ≈ 250ms hash time (good balance)
- Python's bcrypt library is well-maintained
- Per-password salting automatic

### Decision 3: Access Token Only (No Refresh Tokens)
**Context**: Token expiration and refresh strategy

**Decision**: Single access token with 24h expiration, no refresh token

**Rationale**:
- Simpler implementation for MVP
- 24h expiration balances security and UX
- Can add refresh tokens later if needed
- Reduced complexity = fewer bugs

**Future Consideration**: Add refresh token rotation for enhanced security

### Decision 4: FastAPI Dependencies for Auth
**Context**: How to inject auth into protected endpoints

**Decision**: Use FastAPI `Depends(get_current_user)` pattern

**Rationale**:
- Native FastAPI dependency injection
- Clean endpoint signatures
- Automatic OpenAPI documentation
- Easy to test with dependency overrides

## Architecture

### Auth Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   FastAPI   │     │  PostgreSQL │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /auth/login  │                   │
       │ {email, password} │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ SELECT * FROM users
       │                   │ WHERE email = ?   │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ Return user row   │
       │                   │<──────────────────│
       │                   │                   │
       │                   │ bcrypt.verify()   │
       │                   │                   │
       │                   │ jwt.encode()      │
       │                   │                   │
       │ Set-Cookie: token │                   │
       │<──────────────────│                   │
       │                   │                   │
       │                   │                   │
       │ GET /tasks/       │                   │
       │ Cookie: token     │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ jwt.decode()      │
       │                   │                   │
       │                   │ SELECT * FROM tasks
       │                   │ WHERE user_id = ? │
       │                   │──────────────────>│
       │                   │                   │
       │ 200 OK + tasks[]  │                   │
       │<──────────────────│                   │
```

### Directory Structure

```
server/
├── server/
│   ├── auth/                    # NEW: Authentication module
│   │   ├── __init__.py
│   │   ├── dependencies.py      # get_current_user dependency
│   │   ├── router.py            # /auth/* endpoints
│   │   ├── service.py           # Auth business logic
│   │   └── utils.py             # JWT encode/decode, password hashing
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py              # NEW: User SQLAlchemy model
│   │   └── task.py              # UPDATED: Add user_id FK
│   └── main.py                  # UPDATED: Include auth router
└── tests/
    ├── test_auth_*.py           # NEW: Auth tests
    └── test_tasks_protected.py  # NEW: Protected task tests

client/src/
├── components/
│   └── Auth/                    # NEW: Auth components
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx          # NEW: Auth state management
├── hooks/
│   └── useAuth.ts               # NEW: Auth hook
└── services/
    └── authApi.ts               # NEW: Auth API client
```

## Database Schema

### User Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Updated Task Table

```sql
-- Add user_id to existing tasks table
ALTER TABLE tasks
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
```

### Migration Strategy

1. Create users table (empty)
2. Add user_id to tasks (nullable initially)
3. Application code enforces auth
4. Future migration: make user_id NOT NULL

## API Specification

### POST /auth/register

Request:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

Response 201:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

Response 400 (duplicate email):
```json
{
  "detail": "Email already registered"
}
```

### POST /auth/login

Request:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

Response 200:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```
Response includes `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`

Response 401:
```json
{
  "detail": "Invalid credentials"
}
```

### POST /auth/logout

Response 204 (no body)
Response includes `Set-Cookie: access_token=; Max-Age=0`

### GET /auth/me

Response 200:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "created_at": "2024-01-01T00:00:00Z"
}
```

Response 401:
```json
{
  "detail": "Not authenticated"
}
```

## Frontend Auth State

### AuthContext Interface

```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

### Token Storage

- **Server**: HttpOnly cookie (not accessible to JS)
- **Client**: No direct storage - browser handles cookie
- **Memory**: User object stored in AuthContext

### API Client Configuration

```typescript
// Axios or fetch with credentials
fetch('/api/tasks/', {
  credentials: 'include',  // Sends cookies
});
```

## Security Considerations

### Implemented Protections

1. **Password Hashing**: bcrypt with salt
2. **Token Security**: HttpOnly, Secure, SameSite cookies
3. **Rate Limiting**: 5 login attempts per 15 minutes per IP
4. **Generic Errors**: Same message for "user not found" vs "wrong password"
5. **HTTPS**: Required in production (cookie Secure flag)
6. **CORS**: Restricted to known origins

### Future Enhancements

- [ ] Refresh token rotation
- [ ] Email verification on registration
- [ ] Password reset flow
- [ ] Account lockout after failed attempts
- [ ] 2FA support
- [ ] Audit logging

## Testing Strategy

### Backend Tests

1. **Unit Tests**: Password hashing, JWT encode/decode
2. **Integration Tests**: Auth endpoints with TestClient
3. **Security Tests**: Verify protected routes reject unauthorized

### Frontend Tests

1. **Component Tests**: Form validation, error display
2. **Hook Tests**: useAuth state management
3. **E2E Tests**: Complete login → use app → logout flow

## Open Questions

1. Do we need email verification for MVP? → **No, defer to future sprint**
2. Should we implement password reset? → **No, defer to future sprint**
3. Account deletion? → **No, defer to future sprint**

---

**Decision Log**:
- 2026-04-09: Approved JWT with HttpOnly cookies approach
- 2026-04-09: Approved bcrypt work factor 12
- 2026-04-09: Approved no refresh tokens for MVP
