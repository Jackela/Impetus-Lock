# Services Module

This directory contains service layer modules for the Impetus Lock application.

## Structure

```
services/
├── api/
│   ├── interventionClient.ts   # AI intervention API client
│   └── taskClient.ts           # Task API client
├── ContentInjector.ts          # Editor content injection
├── index.ts                    # Barrel exports
├── llmConfigStore.ts           # LLM config persistence
├── llmKeyVault.ts              # Secure key storage
├── LockManager.ts              # Lock state management
├── README.md                   # This file
└── telemetry.ts                # Analytics service
```

## API Clients

### interventionClient

Handles AI intervention requests to the backend.

```typescript
import { triggerMuseIntervention, triggerLokiIntervention } from "../services/api/interventionClient";

const response = await triggerMuseIntervention(context, cursorPosition, docVersion);
```

### taskClient

Handles task CRUD operations.

```typescript
import { taskClient } from "../services/api/taskClient";

const tasks = await taskClient.listTasks();
```

## Core Services

### LockManager

Manages lock state and enforces lock constraints.

```typescript
import { lockManager } from "../services/LockManager";

lockManager.applyLock(lockId);
const locks = lockManager.getAllLocks();
```

### ContentInjector

Injects locked content into the editor.

```typescript
import { injectLockedBlock, deleteContentAtAnchor } from "../services/ContentInjector";

injectLockedBlock(view, content, lockId, anchor, source);
```

## Guidelines

1. **API Separation**: Keep API clients separate from business logic
2. **Error Handling**: Use custom error types from `types/errors`
3. **No UI Logic**: Services should not import React or components
4. **Testable**: Services should be easily testable with mocks
5. **Typed**: Full TypeScript coverage for all public functions

## Adding New Services

1. Create the service file
2. Add tests in `servicename.test.ts`
3. Export from `index.ts` if public
4. Update this README
