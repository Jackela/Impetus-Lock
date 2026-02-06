# Troubleshooting Guide

**Last Updated**: 2026-02-05

Common issues and solutions for developing Impetus Lock.

---

## Table of Contents

- [Backend (Server)](#backend-server)
  - [Poetry Installation Issues](#poetry-installation-issues)
  - [Module Import Errors](#module-import-errors)
  - [LLM Provider Errors](#llm-provider-errors)
  - [Database Connection Issues](#database-connection-issues)
- [Frontend (Client)](#frontend-client)
  - [Vitest Hanging on Windows](#vitest-hanging-on-windows)
  - [Playwright Timeout Issues](#playwright-timeout-issues)
  - [React Query Cache Issues](#react-query-cache-issues)
  - [Milkdown Editor Not Rendering](#milkdown-editor-not-rendering)
- [Lock Enforcement](#lock-enforcement)
- [BYOK Key Storage](#byok-key-storage)

---

## Backend (Server)

### Poetry Installation Issues

#### Symptom

```
Could not import module 'server.main'
```

#### Cause

Using `poetry install --no-root` skips installing the project package itself.

#### Solution

```bash
# Ensure pyproject.toml has:
[tool.poetry]
packages = [{include = "server"}]

# Then install WITHOUT --no-root
poetry install

# Verify installation
poetry run python -c "import server.main; print('✅ Package installed correctly')"
```

#### Related Files

- `server/pyproject.toml` - Package configuration
- `server/README.md` - Installation instructions

---

### Module Import Errors

#### Symptom

```
ModuleNotFoundError: No module named 'server.domain.entities'
```

#### Cause

1. Poetry environment not activated
2. Wrong working directory
3. PYTHONPATH not set correctly

#### Solution

```bash
# Always run from server/ directory
cd server

# Use poetry run for all commands
poetry run python server/main.py

# NOT: python server/main.py (uses system Python)
```

---

### LLM Provider Errors

#### Symptom

```
InterventionError: LLM provider not configured
```

#### Cause

Missing or invalid LLM API keys in environment.

#### Solution

```bash
# Create server/.env file
cat > server/.env << 'EOF'
# Anthropic Claude (recommended)
ANTHROPIC_API_KEY=sk-ant-xxx...

# OR Google Gemini
GOOGLE_API_KEY=xxx...

# Provider selection
LLM_PROVIDER=anthropic  # or 'gemini', 'instructor', 'debug'
EOF

# Restart server
poetry run uvicorn server.main:app --reload
```

#### Debug Mode

Use `debug` provider to bypass LLM calls:

```bash
LLM_PROVIDER=debug poetry run uvicorn server.main:app --reload
```

---

### Database Connection Issues

#### Symptom

```
sqlalchemy.exc.OperationalError: could not connect to server
```

#### Cause

PostgreSQL not running or wrong connection string.

#### Solution

```bash
# Using Docker (recommended)
docker run -d \
  --name impetus-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=impetus_lock \
  -p 5432:5432 \
  postgres:16

# Update server/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/impetus_lock

# OR use in-memory database (default)
# No DATABASE_URL needed - uses InMemoryTaskRepository
```

#### Migrations

```bash
# Run Alembic migrations
cd server
poetry run alembic upgrade head

# Create new migration
poetry run alembic revision --autogenerate -m "description"
```

---

## Frontend (Client)

### Vitest Hanging on Windows

#### Symptom

Vitest tests hang/freeze and never complete.

#### Cause

Git Bash on Windows has process management issues with Vitest's file watching.

#### Solutions

**Option 1: Use PowerShell or CMD**

```powershell
# Run tests in PowerShell instead of Git Bash
cd client
npm run test
```

**Option 2: Use WSL2**

```bash
# Run inside WSL2
wsl
cd /mnt/d/Code/Impetus-Lock/client
npm run test
```

**Option 3: Disable Watch**

```bash
# Run tests once without file watching
npx vitest run --no-coverage
```

---

### Playwright Timeout Issues

#### Symptom

```
Timeout 30000ms exceeded
```

#### Cause

1. Backend not running
2. Slow network
3. Element not appearing

#### Solutions

**Increase timeout in `playwright.config.ts`:**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60000,  // 60 seconds (default: 30000)
  expect: {
    timeout: 10000,  // 10 seconds for assertions
  },
});
```

**Wait for backend in tests:**

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async () => {
  // Poll health endpoint
  for (let i = 0; i < 30; i++) {
    try {
      await page.goto('http://localhost:8000/health');
      break;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
});
```

---

### React Query Cache Issues

#### Symptom

Stale data after mutations, or optimistic updates not applying.

#### Cause

Not invalidating queries after mutations.

#### Solution

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function CreateTask() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

#### Debug Mode

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,  // Always refetch
      cacheTime: 0,  // Don't cache
    },
    logger: console,  // Log query actions
  },
});
```

---

### Milkdown Editor Not Rendering

#### Symptom

Blank editor area, no content visible.

#### Cause

1. MilkdownProvider not at root level
2. Editor not initialized
3. CSS conflicts

#### Solution

**Ensure correct provider structure:**

```tsx
// ✅ CORRECT
<MilkdownProvider>
  <EditorCore initialContent="# Hello" />
</MilkdownProvider>

// ❌ WRONG - EditorCore uses useEditor internally
<EditorCore>
  <MilkdownProvider />
</EditorCore>
```

**Wait for ready event:**

```tsx
const [isReady, setIsReady] = useState(false);

<EditorCore
  onReady={() => setIsReady(true)}
/>
{!isReady && <Skeleton />}
```

---

## Lock Enforcement

### Locks Not Being Enforced

#### Symptom

Can delete AI-added content without rejection feedback.

#### Cause

1. Lock attributes not in Markdown
2. LockManager not initialized
3. Transaction filter not applied

#### Debug Steps

**1. Check lock attributes in Markdown:**

```markdown
This is locked content. data-lock-id="lock-abc-123" data-source="muse"
```

**2. Inspect LockManager state:**

```tsx
// In browser console
window.lockManager.getAllLocks()  // Should return array of lock IDs

// In Editor component
console.log('Locks:', lockManager.getAllLocks());
```

**3. Test transaction filter:**

```tsx
// Should trigger REJECT feedback when attempting deletion
window.triggerManualDeleteForTest();
```

---

### Lock Decorations Not Showing

#### Symptom

Locked content looks like normal text (no gray background).

#### Cause

ProseMirror decorations not applied.

#### Solution

```tsx
// Ensure decorations are applied in EditorCore.tsx
useEffect(() => {
  if (!editor) return;

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    applyLockDecorations(view, lockManager);
  });
}, [editor, lockManager]);
```

**CSS check:**

```css
/* Ensure ProseMirror decorations have styles */
.ProseMirror .locked-content {
  background-color: #f0f0f0;
  border-left: 3px solid #ff6b6b;
  padding-left: 8px;
}
```

---

## BYOK Key Storage

### API Key Leaked to Client

#### Symptom

API keys visible in browser console or network requests.

#### Cause

Passing API keys through environment variables to frontend.

#### Solution

**Never expose API keys in client code:**

```bash
# ❌ WRONG in client/.env
VITE_ANTHROPIC_API_KEY=sk-ant-xxx...

# ✅ CORRECT in server/.env only
ANTHROPIC_API_KEY=sk-ant-xxx...
```

**Use backend proxy:**

```ts
// Client calls backend, backend calls LLM
POST /impetus/generate-intervention
// Backend API key used server-side
```

---

### Key Rotation

#### To rotate LLM API keys:

```bash
# 1. Update server/.env
ANTHROPIC_API_KEY=sk-ant-new-key...

# 2. Restart server
poetry run uvicorn server.main:app --reload

# 3. Verify with health check
curl http://localhost:8000/health
```

---

## Additional Resources

- [Server README](../../server/README.md) - Backend development
- [Client README](../../client/README.md) - Frontend development
- [API Contract](../../API_CONTRACT.md) - API specification
- [Architecture Guards](../../ARCHITECTURE_GUARDS.md) - Architecture rules
