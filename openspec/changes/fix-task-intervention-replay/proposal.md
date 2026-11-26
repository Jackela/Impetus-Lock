# Change: Replay task interventions across server processes

**Status** — Approved and implemented on 2026-11-26. The owner approved the reversible PostgreSQL receipt table and requested verification of independent-worker concurrency, expiry, and compatibility with existing data. The production rollout remains a separate step.

## Why

The [Web intervention contract](../../../API_CONTRACT.md#-幂等性设计--idempotency-design) specifies that a repeat within 15 seconds returns the first successful response without side effects. Each server process currently owns a separate cache. A reproduction with valid account cookies and CSRF, two independent caches and a shared PostgreSQL database returned two action IDs for the same key. The database contained two history entries and the writer's intervention count increased twice.

## Behavior

For an authenticated, task-associated request backed by PostgreSQL, a retry within the existing window returns the same committed action, response, and applicable headers after rechecking ownership. Successful action history, statistics, and the replay receipt commit together. A failed first request leaves no completed receipt, and retry after expiry begins a new intervention under the existing contract.

The request path, headers, response fields and version stay the same. Requests without a persisted task keep their existing process-local behavior. Middleware, contract-version and ownership checks still apply on retries.

## Storage

Add a small receipt table containing the account and task references, a bounded digest of the scoped request key, the committed action reference and the replay expiry. PostgreSQL serializes concurrent processing of this key across workers. The worker that waited checks the receipt again after acquiring the lock. Write the receipt just before committing the action, counters and achievements in the same transaction. Reconstruct the wire response from the action history and derive the Loki cooldown header from the original key as the API already does.

The receipt stores no raw request key, BYOK credentials, cookies, CSRF tokens, request body or second copy of the draft. Use an expiry index to make bounded cleanup cheap. The receipt is ineligible for replay after the published window even if cleanup has yet to remove it. Task or account deletion removes its receipts along with its action history.

PostgreSQL is already needed for committing task-associated actions. When it cannot commit, return an existing database failure outcome and publish no replayable success. The in-memory test fallback and taskless requests keep their previous behavior. The change introduces no dependency on Redis for recording or replaying task-associated actions.

The alternative of putting receipts in Redis requires a separate protocol to reconcile Redis and PostgreSQL after a failure between their writes. Putting the key into the client-visible action ID changes what existing clients and operators see in history. The proposed receipt preserves both the PostgreSQL transaction and the action ID.

## Compatibility and rollback

Apply the additive migration before enabling the new code, then roll all API workers to the new version to obtain the shared replay guarantee. During a mixed-version rollout, older workers continue to use their process-local cache. An application rollback can leave the receipt table in place. A database rollback, after the old application is restored, drops only temporary receipts. Existing drafts, lock IDs, action history, counters and achievements do not require rewriting.

## Impact

- Affected spec is `agentic-interventions`.
- The implementation covers the Web intervention transaction, PostgreSQL receipt persistence, and independent-worker integration tests.
