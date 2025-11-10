# Quick Start - Testing Guide

**Ready to test User Story 1 & 2 implementations** ✅

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

#### Backend
```bash
cd server
pip install instructor openai pydantic fastapi uvicorn pytest
```

Or with Poetry:
```bash
cd server
poetry install
```

#### Frontend (Already Done)
```bash
cd client
npm install  # Already complete if build passed
```

---

### Step 2: Configure Environment

Create `server/.env` file:
```bash
# In server/ directory, create .env file
OPENAI_API_KEY=sk-proj-your-actual-key-here
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.9
```

**Important**: Replace `sk-proj-your-actual-key-here` with your real OpenAI API key.

---

### Step 3: Start Servers

#### Terminal 1: Backend
```bash
cd server
uvicorn server.api.main:app --reload --port 8000

# Expected output:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete.
```

#### Terminal 2: Frontend
```bash
cd client
npm run dev

# Expected output:
# VITE v7.2.0  ready in XXX ms
# ➜  Local:   http://localhost:5173/
```

---

## ✅ Verification Tests

### Test 1: Health Check
```bash
# In a third terminal:
curl http://localhost:8000/health

# Expected:
# {"status":"ok","service":"impetus-lock","version":"0.1.0"}
```

### Test 2: Frontend Loads
1. Open browser: http://localhost:5173
2. **Expected**: Editor loads, no console errors

### Test 3: Muse Mode STUCK Detection
1. Open: http://localhost:5173?mode=muse
2. Type in editor: "他打开门，犹豫着要不要进去。"
3. Stop typing and wait 60 seconds
4. **Expected**:
   - Console shows: `WRITING → IDLE (5s) → STUCK (60s)`
   - Network tab shows POST to `/api/v1/impetus/generate-intervention`
   - Locked blockquote appears in editor
   - Try to delete it → Cannot delete ✅

### Test 4: Lock Enforcement
1. Type some text
2. Trigger a Muse intervention (wait 60s)
3. Locked block appears
4. Try Backspace/Delete/Ctrl+A+Delete
5. **Expected**: Locked block remains intact ✅

---

## 🧪 Run Automated Tests

### Backend Tests (22 tests)
```bash
cd server
python -m pytest tests/ -v

# Expected: 22 passed
```

### Frontend Unit Tests (63 tests)
```bash
cd client
npm run test

# Expected: 63 passed
```

### Frontend E2E Tests (11 tests)
**Requires: Backend + Frontend running**

```bash
cd client
npm run test:e2e -- muse-intervention.spec.ts

# Expected: 11 passed (or skip if server not ready)
```

---

## 📊 What to Look For

### Console Logs (Browser DevTools)
```
[Muse] State: WRITING
[Muse] State: IDLE (after 5s)
[Muse] State: STUCK (after 60s)
[Muse] Calling API with context: "他打开门，犹豫着要不要进去。"
[Muse] Intervention injected: lock_01j4z3m8a6q3qz2x8j4z3m8a
[ContentInjector] Injected locked block at pos 123: lock_...
```

### Network Tab (Browser DevTools)
```
POST /api/v1/impetus/generate-intervention
Status: 200 OK
Headers:
  - Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  - X-Contract-Version: 1.0.1
Request:
  {
    "context": "他打开门，犹豫着要不要进去。",
    "mode": "muse",
    "client_meta": {
      "doc_version": 1,
      "selection_from": 14,
      "selection_to": 14
    }
  }
Response:
  {
    "action": "provoke",
    "content": "门后传来低沉的呼吸声。",
    "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8a",
    "anchor": {"type": "pos", "from": 14},
    "action_id": "act_...",
    "source": "muse",
    "issued_at": "2025-01-01T12:00:00.000Z"
  }
```

---

## 🐛 Troubleshooting

### Backend Error: `ModuleNotFoundError: No module named 'instructor'`
```bash
cd server
pip install instructor openai
```

### Backend Error: `OPENAI_API_KEY not configured`
- Check `server/.env` file exists
- Check key starts with `sk-proj-` or `sk-`

### Frontend Error: Module not found
```bash
cd client
npm install
```

### E2E Tests Timeout
- Make sure backend is running on port 8000
- Make sure frontend is running on port 5173
- Check that tests use fake timers (`vi.useFakeTimers()`)

### No Intervention Triggered
**Checklist**:
1. URL has `?mode=muse`
2. Backend server running (check http://localhost:8000/health)
3. Typed some text (context needed)
4. Waited full 60 seconds without typing
5. Check browser console for state changes
6. Check network tab for API call

---

## 📁 Key Files Reference

### Configuration
- `server/.env` - Backend environment variables
- `client/vite.config.ts` - Frontend dev server config

### Entry Points
- `server/server/api/main.py` - FastAPI app
- `client/src/main.tsx` - React app
- `client/src/App.tsx` - Root component

### Implementation
- `client/src/components/Editor/EditorCore.tsx` - Main editor + state machine
- `client/src/hooks/useWritingState.ts` - STUCK detection
- `client/src/services/api/interventionClient.ts` - API calls
- `server/server/api/routes/intervention.py` - Backend endpoint
- `server/server/infrastructure/llm/prompts/muse_prompt.py` - Prompt templates

---

## ✅ Success Criteria

After testing, verify:
- [ ] Lock enforcement works (cannot delete locked blocks)
- [ ] STUCK detection triggers after 60s idle
- [ ] API call sends correct context (last 3 sentences)
- [ ] Intervention content is injected and locked
- [ ] All 85 automated tests pass
- [ ] No console errors during normal usage

---

## 🎯 Next Steps After Testing

1. **If all tests pass**: Mark T066 complete, proceed to T068-T069
2. **If issues found**: Debug and fix, re-run tests
3. **Then**: Run Act CLI validation (T073-T078)
4. **Finally**: Start User Story 3 (Loki Mode)

---

**Estimated Testing Time**: 15-30 minutes
**Prerequisites**: OpenAI API key, Node.js, Python 3.12+
**Status**: ✅ Ready to start testing
