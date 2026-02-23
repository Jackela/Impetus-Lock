# Utils Module

This directory contains utility functions for the Impetus Lock application.

## Structure

```
utils/
├── contextExtractor.ts         # Extract context from editor content
├── index.ts                    # Barrel exports
├── logger.ts                   # Structured logging utility
├── prosemirror-helpers.ts      # ProseMirror editor utilities
├── README.md                   # This file
└── textRange.ts                # Text range operations
```

## Utilities

### contextExtractor

Extracts the last N sentences from editor content for AI context.

```typescript
import { extractLastSentences } from "../utils/contextExtractor";

const context = extractLastSentences(content, 3);
```

### logger

Structured logging with namespaced loggers.

```typescript
import { createLogger } from "../utils/logger";

const logger = createLogger("ComponentName");
logger.info("Operation completed", { detail: "value" });
```

### prosemirror-helpers

Utilities for working with ProseMirror editor state.

```typescript
import { hasMark, getHeadingLevel, isInBulletList } from "../utils/prosemirror-helpers";

const isBold = hasMark(state, "strong");
const headingLevel = getHeadingLevel(state);
```

### textRange

Text range operations for editor content.

```typescript
import { getLastSentenceRange } from "../utils/textRange";

const range = getLastSentenceRange(editorState);
```

## Guidelines

1. **Pure Functions**: Utilities should be pure when possible
2. **No Side Effects**: Avoid mutating input parameters
3. **Well Tested**: All utilities must have unit tests
4. **Documented**: JSDoc comments for all public functions
5. **Reusable**: Design for reuse across the application

## Adding New Utilities

1. Create the utility file
2. Add comprehensive tests
3. Export from `index.ts`
4. Update this README
