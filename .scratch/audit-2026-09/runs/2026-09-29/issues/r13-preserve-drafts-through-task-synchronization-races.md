# R13: Preserve drafts through task synchronization races

Tier: 2. Findings: F06,F07,F08. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R03

## Allowed scope

client/src/hooks/useTaskSync.ts; its focused tests; minimal existing task sync error/UI message wiring only if necessary

## Pre-approved test seam

Real hook with controlled fetch/deferred promises/timers/storage; root StrictMode.

## Acceptance criteria

Serialize saves per task with latest pending draft/version. Before switching, retain and drain pending old-task save; old completion cannot set new task content/version/locks/meta. On save conflict retain current local content, refresh server version without overwriting draft, surface existing conflict error; next explicit edit/retry may save, no blind automatic overwrite of server conflict. Failed/late A load cannot block or overwrite selectedB. StrictMode single bootstrap creates once without disabling StrictMode. Cache content and task metadata stay paired; unmount cleanup avoids stale state without dropping persisted draft. Preserve existing hook API and no new state-management platform.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.

## Wave5 second review — ready bounded repair

V03-06 (P1), current baseline d528e0e: after first external task GET fails503, TaskDraft retains placeholderversion0/statuserror. Existing persist then sends PUT on lateredit; a real version0 server record accepts defaultcontent+typing and loses the original. Reviewer reproduced with real hook/taskClient and in-memoryHTTP boundary; see reviews/v03-recheck.md. This violates existing known-version concurrency/retained-draft requirements, not a new product policy.

Additional explicit acceptance: unknown server version must not be treated as legitimate0, including after loadfailure, debounce, switch/unmount or cache/reload. Retain usercontent/locks/error and pendingintent; block PUT until an actual successful load establishes the version. Existing selection/recovery flow must be able to resume after such a load without overwriting the localdraft. A known actual serverversion0 remains writable. Preserve offline creation recovery when no taskidentity exists; do not block all errorstates indiscriminately. Keep public hook/API contracts and800ms debounce. No new retry UI, protocol or storage platform. Internal draft/cache validity bookkeeping is within existing allowedscope.

Approved additional seam: actual hook + real taskClient, controlledfetch returning503 then validserverversion0, timers andstorage. Include firstexternal-loadfailed thenedit, pendingeditbeforefailedload, returntoselectionsuccessfulrecovery, cached unknownversion roundtrip, known0 success and offline newcreation as useful discriminators. Test-writer records meaningfulfailure first, leaves productionuntouched and stops. Main accepts RED before fresh implementer.

## Wave5 cache-restart completion — ready bounded repair

V03-07 (P1), baseline3557352, see reviews/v03-version-recheck.md: actualfirstGET503, userinput, unmount leaves cached unknownversionnull; restartGETsuccess callsadoptTask whiledirtyfalse, destroying the solelocaldraft/cache. Existingunknown-version tests only restartwithanotherfailure andtheneditagain. This remains within the cache/reload andpendingintent criterion above.

Explicit completion: cache/restart must preserve genuine unsavedcontent, lockIDs andpendingintent untiltrustedversionarrives, then resumeexisting save behavior using actualversion. A firstGETfailure WITHOUT anyuseredit must not turn placeholder/defaultcontent into a queuedwrite on restart. Distinguish these outcomes with actualproducerhook/storage, not fabricatedcacheassertions. Restoredqueuedintent must survive another bootstrapfailure without requiring a newedit; successfulbackgroundload afterselection must not alter thevisibleother task. No newretryUI/publicAPI/platform. Privatecachevalidity/pendingmetadata is within alreadyapprovedscope; preserve supportedknown numericversion cache semantics.

Fresh test-writer appends narrow regressions toexisting unknown-version test file (can reuseactualHTTPfactory), leaving all8acceptedtests andproductionsource unchanged: editedunknowncache->restartsuccessfulGET (locks+content+deferredknown0+resumedPUT); uneditedfailedload->restartsuccess noPUT/servercontent preserved; restoredpending->secondloadfailure->laterexistingselectionrecovery withoutnewedit. BackgroundselectedB discriminator if needed. RecordrealRED thenstop. Freshimplementer fixesonlyprivatehook/cacheboundary; fullclientgates plus existing88focusedcases mustremainvalid. Formatting fromclientcwd is allowed, assertionscannotbeweakened.
