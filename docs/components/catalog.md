# Component Catalog

**Last Updated**: 2026-02-05

This document provides a comprehensive reference for all reusable UI components in the Impetus Lock frontend.

---

## Table of Contents

- [TaskList](#tasklist)
- [CreateTaskModal](#createtaskmodal)
- [NewTaskButton](#newtaskbutton)
- [ErrorBoundary](#errorboundary)
- [Toast / ToastContainer](#toast--toastcontainer)
- [Skeleton](#skeleton)
- [EditorCore](#editorcore)
- [FloatingToolbar](#floatingtoolbar)
- [BottomDockedToolbar](#bottomdockedtoolbar)
- [WelcomeModal](#welcomemodal)
- [ManualTriggerButton](#manualtriggerbutton)
- [TimerIndicator](#timerindicator)
- [SensoryFeedback](#sensoryfeedback)

---

## TaskList

**File**: `src/components/TaskList/TaskList.tsx`

Displays a list of tasks with title, creation time, lock status, and version indicator.

### Purpose

Render task items with click-to-select functionality and lock count badges.

### Props Interface

```typescript
interface TaskListProps {
  tasks: TaskRecord[];           // Array of tasks to display
  onTaskClick?: (task: TaskRecord) => void;  // Optional click handler
  selectedTaskId?: string;       // ID of currently selected task
}
```

### Usage Example

```tsx
import { TaskList } from './components/TaskList';

function TaskListPage() {
  const { data } = useTasks();
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <TaskList
      tasks={data ?? []}
      onTaskClick={(task) => setSelectedId(task.id)}
      selectedTaskId={selectedId}
    />
  );
}
```

### Dependencies

- `TaskRecord` type from `src/types/task.ts`
- CSS: `src/components/TaskList/TaskList.css`

### Accessibility Notes

- `role="list"` on the container
- `aria-selected` on selected task button
- `aria-label` on lock badge
- `dateTime` attribute on time element

### Empty State

When `tasks.length === 0`, displays "No tasks yet. Create your first task to get started!"

---

## CreateTaskModal

**File**: `src/components/CreateTaskModal/CreateTaskModal.tsx`

Modal dialog for creating new tasks with title input and confirm/cancel actions.

### Purpose

Provides a focused interface for task creation with validation and error handling.

### Props Interface

```typescript
interface CreateTaskModalProps {
  open: boolean;                        // Whether modal is visible
  onClose: () => void;                  // Close callback
  onSuccess?: (task: { id: string; title: string }) => void;  // Success callback
}
```

### Usage Example

```tsx
import { CreateTaskModal } from './components/CreateTaskModal';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const { refetch } = useTasks();

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Create Task</button>
      <CreateTaskModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => refetch()}
      />
    </>
  );
}
```

### Dependencies

- `useCreateTask` hook from `src/hooks/useCreateTask.ts`
- `useFocusTrap` hook from `src/hooks/useFocusTrap.ts`
- CSS: `src/components/CreateTaskModal/CreateTaskModal.css`

### Accessibility Notes

- `role="dialog"` and `aria-modal="true"`
- Focus trap keeps Tab navigation within modal
- Escape key closes modal
- Enter key submits form (when input has content)
- `aria-invalid` and `aria-describedby` for error messages

### Validation

- Title must not be empty (trimmed)
- Maximum length: 200 characters
- Shows character count (X/200)

---

## NewTaskButton

**File**: `src/components/NewTaskButton/NewTaskButton.tsx`

Floating Action Button (FAB) positioned in bottom-right corner for creating tasks.

### Purpose

Provide a prominent, always-accessible trigger for task creation following Material Design FAB pattern.

### Props Interface

```typescript
interface NewTaskButtonProps {
  onClick?: () => void;       // Click handler
  disabled?: boolean;         // Default: false
  ariaLabel?: string;         // Default: "Create new task"
  className?: string;         // Additional CSS classes
}
```

### Usage Example

```tsx
import { NewTaskButton } from './components/NewTaskButton';

function App() {
  return (
    <NewTaskButton
      onClick={() => setShowModal(true)}
      ariaLabel="Add a new task"
    />
  );
}
```

### Dependencies

- CSS: `src/components/NewTaskButton/NewTaskButton.css`

### Accessibility Notes

- `aria-label` for screen readers
- 44x44px minimum touch target (WCAG 2.1 AA compliant)
- `focus-visible` styles for keyboard navigation
- `aria-disabled` attribute when disabled

### Visual Features

- Plus (+) icon rotates on hover
- Scale animation on click
- Circular elevation shadow

---

## ErrorBoundary

**File**: `src/components/ErrorBoundary/ErrorBoundary.tsx`

React class component that catches JavaScript errors in child component trees.

### Purpose

Prevent entire app from crashing due to component errors; display fallback UI instead.

### Props Interface

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;                                  // Custom fallback UI
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}
```

### Usage Example

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong</div>}
      onError={(error, errorInfo) => console.error(error)}
    >
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### Dependencies

- CSS: `src/components/ErrorBoundary/ErrorBoundary.css`

### Accessibility Notes

- `role="alert"` and `aria-live="assertive"` on error container
- Keyboard-accessible reset button

### Default Fallback UI

```
Something went wrong
An unexpected error occurred. Please refresh the page to try again.

[Error details] (expandable)
[Try again] button
```

---

## Toast / ToastContainer

**File**: `src/components/Toast/Toast.tsx`, `src/components/Toast/ToastContainer.tsx`

Transient notification system for success, error, and info messages.

### Purpose

Display non-blocking notifications to users with auto-dismiss capability.

### Toast Props Interface

```typescript
interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;           // Auto-dismiss duration (0 = no auto-close)
  onDismiss: (id: string) => void;
}
```

### ToastContainer Props Interface

```typescript
interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

interface ToastItem {
  id: string;
  type: ToastProps['type'];
  message: string;
}
```

### Usage Example

```tsx
import { Toast, ToastContainer } from './components/Toast';

function App() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastProps['type']) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  return (
    <ToastContainer
      toasts={toasts}
      onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
    />
  );
}
```

### Dependencies

- CSS: `src/components/Toast/Toast.css`

### Accessibility Notes

- `role="alert"` for error toasts, `role="status"` for others
- `aria-live="polite"` for respectful announcements
- Close button has `aria-label="Dismiss notification"`

### Icons

- Success: ✓
- Error: ✕
- Info: ℹ

---

## Skeleton

**File**: `src/components/Skeleton/Skeleton.tsx`

Loading placeholder with shimmer animation for content that is being fetched.

### Purpose

Provide visual feedback that content is loading, improving perceived performance.

### Props Interface

```typescript
interface SkeletonProps {
  className?: string;
  width?: string;              // CSS width value
  height?: string;             // CSS height value
  lines?: number;              // Number of text lines (for text variant)
  animate?: boolean;           // Default: true
  variant?: 'text' | 'circle' | 'rect';  // Default: 'text'
}
```

### Usage Example

```tsx
import { Skeleton } from './components/Skeleton';

// Single line text
<Skeleton />

// Multiple lines
<Skeleton lines={3} />

// Circle avatar
<Skeleton variant="circle" width={40} height={40} />

// Rectangular image
<Skeleton variant="rect" width="100%" height={200} />
```

### Dependencies

- CSS: `src/components/Skeleton/Skeleton.css`

### Accessibility Notes

- `aria-hidden="true"` (screen readers ignore loading placeholders)

---

## EditorCore

**File**: `src/components/Editor/EditorCore.tsx`

Main editor component integrating Milkdown, ProseMirror, and Lock Enforcement.

### Purpose

Provide a rich Markdown editing experience with AI intervention and un-deletable content blocks.

### Props Interface

```typescript
interface EditorCoreProps {
  initialContent?: string;                    // Initial Markdown
  mode?: AgentMode;                           // 'off' | 'muse' | 'loki'
  onChange?: (markdown: string, lockIds: string[]) => void;
  onReady?: (editor: Editor) => void;         // Editor initialization callback
  initialLocks?: string[];                    // Pre-existing lock IDs
  externalTrigger?: AIActionType | null;      // Manual intervention trigger
  onTriggerProcessed?: () => void;            // Trigger acknowledgment
  onTimerUpdate?: (remainingSeconds: number) => void;  // Muse countdown
  onInterventionError?: (error: Error) => void;  // API error surface
}
```

### Usage Example

```tsx
import { EditorCore } from './components/Editor';

function TaskEditor() {
  const [content, setContent] = useState('');
  const [locks, setLocks] = useState<string[]>([]);

  return (
    <EditorCore
      initialContent={content}
      mode="muse"
      onChange={(markdown, lockIds) => {
        setContent(markdown);
        setLocks(lockIds);
      }}
      onReady={(editor) => console.log('Editor ready', editor)}
      onTimerUpdate={(seconds) => console.log(`${seconds}s until stuck`)}
    />
  );
}
```

### Dependencies

- `@milkdown/core`, `@milkdown/react`, `@milkdown/theme-nord`, `@milkdown/preset-commonmark`
- `@floating-ui/dom` for toolbar positioning
- `LockManagerContext` for lock state management
- `useWritingState` for STUCK detection
- `useLokiTimer` for chaos timing
- `SensoryFeedback` for visual/audio feedback
- `FloatingToolbar` / `BottomDockedToolbar` for formatting

### Lock Enforcement

AI-added content is prevented from deletion via ProseMirror transaction filter:

```typescript
filterTransaction: (tr, state) => {
  if (violatesLocks(tr, state)) {
    showSensoryFeedback(AIActionType.REJECT);
    return false;  // Block deletion
  }
  return true;
}
```

### Test Helpers

Exposes `window.lockManager`, `window.editorInstance`, `window.insertLockedContentForTest` for E2E testing.

---

## FloatingToolbar

**File**: `src/components/Editor/FloatingToolbar.tsx`

Context-sensitive formatting toolbar that appears when text is selected.

### Purpose

Provide quick access to Markdown formatting commands without keyboard shortcuts.

### Props Interface

```typescript
interface FloatingToolbarProps {
  editor: Editor | null;      // Milkdown editor instance
  className?: string;
  zIndex?: number;            // Default: 1000
}
```

### Usage Example

```tsx
import { FloatingToolbar } from './components/Editor/FloatingToolbar';

function Editor() {
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <>
      <MilkdownEditor onReady={setEditor} />
      <FloatingToolbar editor={editor} />
    </>
  );
}
```

### Dependencies

- `@milkdown/core`, `@milkdown/preset-commonmark`
- `@floating-ui/dom` for positioning
- `prosemirror-helpers` for state detection

### Buttons

| Button | Command | aria-label |
|--------|---------|------------|
| **B** | Toggle strong | "Bold" |
| *I* | Toggle emphasis | "Italic" |
| H1 | Wrap in heading 1 | "Heading 1" |
| H2 | Wrap in heading 2 | "Heading 2" |
| • | Toggle bullet list | "Bullet list" |

### Accessibility Notes

- `role="toolbar"` with `aria-label="Formatting toolbar"`
- `aria-pressed` on each button reflects current state
- 44x44px minimum touch targets
- `onMouseDown` with `preventDefault()` preserves text selection

### Positioning

- Uses `@floating-ui/dom` for dynamic positioning
- Appears 8px above selection
- Flips to bottom if insufficient space above
- Shifts horizontally to stay within viewport

---

## BottomDockedToolbar

**File**: `src/components/Editor/BottomDockedToolbar.tsx`

Mobile-optimized toolbar docked at bottom of screen.

### Purpose

Provide formatting access on mobile devices where floating toolbar has UX issues.

### Props Interface

```typescript
interface BottomDockedToolbarProps {
  editor: Editor | null;
}
```

### Usage Example

```tsx
import { BottomDockedToolbar } from './components/Editor/BottomDockedToolbar';
import { useMediaQuery } from './hooks/useMediaQuery';

function Editor() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <>
      <MilkdownEditor onReady={setEditor} />
      {isMobile ? <BottomDockedToolbar editor={editor} /> : <FloatingToolbar editor={editor} />}
    </>
  );
}
```

### Accessibility Notes

- Same buttons as FloatingToolbar
- Fixed positioning at bottom of viewport
- Larger touch targets for mobile

---

## WelcomeModal

**File**: `src/components/WelcomeModal.tsx`

Onboarding modal explaining Impetus Lock's core concepts and AI modes.

### Purpose

Educate new users about Muse mode, Loki mode, and the Lock concept.

### Props Interface

```typescript
interface WelcomeModalProps {
  forceShow?: boolean;        // Re-open modal (for testing)
  onDismiss?: () => void;     // Close callback
}
```

### Usage Example

```tsx
import { WelcomeModal } from './components/WelcomeModal';

function App() {
  // Auto-shows on first visit (localStorage check)
  return <WelcomeModal />;
}
```

### Dependencies

- CSS: `src/components/WelcomeModal.css`
- localStorage key: `impetus-lock-welcome-dismissed`

### Sections

1. **Muse Mode** (RECOMMENDED): 60s idle trigger + manual button
2. **Loki Mode**: Random chaos intervals
3. **Lock Concept**: AI content cannot be deleted

### Accessibility Notes

- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby="welcome-title"`
- Escape key closes modal
- Click outside closes modal
- "Don't show this again" checkbox persists to localStorage

### Keyboard Shortcut

Press `?` key anytime to re-open the modal.

---

## ManualTriggerButton

**File**: `src/components/ManualTriggerButton.tsx`

Button to manually trigger AI intervention (Muse mode only).

### Purpose

Allow users to request AI help immediately without waiting for 60-second STUCK timeout.

### Props Interface

```typescript
interface ManualTriggerButtonProps {
  mode: AgentMode;             // Current agent mode
  onTrigger?: (actionType: AIActionType) => void;  // Feedback callback
}
```

### Usage Example

```tsx
import { ManualTriggerButton } from './components/ManualTriggerButton';

function App() {
  const [mode, setMode] = useState<AgentMode>('muse');

  return (
    <ManualTriggerButton
      mode={mode}
      onTrigger={(action) => console.log('Triggered:', action)}
    />
  );
}
```

### Dependencies

- `useManualTrigger` hook from `src/hooks/useManualTrigger.ts`
- `AIActionType` from `src/types/ai-actions.ts`

### Behavior

| Mode | Button State |
|------|-------------|
| `muse` | Enabled, clickable |
| `loki` | Disabled (Loki is random-only) |
| `off` | Disabled |

### Dev-Only Buttons

- **Summon Loki (dev)**: Manually trigger Loki chaos
- **Test Delete**: Test DELETE sensory feedback (fade + whoosh)

### Accessibility Notes

- `aria-label="I'm stuck! Trigger AI assistance"`
- `disabled` attribute reflects mode
- `data-loading` during API request
- 2-second debounce prevents rapid-fire requests

---

## TimerIndicator

**File**: `src/components/TimerIndicator.tsx`

Countdown timer showing seconds until STUCK state (Muse mode).

### Purpose

Provide visual feedback of impending Muse intervention.

### Props Interface

```typescript
interface TimerIndicatorProps {
  remainingSeconds: number;    // Seconds until STUCK (0-60)
}
```

### Usage Example

```tsx
import { TimerIndicator } from './components/TimerIndicator';

function Editor() {
  const [seconds, setSeconds] = useState(60);

  return (
    <EditorCore
      mode="muse"
      onTimerUpdate={setSeconds}
    />
    {seconds < 60 && <TimerIndicator remainingSeconds={seconds} />}
  );
}
```

### Visual Feedback

- 60-30s: Not visible
- 29-10s: Gray countdown
- 9-1s: Orange/red urgency
- 0s: STUCK state triggered

---

## SensoryFeedback

**File**: `src/components/SensoryFeedback.tsx`

Combines Framer Motion animations with Web Audio API sounds for immersive feedback.

### Purpose

Provide clear visual and audio feedback for AI actions (DELETE, REJECT, PROVOKE, REWRITE, ERROR).

### Props Interface

```typescript
interface SensoryFeedbackProps {
  actionType: AIActionType | null;  // Current action to animate
}
```

### Usage Example

```tsx
import { SensoryFeedback } from './components/SensoryFeedback';

function App() {
  const [action, setAction] = useState<AIActionType | null>(null);

  return (
    <>
      <Button onClick={() => setAction(AIActionType.DELETE)} />
      <SensoryFeedback actionType={action} />
    </>
  );
}
```

### Actions

| Action | Animation | Sound | File |
|--------|-----------|-------|------|
| DELETE | Fade out (whoosh) | whoosh.mp3 | 18.4 KB |
| REJECT | Shake (bonk) | bonk.mp3 | ~10 KB |
| PROVOKE | Glitch (clank) | clank.mp3 | 28.8 KB |
| REWRITE | Typing effect | (none) | - |
| ERROR | Red flash + buzz | (generated) | - |

### Dependencies

- `framer-motion` for animations
- Web Audio API for sound playback
- CSS: `src/components/SensoryFeedback.css`

### Audio Files

Located in `src/assets/audio/`:
- `whoosh.mp3`: Delete action sound
- `bonk.mp3`: Lock rejection sound
- `clank.mp3`: Provoke action sound

### Browser Compatibility

Web Audio API requires user interaction before first playback. SensoryFeedback handles this automatically on first trigger.

---

## Related Documentation

- [Client README](../../client/README.md) - Frontend development guide
- [Troubleshooting Guide](../guides/troubleshooting.md) - Common issues
- [CLAUDE.md](../../CLAUDE.md) - Project constitution
