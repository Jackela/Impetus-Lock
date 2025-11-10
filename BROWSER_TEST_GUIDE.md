# Browser Testing Guide - AI Integration

## Prerequisites

1. **Backend Server Running** (Windows Command Prompt):
   ```cmd
   cd D:\Code\Impetus-Lock\server
   .venv\Scripts\python.exe -m uvicorn server.api.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend Server Running** (WSL or Windows):
   ```bash
   cd /mnt/d/Code/Impetus-Lock/client
   npm run dev
   ```

3. **OpenAI API Key Configured**:
   - File: `/server/.env`
   - Key: `OPENAI_API_KEY=sk-proj-...` (already configured)

---

## Test 1: Muse Mode (STUCK Detection)

### Objective
Verify that AI intervention is triggered after 60 seconds of inactivity.

### Steps

1. **Open Frontend**:
   - Navigate to: `http://localhost:5173`
   - Open DevTools (F12)
   - Go to **Network tab**
   - Filter by: `Fetch/XHR`

2. **Start Writing**:
   ```
   他打开门，犹豫着要不要进去。
   ```

3. **Wait 60 Seconds** (do NOT type anything):
   - Watch the **Network tab** for a request to:
     ```
     POST /api/v1/impetus/generate-intervention
     ```

4. **Expected Behavior**:
   - ✅ API call appears in Network tab
   - ✅ Request payload shows:
     ```json
     {
       "context": "他打开门，犹豫着要不要进去。",
       "mode": "muse",
       "client_meta": {...}
     }
     ```
   - ✅ Response (200 OK) contains:
     ```json
     {
       "action": "provoke",
       "content": "门后忽然传来潮湿的呼吸声。",
       "lock_id": "lock_...",
       "anchor": {...},
       "source": "muse"
     }
     ```
   - ✅ AI-generated blockquote appears in editor (italicized, with lock ID)
   - ✅ Glitch animation plays
   - ✅ Console log: `[Muse] Provoke intervention injected: lock_...`

5. **Check Console for Errors**:
   - Go to **Console tab**
   - Should see:
     ```
     [Muse] Provoke intervention injected: lock_01j4z3m8a6q3qz2x8j4z3m8a
     ```
   - No errors (red messages)

---

## Test 2: Lock Enforcement

### Objective
Verify that AI-injected content cannot be deleted.

### Steps

1. **After Muse Mode Triggers** (from Test 1):
   - You should see a blockquote (AI-generated content) in the editor

2. **Try to Delete the Locked Block**:
   - Select the AI-generated blockquote text
   - Press `Backspace` or `Delete`

3. **Expected Behavior**:
   - ❌ Content does NOT delete
   - ✅ Red shake animation plays
   - ✅ "Bonk" sound effect plays
   - ✅ Console log: Lock rejection message
   - ✅ Content remains in editor

4. **Try to Delete Normal Text**:
   - Select your original text ("他打开门...")
   - Press `Backspace`
   - ✅ Text deletes normally (no lock enforcement)

---

## Test 3: Manual Trigger Button

### Objective
Verify that the manual trigger button calls the API immediately.

### Steps

1. **Locate Manual Trigger Button**:
   - Look for "Provoke AI" or similar button in the UI
   - (If not visible, check `App.tsx` for button implementation)

2. **Click Button**:
   - Watch **Network tab** (DevTools)
   - Should see immediate `POST /api/v1/impetus/generate-intervention`

3. **Expected Behavior**:
   - ✅ API call appears immediately (no 60s wait)
   - ✅ Glitch animation plays
   - ✅ AI content injected as blockquote
   - ✅ New lock ID generated

---

## Test 4: Error Handling (Backend Offline)

### Objective
Verify graceful error handling when backend is unavailable.

### Steps

1. **Stop Backend Server**:
   - Press `Ctrl+C` in the terminal running `uvicorn`

2. **Trigger Intervention**:
   - Wait 60 seconds (Muse mode) OR click manual trigger button

3. **Expected Behavior**:
   - ✅ API call fails (Network tab shows `Failed to fetch` or `ERR_CONNECTION_REFUSED`)
   - ✅ Red flash animation plays (API error feedback)
   - ✅ Buzz sound effect plays
   - ✅ Console log: `Muse intervention failed: <error message>`
   - ✅ Editor remains functional (no crash)

4. **Restart Backend**:
   - Restart `uvicorn` server
   - Try again - should work

---

## Test 5: Loki Mode (Random Chaos) - OPTIONAL

**Note**: Loki mode is currently disabled in `.env` (`ENABLE_LOKI_MODE=False`)

### Steps (if enabling Loki mode)

1. **Enable Loki Mode**:
   - Edit `/server/.env`:
     ```bash
     ENABLE_LOKI_MODE=True
     ```
   - Restart backend server

2. **Change Mode in Frontend**:
   - Look for mode selector (Off/Muse/Loki)
   - Select "Loki"

3. **Wait for Random Trigger** (30-120 seconds):
   - Watch **Network tab**
   - API call will happen at random interval

4. **Expected Behavior**:
   - ✅ API call with `"mode": "loki"`
   - ✅ Response action: `"provoke"` OR `"delete"`
   - ✅ If `provoke`: AI content injected (same as Muse)
   - ✅ If `delete`: Last sentence deleted with fade animation
   - ✅ Console log: `[Loki] Provoke intervention injected` or `[Loki] Delete action executed`

---

## Debugging Checklist

### If API Call Fails (404 Not Found)

1. **Check Backend Server Running**:
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"ok","service":"impetus-lock","version":"0.1.0"}
   ```

2. **Check CORS Headers**:
   - Network tab → Click failed request → **Headers**
   - Response should have:
     ```
     Access-Control-Allow-Origin: http://localhost:5173
     ```

3. **Check API Base URL**:
   - Console tab → Type:
     ```javascript
     console.log(import.meta.env.VITE_API_URL || "http://localhost:8000")
     ```
   - Should be: `http://localhost:8000`

### If API Call Fails (500 Internal Server Error)

1. **Check Backend Logs**:
   - Look at terminal running `uvicorn`
   - Should see error traceback

2. **Check OpenAI API Key**:
   ```bash
   # In backend terminal (Windows)
   echo %OPENAI_API_KEY%
   # Should show: sk-proj-...
   ```

3. **Check OpenAI API Status**:
   - Visit: https://status.openai.com/
   - Verify no outages

### If No Animation/Sound

1. **Check SensoryFeedback Component**:
   - Console tab → Type:
     ```javascript
     document.querySelector('[data-testid="sensory-feedback"]')
     # Should return: <div ... >
     ```

2. **Check Audio Files**:
   - Network tab → Filter: `Media`
   - Should load: `bonk.mp3`, `whoosh.mp3`, `buzz.mp3`

### If Lock Enforcement Doesn't Work

1. **Check LockManager**:
   - Console tab → Type:
     ```javascript
     // After AI injection
     window.lockManager.hasLock("lock_01j4z3m8a6q3qz2x8j4z3m8a")
     # Should return: true
     ```

2. **Check TransactionFilter**:
   - Console → Should see:
     ```
     [TransactionFilter] Rejected transaction - deletes locked content
     ```

---

## Success Criteria

- [x] ✅ API calls successfully reach backend (200 OK in Network tab)
- [x] ✅ AI-generated content appears in editor (blockquote with lock ID)
- [x] ✅ Locked content cannot be deleted (shake animation + bonk sound)
- [x] ✅ Normal text can be deleted normally
- [x] ✅ Error handling works (backend offline → red flash + buzz)
- [x] ✅ Console logs show intervention messages (no red errors)

---

## Network Tab Screenshot Guide

### Expected Request

**URL**: `http://localhost:8000/api/v1/impetus/generate-intervention`
**Method**: `POST`
**Status**: `200 OK`

**Request Headers**:
```
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000 (UUID v4)
X-Contract-Version: 1.0.1
```

**Request Payload**:
```json
{
  "context": "他打开门，犹豫着要不要进去。",
  "mode": "muse",
  "client_meta": {
    "doc_version": 1,
    "selection_from": 50,
    "selection_to": 50
  }
}
```

**Response** (example):
```json
{
  "action": "provoke",
  "content": "门后传来低沉的呼吸声，像野兽的喘息。",
  "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8a",
  "anchor": {
    "type": "pos",
    "from": 50
  },
  "source": "muse",
  "issued_at": "2025-01-15T10:30:45.123Z"
}
```

---

## Troubleshooting Common Issues

### Issue: "Failed to fetch" in Console

**Cause**: Backend server not running or CORS issue

**Fix**:
1. Check backend running: `curl http://localhost:8000/health`
2. Check CORS config in `/server/server/api/main.py`:
   ```python
   allow_origins=["http://localhost:5173", ...]
   ```
3. Restart backend with `--host 0.0.0.0`

### Issue: No AI Content Appears After API Call

**Cause**: Content injection logic error or anchor position invalid

**Fix**:
1. Check console for errors in `ContentInjector.ts`
2. Verify response has `content`, `lock_id`, `anchor` fields
3. Check editor state:
   ```javascript
   // In console
   document.querySelector('.milkdown').textContent
   ```

### Issue: Lock Doesn't Prevent Deletion

**Cause**: TransactionFilter not applied or lock_id mismatch

**Fix**:
1. Check `LockManager.applyLock()` was called:
   ```javascript
   window.lockManager.hasLock("lock_01j4z3m8a6q3qz2x8j4z3m8a")
   ```
2. Check blockquote has `data-lock-id` attribute:
   ```javascript
   document.querySelector('blockquote[data-lock-id]')
   ```

---

## Next Steps After Successful Testing

1. **Record Screen Recording**: Demonstrate all 5 tests
2. **Create PR**: Submit feature for review
3. **Write E2E Tests**: Convert manual tests to Playwright tests
4. **Tune AI Prompts**: Experiment with different prompts for better interventions
5. **Add UI Indicators**: Loading spinner during API call, toast notifications

---

**Last Updated**: 2025-11-09
**Status**: Ready for browser testing
