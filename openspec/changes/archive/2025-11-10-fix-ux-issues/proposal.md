# Change Proposal: fix-ux-issues

## Metadata
- **Change ID**: `fix-ux-issues`
- **Type**: Bug Fix + UX Improvement
- **Priority**: P0 (Critical User Experience Issues)
- **Created**: 2025-11-10
- **Status**: Proposed

## Problem Statement

User testing revealed critical UX and functional issues that break core product value:

### P0 - Core Functionality Broken
**Lock mechanism not enforced**: AI-added blockquote content can be deleted with Delete key, defeating the entire "Impetus Lock" concept. Users can select and delete the text, leaving empty blockquote structures.

### P1 - Interaction Bugs
1. **Dropdown menu fails**: Clicking AI Mode dropdown options times out (5s), requiring keyboard workaround
2. **Muse mode over-triggers**: Clicking editor auto-triggers AI intervention without user control

### P2 - UX/Discoverability
1. **No onboarding**: Users don't understand Muse vs Loki modes or the Lock concept
2. **Dev buttons exposed**: "Test Delete feedback (dev only)" shown to end users
3. **Empty state confusion**: Deleted blockquotes leave empty structures visible

## Discovery Method

Chrome DevTools MCP-based user testing session where AI acted as naive user, discovering:
- Lock enforcement completely non-functional
- Dropdown interaction requiring fallback to keyboard
- Unexpected AI trigger behavior
- Missing product explanation

## Proposed Solution

###

 Phase 1: Fix Core Lock Enforcement (P0)
Implement ProseMirror `filterTransaction` to block deletion of locked blocks:
```typescript
// In TransactionFilter.ts
if (lockManager.hasLock(lockId)) {
  // Block delete transactions for locked nodes
  if (tr.steps.some(step => deleteAffectsLockedNode(step, lockId))) {
    onReject();  // Trigger shake animation
    return false;
  }
}
```

### Phase 2: Fix Dropdown Interaction (P1)
Replace native `<select>` with accessible custom dropdown using Radix UI or similar, with proper click handling.

### Phase 3: Control Muse Trigger Logic (P1)
Only trigger AI on:
- Manual "I'm stuck!" button click
- After 30s idle time in Muse mode (existing STUCK detection)
- NOT on simple editor focus/click

### Phase 4: Hide Dev Features (P2)
Add environment check to conditionally render dev-only buttons:
```typescript
const isDev = import.meta.env.DEV;
{isDev && <button>Test Delete</button>}
```

### Phase 5: Add Onboarding (P2)
Create welcome modal explaining:
- Muse mode: Adds creative prompts when stuck
- Loki mode: Random chaos (deletes + rewrites)
- Lock concept: AI additions can't be removed

### Phase 6: Clean Empty Blockquotes (P3)
Remove empty blockquote nodes when their content is deleted.

## Validation Plan

**Must validate with Chrome DevTools MCP**:
1. Lock enforcement:
   - Add AI content → Try Delete/Backspace → Content persists + shake animation
2. Dropdown:
   - Click Muse option → Selection changes immediately
3. Muse trigger:
   - Click editor → No AI trigger
   - Click "I'm stuck!" → AI triggers
4. Dev button:
   - Production build → "Test Delete" not visible
5. Onboarding:
   - Fresh load → Welcome modal explains modes

## Impact Analysis

**User Impact**: CRITICAL
- Current: Core product value broken (locks don't work)
- After: Product functions as advertised

**Code Impact**: MEDIUM
- TransactionFilter enhancement (lock enforcement)
- Dropdown component replacement
- Trigger logic refinement
- Conditional rendering for dev features

## Success Criteria
- ✅ Locked content cannot be deleted (shake animation on attempt)
- ✅ Dropdown works with mouse clicks
- ✅ Muse mode doesn't auto-trigger on focus
- ✅ No dev buttons in production
- ✅ Welcome modal educates new users

## Dependencies
- ProseMirror transaction filtering (already partially implemented)
- Sensory feedback system (already implemented for shake)
- Mode detection logic (already implemented)

## Timeline
- Phase 1 (Lock): 2 hours
- Phase 2 (Dropdown): 1 hour
- Phase 3 (Trigger): 1 hour
- Phase 4 (Dev hide): 30 min
- Phase 5 (Onboarding): 2 hours
- Phase 6 (Cleanup): 1 hour
- **Total**: ~8 hours
