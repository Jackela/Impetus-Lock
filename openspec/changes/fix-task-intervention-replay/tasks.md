## 1. Approval and reproduction

- [x] Approve the receipt table, 15-second replay retention policy and rollout approach.
- [x] Promote the recorded cross-worker failure into the PostgreSQL API suite and check it fails against the pre-fix implementation.

## 2. Implementation

- [x] Add a reversible PostgreSQL migration for the receipt, its uniqueness, expiry index and cascading references.
- [x] Serialize only identical owned task request keys. Check for a committed and unexpired receipt after waiting, before invoking the provider.
- [x] Commit the receipt with the intervention action, statistics and any achievement. Reconstruct the existing response and cooldown header during replay.
- [x] Clean up expired receipts in bounded batches. Preserve a fresh request after expiry, existing middleware and fallback behavior, and omit credentials and request bodies from the receipt.

## 3. Validation

- [x] Exercise sequential and simultaneous requests through two independent FastAPI applications against the same PostgreSQL database using real cookies and CSRF. Verify identical responses, one provider invocation, one action and one increment.
- [x] Check different account/task/key isolation, current authorization, retry after expiry, absent or failed commits, and a fresh application handling replay after another application's successful commit.
- [x] Check migration upgrade/downgrade with existing drafts and history and the existing taskless API path.
- [x] Document the mixed-worker rollout behavior and the scope of provider verification.
