# Change Proposal: control-muse-trigger

## Metadata
- **Change ID**: `control-muse-trigger`
- **Type**: Bug Fix
- **Priority**: P1 (High - User Experience Issue)
- **Created**: 2025-11-10
- **Status**: Proposed

## Problem Statement

During user testing, Muse mode was found to auto-trigger AI intervention when the user simply clicks on the editor to position the cursor or focus the editor. This creates unwanted interruptions and prevents users from having control over when AI assistance is invoked.

### Current Behavior (Broken)
- User clicks anywhere in the editor while in Muse mode
- AI intervention triggers immediately
- User cannot simply position cursor without triggering AI

### Expected Behavior
Muse mode should ONLY trigger AI intervention in these specific cases:
1. **Manual Trigger**: User explicitly clicks "I'm stuck!" button
2. **STUCK Detection**: User stops typing for 30 seconds (existing timeout logic)
3. **Never**: Simple editor click/focus events

## Discovery Method

User testing session where naive user clicked the editor to position cursor and experienced unexpected AI intervention, reported as "Muse mode over-triggers" (P1 issue).

## Proposed Solution

### Investigation Phase
1. Search codebase for trigger logic:
   - `EditorCore.tsx` - likely contains onFocus/onClick handlers
   - `useMuseMode.ts` (if exists) - may have effect watching editor state
   - Related hooks and event handlers

2. Identify the specific event handler causing auto-trigger

### Implementation Phase
Remove or conditionally disable the focus/click-based trigger while preserving:
- 30-second STUCK detection timer
- Manual "I'm stuck!" button functionality
- Proper mode switching behavior

## Validation Plan

**Manual Testing**:
1. Switch to Muse mode
2. Click anywhere in editor → **No AI trigger** ✓
3. Start typing → **No AI trigger** ✓
4. Stop typing for 30+ seconds → **AI triggers** ✓
5. Click "I'm stuck!" button → **AI triggers immediately** ✓
6. Switch to Off mode → **No triggers at all** ✓

## Impact Analysis

**User Impact**: HIGH (P1)
- Current: Users cannot use Muse mode without unwanted AI interruptions
- After: Users have full control over when AI assists them

**Code Impact**: LOW
- Likely 1-5 line change (remove/disable specific event handler)
- No new dependencies or components
- Minimal risk of breaking existing functionality

## Success Criteria
- ✅ Clicking editor in Muse mode does NOT trigger AI
- ✅ 30-second idle timeout still triggers AI
- ✅ "I'm stuck!" button still triggers AI
- ✅ No regressions in Off/Loki modes

## Dependencies
- STUCK detection logic (must remain functional)
- Manual trigger button (must remain functional)
- Mode switching logic (must work correctly)

## Timeline
- Investigation: 30 minutes
- Implementation: 30 minutes
- Testing: 30 minutes
- **Total**: ~1.5 hours
