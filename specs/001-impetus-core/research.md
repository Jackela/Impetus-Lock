# Phase 0: Research & Technology Decisions

**Feature**: Impetus Lock Core - Agent Intervention System  
**Date**: 2025-11-06  
**Status**: ✅ Complete

---

## Overview

This document records all technology decisions and research findings for implementing the core "un-deletable constraint" mechanism and Agent intervention system.

---

## 1. Editor Selection: Milkdown (ProseMirror-based)

### Decision
Use **Milkdown** (^7.x) as the primary rich text editor framework.

### Rationale
- **Core Requirement**: Must support **transaction-level interception** to implement un-deletable locks (FR-002)
- **Milkdown provides**:
  - Built on ProseMirror (battle-tested editor kernel used by Notion, Atlassian)
  - Native `filterTransaction` API for blocking delete operations at transaction level
  - Markdown-first design aligns with Assumption #3 (blockquote format)
  - TypeScript-native with excellent type safety
  - React integration via `@milkdown/react` package

### Alternatives Considered

| Editor | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| **Slate.js** | React-first, flexible | No native transaction filtering; delete blocking requires DOM-level hacks | Cannot reliably prevent Undo (FR-004) |
| **Quill** | Simple API, lightweight | Delta-based (not Markdown); no transaction layer access | Lock enforcement would be DOM-based (violates Constraint: "editor kernel layer") |
| **TipTap** | Vue-friendly, ProseMirror-based | Good alternative, but Milkdown has better Markdown support | Milkdown more idiomatic for Markdown blockquotes |
| **Monaco Editor** | VS Code's editor | Heavyweight (2MB+), code-focused not prose | Overkill for creative writing use case |

### Implementation Details
- **Package**: `@milkdown/core`, `@milkdown/react`, `@milkdown/preset-commonmark`
- **Lock Enforcement Strategy**:
  ```typescript
  editor.use(
    $view.create(() => ({
      filterTransaction: (tr: Transaction) => {
        // Detect delete attempts on nodes with lock_id attribute
        const deletesLockedNode = tr.steps.some(step =>
          step instanceof ReplaceStep && 
          affectsLockedNode(step, doc)
        );
        
        if (deletesLockedNode) {
          // Block transaction + trigger feedback
          triggerShakeAnimation();
          playBonkSound();
          return false; // Transaction rejected
        }
        return true; // Allow transaction
      }
    }))
  );
  ```
- **Undo Bypass**: AI "Delete" actions will manually manipulate ProseMirror state without creating Undo history:
  ```typescript
  const newState = view.state.apply(
    tr.setMeta('addToHistory', false) // Skip Undo stack
  );
  ```

### References
- Milkdown Docs: https://milkdown.dev/docs/guide/getting-started
- ProseMirror Transaction Guide: https://prosemirror.net/docs/guide/#transform

---

## 2. Backend AI Integration: Instructor + Pydantic

### Decision
Use **Instructor** (^1.4.0) library for strongly-typed LLM outputs.

### Rationale
- **Core Requirement**: Backend must return structured `InterventionResponse` (FR-017)
- **Problem with raw LLM**: OpenAI/Anthropic APIs return untyped JSON strings → error-prone parsing
- **Instructor solution**:
  - Wraps OpenAI/Anthropic clients
  - Uses Pydantic models as "function calling" schemas
  - **Guarantees** valid Pydantic object or raises exception (no string parsing)
  - Retry logic built-in for malformed LLM responses
  
### Example Usage
```python
from instructor import from_openai
from pydantic import BaseModel
from openai import OpenAI

client = from_openai(OpenAI(api_key=os.getenv("OPENAI_API_KEY")))

class InterventionResponse(BaseModel):
    action: Literal["provoke", "delete"]
    content: str | None
    lock_id: str | None
    anchor: dict | None

# LLM response auto-validated against Pydantic schema
response: InterventionResponse = client.chat.completions.create(
    model="gpt-4",
    response_model=InterventionResponse,
    messages=[{
        "role": "system",
        "content": "You are a creative pressure agent..."
    }]
)

# response is GUARANTEED to be valid InterventionResponse
assert isinstance(response, InterventionResponse)
```

### Alternatives Considered

| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| **Raw OpenAI API** | Direct control | Manual JSON parsing, no type safety | High risk of runtime errors (violates Article I: Simplicity) |
| **LangChain** | Comprehensive framework | Heavy (100+ dependencies), slow iteration | Over-engineered for MVP (violates Article I) |
| **Marvin** | Similar to Instructor | Less mature, smaller community | Instructor more battle-tested |
| **Manual Pydantic parsing** | No extra library | Must write retry logic, error handling | Reinventing wheel (Instructor already solves this) |

### Implementation Details
- **Dependency Injection (DIP compliance)**:
  ```python
  # Protocol (abstraction)
  class LLMProvider(Protocol):
      def generate_intervention(self, context: str, mode: str) -> InterventionResponse:
          ...
  
  # Concrete implementation
  class InstructorLLMProvider:
      def __init__(self, api_key: str):
          self.client = from_openai(OpenAI(api_key=api_key))
      
      def generate_intervention(self, context: str, mode: str) -> InterventionResponse:
          return self.client.chat.completions.create(...)
  
  # Service uses abstraction
  class InterventionService:
      def __init__(self, llm: LLMProvider):  # Constructor injection
          self.llm = llm
  ```

### References
- Instructor GitHub: https://github.com/jxnl/instructor
- Pydantic Docs: https://docs.pydantic.dev/latest/

---

## 3. Animation Library: Framer Motion

### Decision
Use **Framer Motion** (^11.x) for P2 visual feedback animations.

### Rationale
- **Core Requirement**: Glitch/Shake/Whoosh animations (FR-023, FR-024, FR-025)
- **Constraint**: ≥30 FPS on low-end devices (Intel Core i3, 4GB RAM) (FR-027)
- **Framer Motion provides**:
  - GPU-accelerated transforms (uses CSS `transform` under the hood)
  - Declarative animation API (easier to maintain than manual CSS keyframes)
  - Spring physics for natural motion
  - React-first design (hooks-based)
  
### Example Usage
```typescript
import { motion } from 'framer-motion';

const ShakeAnimation = () => (
  <motion.div
    animate={{
      x: [0, -10, 10, -10, 10, 0], // Shake left-right
      transition: { duration: 0.3 } // 300ms total
    }}
  >
    {lockedBlock}
  </motion.div>
);
```

### Alternatives Considered

| Library | Pros | Cons | Rejected Because |
|---------|------|------|------------------|
| **React Spring** | Physics-based, performant | More complex API, steeper learning curve | Framer Motion more idiomatic for React |
| **GSAP** | Industry standard, most powerful | Not React-native, imperative API | Harder to integrate with React state |
| **CSS Animations** | Zero bundle size | Manual keyframes, no spring physics | More code to maintain (violates Article I) |
| **Anime.js** | Lightweight, simple | Not React-optimized | Framer Motion better React integration |

### Performance Notes
- **GPU Acceleration**: Framer Motion uses `transform` and `opacity` (GPU-accelerated properties)
- **Bundle Size**: ~40KB gzipped (acceptable for P2 feature)
- **Lazy Loading**: Animations loaded async (P2 non-critical path)

### References
- Framer Motion Docs: https://www.framer.com/motion/

---

## 4. State Machine Implementation: Custom React Hook

### Decision
Implement state machine using **custom React hook** with `useState` + `useEffect`.

### Rationale
- **Core Requirement**: Track WRITING/IDLE/STUCK states (FR-006)
- **Simplicity (Article I)**: State machine logic is simple (3 states, 2 timers)
- **No library needed**: XState/Zustand overkill for linear state transitions
- **React-native**: Hooks integrate seamlessly with React component lifecycle

### Implementation Sketch
```typescript
type WritingState = 'WRITING' | 'IDLE' | 'STUCK';

export function useWritingState(mode: 'muse' | 'loki' | 'off') {
  const [state, setState] = useState<WritingState>('IDLE');
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  
  useEffect(() => {
    if (mode === 'off') return;
    
    const checkInterval = setInterval(() => {
      const idleTime = Date.now() - lastInputTime;
      
      if (idleTime < 5000) {
        setState('WRITING');
      } else if (idleTime < 60000) {
        setState('IDLE');
      } else {
        setState('STUCK');
        if (mode === 'muse') {
          triggerMuseIntervention(); // Call backend API
        }
      }
    }, 1000); // Check every second
    
    return () => clearInterval(checkInterval);
  }, [lastInputTime, mode]);
  
  const onInput = () => setLastInputTime(Date.now());
  
  return { state, onInput };
}
```

### Alternatives Considered

| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| **XState** | Formal FSM, visualizations | Heavy library, over-engineered for 3 states | Violates Article I (Simplicity) |
| **Zustand** | Global state management | Unnecessary for component-local state | Over-abstraction for MVP |
| **Redux Toolkit** | Industry standard | 10x more code than needed | Massive overkill (violates Article I) |

---

## 5. Audio Playback: Native Web Audio API

### Decision
Use **native `new Audio()`** for P2 sound effects.

### Rationale
- **Core Requirement**: Play Clank/Bonk/Whoosh sounds (FR-023, FR-024, FR-025)
- **Constraint**: Audio files <50KB (Assumption #6)
- **Simplicity**: No library needed for simple playback
- **Performance**: Preload audio files on mount, instant playback

### Implementation Sketch
```typescript
class AudioPlayer {
  private sounds: Map<string, HTMLAudioElement>;
  
  constructor() {
    this.sounds = new Map([
      ['clank', new Audio('/audio/clank.mp3')],
      ['bonk', new Audio('/audio/bonk.mp3')],
      ['whoosh', new Audio('/audio/whoosh.mp3')]
    ]);
    
    // Preload all sounds
    this.sounds.forEach(audio => audio.load());
  }
  
  play(soundName: string) {
    const audio = this.sounds.get(soundName);
    if (audio) {
      audio.currentTime = 0; // Reset to start
      audio.play().catch(e => console.warn('Audio blocked:', e));
    }
  }
}
```

### Alternatives Considered

| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| **Howler.js** | Cross-browser compat, sprite support | 9KB library for simple playback | Unnecessary abstraction (Article I) |
| **Tone.js** | Music synthesis, effects | 100KB+, designed for music production | Massive overkill |

### Audio Sources
- **Freesound.org**: CC0 licensed sounds
- **Format**: MP3 (best browser compat), <50KB per file
- **Suggested search terms**: "lock click", "bonk", "whoosh swipe"

---

## 6. API Client: Native `fetch` with TypeScript

### Decision
Use **native `fetch` API** with TypeScript types generated from OpenAPI spec.

### Rationale
- **Core Requirement**: Call `/api/v1/impetus/generate-intervention` (FR-016, FR-017)
- **Simplicity**: No HTTP library needed (axios/ky adds 10KB+ for no benefit)
- **Type Safety**: Generate TypeScript types from OpenAPI spec using `openapi-typescript`
- **Idempotency**: Easy to add custom headers (Idempotency-Key)

### Implementation Sketch
```typescript
import type { paths } from './generated/api'; // Auto-generated from OpenAPI

type InterventionRequest = paths['/api/v1/impetus/generate-intervention']['post']['requestBody']['content']['application/json'];
type InterventionResponse = paths['/api/v1/impetus/generate-intervention']['post']['responses']['200']['content']['application/json'];

export async function callIntervention(
  req: InterventionRequest
): Promise<InterventionResponse> {
  const idempotencyKey = crypto.randomUUID();
  
  const response = await fetch('/api/v1/impetus/generate-intervention', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Contract-Version': '1.0.1'
    },
    body: JSON.stringify(req)
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}
```

### Tooling: `openapi-typescript`
```bash
# Generate TypeScript types from OpenAPI spec
npx openapi-typescript specs/001-impetus-core/contracts/intervention.yaml -o client/src/types/api.generated.ts
```

### Alternatives Considered

| Library | Pros | Cons | Rejected Because |
|---------|------|------|------------------|
| **Axios** | Interceptors, retries | 13KB, unnecessary for simple POST | Violates Article I (Simplicity) |
| **Ky** | Modern API, retries | 5KB, still adds complexity | Native fetch sufficient |
| **tRPC** | End-to-end type safety | Requires backend changes, heavy | Over-engineered for REST API |

---

## 7. Lock Persistence: localStorage + Markdown Comments

### Decision
Store `lock_id` using **HTML comments in Markdown** + `localStorage` backup.

### Rationale
- **Core Requirement**: Lock survives page refresh (FR-005)
- **Approach**:
  - Embed lock_id in Markdown: `> [AI施压]: 内容 <!-- lock:550e8400-e29b-41d4-a716-446655440000 -->`
  - Parse comments on document load → re-apply locks
  - Backup in `localStorage` for non-Markdown editors
  
### Implementation Sketch
```typescript
// Inject lock with Markdown comment
function injectLockedBlock(content: string, lockId: string): string {
  return `${content} <!-- lock:${lockId} -->`;
}

// Parse locks on document load
function extractLocks(markdown: string): Set<string> {
  const lockRegex = /<!-- lock:([\w-]+) -->/g;
  const locks = new Set<string>();
  
  let match;
  while ((match = lockRegex.exec(markdown)) !== null) {
    locks.add(match[1]);
  }
  
  return locks;
}

// Re-apply locks to ProseMirror nodes
function reapplyLocksOnLoad(doc: Node, lockIds: Set<string>) {
  doc.descendants((node, pos) => {
    // Check if node contains a lock comment
    const lockId = extractLockFromNode(node);
    if (lockId && lockIds.has(lockId)) {
      // Mark node as locked in ProseMirror state
      markAsLocked(node, lockId);
    }
  });
}
```

### Alternatives Considered

| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| **localStorage only** | Simple | Loses locks if user copies Markdown elsewhere | Not portable across devices/editors |
| **Custom JSON format** | Structured | Not Markdown-compatible | Breaks interoperability (users can't edit in VS Code) |
| **Backend storage** | Centralized | Requires database, accounts | Violates P1 stateless constraint |

---

## 8. Random Timer: Web Crypto API

### Decision
Use **`crypto.getRandomValues()`** for cryptographically secure random intervals.

### Rationale
- **Core Requirement**: Loki triggers at random 30-120s intervals (FR-011)
- **Success Criterion**: Distribution must be uniform (SC-004)
- **`Math.random()` problem**: Not cryptographically secure, might have bias
- **`crypto.getRandomValues()`**: Guaranteed uniform distribution

### Implementation Sketch
```typescript
function getRandomInterval(min: number, max: number): number {
  const range = max - min;
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  
  // Map to range [min, max]
  return min + (randomBytes[0] / (0xFFFFFFFF + 1)) * range;
}

function scheduleNextLokiIntervention() {
  const delay = getRandomInterval(30000, 120000); // 30-120 seconds
  
  setTimeout(() => {
    triggerLokiIntervention();
    scheduleNextLokiIntervention(); // Recursive re-schedule
  }, delay);
}
```

---

## Summary: Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Frontend Editor** | Milkdown | ^7.x | ProseMirror-based, `filterTransaction` API |
| **Frontend Framework** | React | 18.x | Existing project choice |
| **Build Tool** | Vite | 5.x | Fast HMR, existing project choice |
| **Backend Framework** | FastAPI | ^0.115.0 | Existing project choice |
| **AI Integration** | Instructor | ^1.4.0 | Strongly-typed LLM outputs (Pydantic) |
| **Animations (P2)** | Framer Motion | ^11.x | GPU-accelerated, React-native API |
| **Testing (Frontend)** | Vitest + Playwright | Latest | Unit + E2E, existing project choice |
| **Testing (Backend)** | pytest + httpx | Latest | FastAPI TestClient, existing choice |
| **Type Generation** | openapi-typescript | Latest | Auto-gen TypeScript from OpenAPI spec |
| **State Management** | React hooks | Native | Simple 3-state machine, no library needed |
| **Audio Playback** | Web Audio API | Native | <50KB assets, no library needed |
| **HTTP Client** | fetch | Native | Simple POST, no library needed |
| **Persistence** | Markdown comments | Native | Portable, no backend required |
| **Random Generation** | Web Crypto API | Native | Uniform distribution guarantee |

**Total Bundle Size Estimate**:
- Milkdown + ProseMirror: ~150KB gzipped
- React + Vite runtime: ~50KB gzipped
- Framer Motion (P2): ~40KB gzipped
- **Total Frontend**: ~240KB gzipped (well within budget)

**Backend Dependencies**: Minimal (FastAPI + Instructor + Pydantic already in project)

---

**Status**: ✅ All technology decisions finalized  
**Next Phase**: Phase 1 - Data Model & Contracts
