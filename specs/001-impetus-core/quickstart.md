# Developer Quickstart: Impetus Lock Core

**Feature**: Impetus Lock Core - Agent Intervention System  
**Branch**: `001-impetus-core`  
**Target Audience**: Developers implementing P1 tasks

---

## Overview

This guide helps you set up your development environment to implement the **Impetus Lock Core** feature (Muse + Loki modes with un-deletable constraints).

**Prerequisites**:
- **Spec Understanding**: Read [spec.md](spec.md) first (user stories, requirements, success criteria)
- **Data Model**: Review [data-model.md](data-model.md) (entities, state machines)
- **API Contract**: Familiarize with [contracts/intervention.yaml](contracts/intervention.yaml) (request/response schemas)

---

## Technology Stack

### Frontend
- **Editor**: Milkdown ^7.x (ProseMirror-based)
- **Framework**: React 18.x + TypeScript 5.x
- **Build Tool**: Vite 5.x
- **Animations**: Framer Motion ^11.x (P2)
- **Testing**: Vitest (unit) + Playwright (E2E)

### Backend
- **Framework**: FastAPI ^0.115.0
- **AI Integration**: Instructor ^1.4.0 (strongly-typed LLM outputs)
- **LLM Provider**: OpenAI API (gpt-4)
- **Testing**: pytest + httpx (FastAPI TestClient)

---

## Environment Setup

### 1. Clone Repository & Switch Branch

```bash
git clone <repository-url>
cd Impetus-Lock
git checkout 001-impetus-core
```

### 2. Backend Setup

```bash
cd server

# Install dependencies (Poetry)
poetry install

# Set environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-...

# Verify setup
poetry run pytest tests/test_health.py

# Run development server
poetry run uvicorn server.api.main:app --reload --port 8000
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Test Health Endpoint**:
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

### 3. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Verify setup
npm run test

# Run development server
npm run dev
```

**Expected Output**:
```
VITE v5.x.x  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Verify Editor Loads**:
- Open http://localhost:5173/
- You should see a blank Milkdown editor (no errors in console)

---

## Key Development Workflows

### Workflow 1: Implementing Lock Enforcement (TDD)

**Goal**: Prevent deletion of blocks with `lock_id` attribute.

**1. Write Failing Test** (client/tests/e2e/lock-enforcement.spec.ts):
```typescript
import { test, expect } from '@playwright/test';

test('should block deletion of locked block', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Inject locked block via API simulation
  await page.evaluate(() => {
    window.editor.injectLockedBlock({
      content: '> [AI施压]: 门后是一堵砖墙。',
      lock_id: 'lock_test123'
    });
  });
  
  // Try to delete locked block
  await page.keyboard.press('End'); // Move to end of locked block
  await page.keyboard.press('Backspace');
  
  // Verify block still exists
  const content = await page.evaluate(() => window.editor.getMarkdown());
  expect(content).toContain('门后是一堵砖墙');
});
```

**2. Run Test** (should FAIL):
```bash
npm run test:e2e
# Expected: Test fails because filterTransaction not implemented
```

**3. Implement `filterTransaction`** (client/src/components/Editor/TransactionFilter.ts):
```typescript
import { Transaction } from 'prosemirror-state';
import { ReplaceStep } from 'prosemirror-transform';

export function createLockFilter(lockedNodeIds: Set<string>) {
  return (tr: Transaction) => {
    // Check if transaction deletes a locked node
    const deletesLockedNode = tr.steps.some(step => {
      if (!(step instanceof ReplaceStep)) return false;
      
      // Check if any deleted node has lock_id attribute
      const deletedNodes = getDeletedNodes(step, tr.docs[0]);
      return deletedNodes.some(node => 
        lockedNodeIds.has(node.attrs.lock_id)
      );
    });
    
    if (deletesLockedNode) {
      triggerShakeAnimation(); // Visual feedback
      playBonkSound();          // Audio feedback
      return false; // Block transaction
    }
    
    return true; // Allow transaction
  };
}
```

**4. Run Test Again** (should PASS):
```bash
npm run test:e2e
# Expected: ✓ should block deletion of locked block (2.3s)
```

---

### Workflow 2: Implementing Muse STUCK Detection (TDD)

**Goal**: Detect when user is stuck (60s idle) and trigger intervention.

**1. Write Failing Test** (client/tests/unit/state-machine.test.ts):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { useWritingState } from '@/hooks/useWritingState';

describe('useWritingState', () => {
  it('should transition to STUCK after 60s idle', async () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => 
      useWritingState({ mode: 'muse', onStuck })
    );
    
    // Simulate user typing
    result.current.onInput();
    expect(result.current.state).toBe('WRITING');
    
    // Fast-forward 60 seconds
    vi.advanceTimersByTime(60000);
    
    // Verify state transitioned to STUCK
    expect(result.current.state).toBe('STUCK');
    expect(onStuck).toHaveBeenCalledOnce();
  });
});
```

**2. Run Test** (should FAIL):
```bash
npm run test
# Expected: Test fails because useWritingState not implemented
```

**3. Implement State Machine** (client/src/hooks/useWritingState.ts):
```typescript
import { useState, useEffect } from 'react';

export function useWritingState(config: { mode: 'muse' | 'loki' | 'off', onStuck?: () => void }) {
  const [state, setState] = useState<'WRITING' | 'IDLE' | 'STUCK'>('IDLE');
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  
  useEffect(() => {
    if (config.mode !== 'muse') return;
    
    const interval = setInterval(() => {
      const idleTime = Date.now() - lastInputTime;
      
      if (idleTime < 5000) {
        setState('WRITING');
      } else if (idleTime < 60000) {
        setState('IDLE');
      } else {
        setState('STUCK');
        config.onStuck?.();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastInputTime, config.mode, config.onStuck]);
  
  const onInput = () => setLastInputTime(Date.now());
  
  return { state, onInput };
}
```

**4. Run Test Again** (should PASS):
```bash
npm run test
# Expected: ✓ should transition to STUCK after 60s idle (61ms)
```

---

### Workflow 3: Calling Backend API (Integration Test)

**Goal**: Verify frontend can call `/api/v1/impetus/generate-intervention` and handle response.

**1. Write Integration Test** (server/tests/test_intervention_api.py):
```python
import pytest
from fastapi.testclient import TestClient
from server.api.main import app

client = TestClient(app)

def test_generate_intervention_muse_mode():
    """Test Muse mode returns provoke action"""
    response = client.post(
        "/api/v1/impetus/generate-intervention",
        headers={
            "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
            "X-Contract-Version": "1.0.1"
        },
        json={
            "context": "他打开门,犹豫着要不要进去。",
            "mode": "muse",
            "client_meta": {
                "doc_version": 1,
                "selection_from": 20,
                "selection_to": 20
            }
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert data["action"] == "provoke"
    assert "content" in data
    assert data["content"].startswith("> [AI施压")
    assert "lock_id" in data
    assert data["lock_id"].startswith("lock_")
    assert "action_id" in data
```

**2. Run Backend Test**:
```bash
cd server
poetry run pytest tests/test_intervention_api.py -v
```

**3. Implement Endpoint** (server/server/api/routes/intervention.py):
```python
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from instructor import from_openai
from openai import OpenAI
import os

router = APIRouter()

class InterventionRequest(BaseModel):
    context: str
    mode: str
    client_meta: dict

class InterventionResponse(BaseModel):
    action: str
    content: str | None = None
    lock_id: str | None = None
    action_id: str

@router.post("/api/v1/impetus/generate-intervention")
async def generate_intervention(
    request: InterventionRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    contract_version: str = Header(..., alias="X-Contract-Version")
):
    if contract_version != "1.0.1":
        raise HTTPException(status_code=400, detail="Unsupported contract version")
    
    # TODO: Check idempotency cache
    
    # Call LLM via Instructor
    client = from_openai(OpenAI(api_key=os.getenv("OPENAI_API_KEY")))
    
    # TODO: Implement LLM call with Pydantic response model
    
    return InterventionResponse(
        action="provoke",
        content=f"> [AI施压 - {request.mode.title()}]: 门后传来低沉的呼吸声。",
        lock_id="lock_01j4z3m8a6q3qz2x8j4z3m8a",
        action_id="act_550e8400-e29b-41d4-a716-446655440000"
    )
```

**4. Verify Integration**:
```bash
# Start backend
poetry run uvicorn server.api.main:app --reload

# In another terminal, run test
poetry run pytest tests/test_intervention_api.py -v
# Expected: ✓ test_generate_intervention_muse_mode PASSED
```

---

## Common Development Tasks

### Generate TypeScript Types from OpenAPI

```bash
cd client
npx openapi-typescript ../specs/001-impetus-core/contracts/intervention.yaml -o src/types/api.generated.ts
```

**Usage**:
```typescript
import type { paths } from '@/types/api.generated';

type InterventionRequest = paths['/api/v1/impetus/generate-intervention']['post']['requestBody']['content']['application/json'];
type InterventionResponse = paths['/api/v1/impetus/generate-intervention']['post']['responses']['200']['content']['application/json'];
```

---

### Run All Quality Gates

```bash
# Frontend
cd client
npm run lint        # ESLint + Prettier
npm run type-check  # TypeScript compiler
npm run test        # Vitest unit tests
npm run test:e2e    # Playwright E2E tests

# Backend
cd server
poetry run ruff check server/        # Python linter
poetry run mypy server/              # Type checker
poetry run pytest --cov=server/      # Tests with coverage
```

---

### Debug Backend API Calls

**Enable Request Logging**:
```python
# server/api/main.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**View Auto-Generated API Docs**:
- OpenAPI UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Test with curl**:
```bash
curl -X POST http://localhost:8000/api/v1/impetus/generate-intervention \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "X-Contract-Version: 1.0.1" \
  -d '{
    "context": "他打开门,犹豫着要不要进去。",
    "mode": "muse",
    "client_meta": { "doc_version": 1, "selection_from": 20, "selection_to": 20 }
  }' | jq
```

---

## Constitution Compliance Checklist

Before merging any code, verify:

### Article I: Simplicity ✅
- [ ] Used Milkdown's native `filterTransaction` API (no custom editor layer)
- [ ] No state management library (React useState sufficient for 3-state machine)
- [ ] No unnecessary abstractions (only LockManager for actual multi-editor support)

### Article III: Test-First ✅
- [ ] Test file written BEFORE implementation
- [ ] Test fails initially (red phase)
- [ ] Minimal implementation to pass test (green phase)
- [ ] Code coverage ≥80% for critical paths

### Article IV: SOLID Principles ✅
- [ ] Endpoint delegates to service layer (SRP)
- [ ] Service uses LLMProvider abstraction, not concrete OpenAI client (DIP)
- [ ] Constructor injection used (no direct instantiation in service)

### Article V: Documentation ✅
- [ ] JSDoc for all exported frontend functions
- [ ] Google-style docstrings for all backend public APIs
- [ ] Inline comments for critical logic (filterTransaction, Undo bypass)

---

## Troubleshooting

### Frontend: Editor Not Loading
**Symptom**: Blank page, console error `Cannot read property 'create' of undefined`  
**Fix**: Ensure all Milkdown dependencies installed:
```bash
npm install @milkdown/core @milkdown/react @milkdown/preset-commonmark
```

### Backend: LLM Call Fails
**Symptom**: 500 error, logs show `openai.AuthenticationError`  
**Fix**: Verify `.env` file has valid `OPENAI_API_KEY=sk-...`

### E2E Tests Timeout
**Symptom**: Playwright tests hang indefinitely  
**Fix**: Start dev server first:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:e2e
```

---

## Next Steps

1. **Read Tasks Breakdown**: Once `/speckit.tasks` is run, review `tasks.md` for sequenced implementation tasks
2. **Start with P1 Wave 1**: Implement Lock mechanism + Muse STUCK detection first (highest priority)
3. **Follow TDD Cycle**: Red → Green → Refactor for every task

**Questions?** Refer to:
- [spec.md](spec.md) - User requirements
- [data-model.md](data-model.md) - Entity definitions
- [contracts/intervention.yaml](contracts/intervention.yaml) - API contract
- [constitution.md](../../.specify/memory/constitution.md) - Project governance
