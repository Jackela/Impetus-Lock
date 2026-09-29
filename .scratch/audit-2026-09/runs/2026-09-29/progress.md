# Audit 2026-09-29

Base: `31b0e3f011313e73cf56fc2756f3fb2be2e6b63e`. Integration branch: `codex/audit-2026-09-29`.

## Authorization

- All confirmed Tier 1/2 findings, including P2, must be remediated. Tier 3 is proposal-only.
- Main agent alone integrates and accepts; children depth=1 and may not delegate. Reviewers are read-only.
- Preserve main, prior evidence and the original untracked `.zcode/`. No remote writes or push.
- Each critical file must reach 80% executable-line coverage; no empty scope or excluded source.
- No Playwright, paid live model calls or remote CI execution.

## Waves

1. Matt configuration checked: existing init `b14fdb1` retained; local audit exception clarified.
2. COMPLETE: five read-only charters, including fresh ephemeral CLI workflow audit after built-in agent-thread limit.
3. COMPLETE: findings appended without rewriting history;21 Tier2 tickets,3 Tier1 batches,5 proposal drafts underP-01.
4. Isolated TDD remediation pending.
5. Independent review and full gates pending.

## Baseline gates (ea0ff6e)

- Backend: Ruff check/format, import-linter, declared mypy, pydocstyle PASS; specified pytest selection 649 passed, 6 skipped.
- Client: ESLint, Prettier, existing type-check PASS; Vitest 54 files, 558 passed, 4 skipped. Existing type-check is known to omit actual projects and is not accepted as source validation.
- Critical per-file gaps: ContentInjector 54.21%; base_provider 59.79%; PostgreSQLTaskRepository 51.95%. TaskService currently 96.05% but omitted from fixed critical scope.
- Logs are preserved under this run's logs directory. Test counts are selection-specific; original prompt counts are historical.

## Orchestration runtime

Built-in collaboration spawn reached its per-session agent-thread limit after the planning/audit children. Further workers use fresh `codex --no-daemon ... exec --ephemeral` contexts, explicit gpt-6 model/effort, depth1/no delegation, max3 simultaneous workers. The first read-only CLI audit completed successfully with gpt-6-sol/high; transcript retained in logs/workflow-session.log.

TDD skill public-interface seams are approved in the plan and fixed in each ready ticket. Main accepts RED before fresh implementer dispatch; no agent changes acceptance. Main commits/integrates path-scoped results.

- Integrated R01 `3cd8625` and R03 `eddbe65` after reviewing actual diffs and RED/GREEN evidence. Independent review pending. R02/R11 RED workers started; D-A omissions returned for repair.

- D-A integrated as `882017e`; final main corrections removed absent quick-validate path and unspecified OpenAPI version claim. R02 RED accepted: actual history uniqueness collision on act_debug. R11 RED accepted:15 TanStack missing-export diagnostics within245 total. Fresh implementers started.

- Integrated R02 `79ed45a` (22 focused tests,652 server tests) and D-B `590638e`. Main narrowed the dependency-guide rewrite to evidence-based edits preserving its structure and restored historical command text. Sole index removal .last-branch; original bytes retained in docs and integration worktrees; screenshots untouched. R04 RED and D-C started.

- R11 main review found generator-local schema required-field additions. Native Pydantic serialization metadata can describe existing output without changing validation defaults: isolated subclass check confirmed issued_at remains defaulted for validation and required for serialization. R11 scope clarified for metadata repair and new raw-schema RED; do not accept hidden schema normalization in generator.

- Integrated D-C `de76d15` after main corrected actual Phase5 path, all active mypy commands and Act workflow selection. Constitutional articles and managed OpenSpec block compared unchanged; Agent skills section remains unique. P-01 drafting started. R04 RED accepted using actual mounted app with TESTING unset; fresh implementation started.

- R11 additional RED accepted: raw actual endpoint OpenAPI omits issued_at and three anchor discriminants while actual model serialization includes them; input defaulting/invalid-discriminant checks pass. Fresh implementer assigned native schema metadata repair.

- R11 integrated `a8a62ee`: authoritative raw response schema, unchanged input validation, pinned repeatable generation/check;2 generator checks,32 related server tests and both package gates passed. Client-owned node_modules used by integration via ignored symlink; original dependencies unchanged. R13 save-race RED worker started.

- R04 first GREEN withheld by main: candidate allows fallback-secret protected authentication and changes existing token compatibility. Existing cookie/client work preserved. Fresh boundary RED worker dispatched. Around09:44UTC a P-01 worker connection retry was observed after a host-time gap; no assumptions about cause; evidence retained.

- R13 RED accepted:409 response overwrites latest local draft/locks with remote data in actual hook+client underStrictMode, despite local cache retaining draft. Fresh implementer assigned remaining race slices and package gates.

- R04 boundary RED accepted:2 failures +10 invalid-claim cases passing. Candidate permits fallback-secret read/write (200/204 instead of401), and rejects existing unaugmented JWTHandler-issued UUID token (401 instead of router405/logout204). Fresh implementer must repair both without weakening invalid-identity checks.

- R04 integrated `8fbf6cf`: 66 server/38 client focused tests;667 server and582 client full tests; all declared gates green. Root reviewed configured-secret and legacy-token correction, shared request helper and frontend callsite diff. P-01 integrated `e8bc6d4`:5 strict-valid drafts. Main removed normative zero-stub preservation and recorded B15/B16 as P-02 pending data/behavior proposal. R05/R07 RED workers started on fresh branches from integrated e8bc6d4.

- R05 RED accepted: actual auth/CSRF + repository yields foreign intervention200,1 provider call,1 foreign history; expected404/0/0. R07 memory parity RED accepted; before implementation a fresh worker is assigned the real PostgreSQL RED with the explicit user-providedURL (missing from initial worker environment handoff). Integration cross-check afterR04/R11:16 focused tests and api:check passed.

- R13 integrated `380c9bc`:16 race tests,25 focused and577 full client tests passed; actual compiler new diagnostics0. Main checked per-task queue, stale response guards, conflict retention and StrictMode lifecycle. R07 real PostgreSQL RED accepted:2 successes/0 conflicts from independent sessions; expected1/1. Colima/Postgres were stopped, started per supplied instructions; first connection error retained, behavioral RED in R07-main-postgres-red.log.

- R12 RED accepted: actual QueryClient/hook/modal receives201 but caller-selected task stays empty; close assertion not reached. Main reviewed fetch-boundary test; fresh implementer assigned.

- R07 `700b36e` integrated:99 focused/678 full tests,4 actualPG tests; atomic CAS, in-memory independent snapshots, legacy/scoped service translation. Main adds health-checked PostgreSQL16 to existing backend CI job because its real regression now requires PostgreSQL; YAML parsed,4PG tests rerunpassed, remoteCI unrun. R05 `2a0be77`:44focused/676full, allgatespass; old commit-fault fixtures now use realauthandownedDBboundary, no assertions dropped. R12 `d663fa6`:41focused/601full, allgatespass;actualapp220/node1,new0. All three waitWave5review. Fresh R06/R08/R14 RED workers next.

- Integration check R05+R07:22passed in main-r05-r07-integration.log. R14 compiler evidence received, scope clarified for the existing focus-hook consumer only; no acceptance change.

- R06 RED accepted: overlapping same-user/task/key requests yield different responses and2generations/2commits/2historywrites, expectedoneeach. R08 RED accepted: event-loop heartbeat cannot release blocked synchronous provider before deadline escape; event ordering, not timing threshold, provesfailure. R14 compiler RED220diagnostics accepted;5missing-module diagnostics belongR17. All fresh implementers active.

- Integration documentation follow-up for D-A after R18/R19/R20: active testing guides must state the now-required local PostgreSQL concurrency test prerequisite (same user-provided default URL; test-owned schemas only) and final effective type/per-file coverage commands. README already explains PostgreSQL setup, but TESTING currently has no database prerequisite. Reuse D-A documentation batch, not a fourth Tier1 batch.

- Planned conflict-free remaining lanes: server R06→R09→R19 (afterR08); floating R08→R10→R16→R21/R20; client R14→R15→R17→R18. Run R18 after R20/R21 if they touch compiler-covered test/config files, to avoid reintroducing diagnostics. Floating client work needs isolated owned node_modules or stable dependency ownership; do not mutate original environment. P-02 and D-A integration doc follow-up still required before Wave5.

- R06 `5b030ad` integrated:63focused/697full, allservergatespass; scoped JSONkey, per-key lock referencecounts with cancellationcleanup, first-resultTTL preserved, noBYOKkey retained. Main corrected cache docstring toscopedidentity. R08 `ff0d92a`:47focused/689full, allservergatespass; native thread offload with repeated-cancellation draining beforeprovidercleanup. Fresh R09/R10 RED next.

- R06/R08 integration:42tests passed, main-r06-r08-integration.log. R14 main review withholds finalGREEN for needless runtime animation normalization caused by widened string typing; permit type-only producer contract correction in existing useAnimationController, preserve direct variants and existing supported behavior. Fresh minimal-repair worker after original exits.

- R09 RED accepted: actual mounted auth/CSRF with TESTING off and two registered users in isolatedPGschema; foreign profile GET200 rather than404. Owner create/read established, owner state unchanged. R10 RED accepted: actual route factory/service/REST sees separate managers, empty members/no broadcast instead of2members andpeer awareness event. No productionpermission bypass or approval implied; externalRedis only mocked. Fresh implementers active.

- R14 final GREEN after main simplification:105focused/610full clienttests; gatespass; actual app220→188/node1,new0. Public Easing plus object type alias replaces runtime normalization; emitted hookJS unchanged. Null/ref/style guards have realDOM tests. Integrated commit recorded in tickets next checkpoint. R15 compiler/editor RED worker dispatched with explicit warning that current manual filterTransaction must remain enforced.

- R10 `893148e` integrated:83collaboration/701fullservertests, allgatespassed. Minimalfactoryreturnexistingmanager; lifecycle/permission behavior untouched. Floating lane switched R16 and detached only its ignored node_modules symlink to original; npmci installs owned dependency copy for parallel frontend compiler/test work. Original dependencies retained.

- R15 meaningful RED accepted (02-red log): real Milkdown editor creation with placeholder plugin fails at EditorState.create reading undefined.state; first cleanup-timeout log retained, corrected test avoids infinite destroy retry after failed create. Main inspected real initialization and PM edit/delete assertions, nointernalmocks. R16 compiler RED accepted:188actualapp diagnostics,24ticket-group errors coveringerasablesyntax, guards, storage andcrypto; owneddependencies installed639packages withoutoriginalmutation. Fresh implementers next.

- R15 main source check: PlaceholderPlugin is not currently imported/mounted by EditorCore. Its real-editor regression proves the exported plugin contract fails when used, NOT that the current main editor cannot initialize. F14 severity remainsP2; do not mount this plugin as part of repair.

- R09 integrated:19realPG ownership/lifecycle/pagination/auth tests,42focused/719fullserver; allgatespassed. Main checked all8 protected operations, scoped ID queries/deletes, real no-mutation checks, and kept older algorithm/no-session assertions with ownedidentity. Existing empty security placeholder skips remain historical non-evidence (new real auth tests provide actual evidence); no claim of standalone lockpermission API. R19 per-file coverage RED next.

- R09 integration API drift caught: get_current_user exposes8existing access_token cookies plusupdateddocstrings. Main regenerated authoritativeartifact, inspectedall41changedlines, api:check/test:api-types+allclientdeclaredgatespassed (610tests). Amended only latest local integration R09 commit `dcd3bd8`→`a024c9b` to include generatedtypes; workerR19 base remainsold content-equivalentserver snapshot. No publicpath/businessfield change. R19 RED accepted: fixedfixturebase_provider50%,aggregate96.67%,actualoldCLIexit0; expectedreject. Not productcoverage.

- R16 main review withholdsGREEN for unsafe narrowed loggerenv key assertion. Actual numeric reverse key string0 yields stringDEBUG, contradicting numeric logger level and existing fallback intent. Other21file changes preserved; fresh additional RED worker on publiclogger seam before minimal guardedlookup repair.

- R15 main reviewed native Plugin/filter integration, real undo/metadata/multi-step tests and additional RED evidence; integrated 1c58e4d. Placeholder remains unmounted in production; full client 616 passed/4 skipped, actual compiler 165+1 with new 0, pending R18.
- R16 logger numeric-key RED accepted: 17 pass/1 fail; fresh implementer repairing verified lookup while preserving reverse enum export.

- R19 integrated 7e255be: main reviewed 43-line guard, independent inventory fixtures, real database schema isolation and provider error/retry tests. 736 passed/6 skipped; all 16 critical files >=80, minimum87.91, report95.40%; server-wide79.44 is separate. Pending independent review.

- R17 runtime Node22.12/23 acceptance defect reproduced with public semver boundary assertions. Main accepted RED; fresh implementer will reconcile declarations and source dependency imports, without mounting new authentication UI.

- R16 integrated 3b778c6: main accepted final verified logger name/numeric lookup with no assertion; forward/reverse enum behavior retained. Six finite seeds each30pass, full624pass/4skip in lane; app146+node1/new0. Prior19 files preserved. R20 fresh test-writer starts from integrated R15/R16 state.

- R20 public reporter RED accepted: six synthetic expected files measured, total>=80 while ContentInjector<80, production policy incorrectly exits0. Preserve initial fixture path error separately. Fresh implementer requested actual wrapper/pool and missing/unexecuted inventory proof.

- R17 integrated fc928bc: compatible direct axios/router declarations, semver explicit dev dependency for runtime boundary test, no existing lock version changes. Actual engine boundary test green, client616pass/4skip, app156+node1/new0 in lane. Main checked removed exports have no consumers. Current Node24 executed; Node22 only metadata verified.

- Root integration compiler fc928bc: app114/node1. Seven diagnostics in six production files were not covered by prior per-area repairs; R18 explicitly extended only for their type/import/timer/buffer guards. Remaining TypeScript test/config diagnostics stay R18 scope.
- R21 RED accepted:14 real screenshot call sites across5 specs target tracked directories; no assets or production files modified.

- P-02 integrated 4bfbf69: five proposed docs and appended index, 16 unchecked tasks,8 added delta requirements. Main read full draft/specs and preserved explicit unsupported streak/Special dependencies; no implementation/approval. Changed worktree-specific links to portable repository links and reran fixed0.23.0 strict validation successfully. Worker appended index in central run as its explicit ticket allowed; main included it in the single integration commit.

- R18 test-writer starts isolated compiler/probe evidence on former server lane from4bfbf69; all declared R12–17 dependencies integrated. Linked only ignored node_modules to client-owned installed dependencies, preserving original packages. Implementation waits for R20/R21 to avoid shared config/test edits.

- R21 integrated 96b583c: main reviewed all14 calls and preserved names/fullPage/conditions/assets. Node static regression1pass,5Playwright specs13tests collection-only and strict selected compile pass; fullclient630pass/4skip, actualapp114/node1 unchanged. No browser launched.

- R20 integrated b30d805: native perFile80 plus minimal fixed inventory reporter; five real reporter fixtures prove low/missing/unexecuted reject and80/100 pass. Real PM operation tests leave production behavior unchanged. Full655pass/4skip, all6critical89.28–100%, ContentInjector98.95%. Sixfinite seeds each85pass; changedfile diagnostics0. Main reviewed real state/metadata/invalid-throttle assertions and corrected stale engine comment after R17.

- R18 RED accepted: declared check0inputs/exit0 while actualapp114/node1 fail. Inventory omitted48clientTS inputs plus2outside-client spec contract documents; latter are documentary scope, not runtime source. R20/R21 now integrated; next fresh implementer starts from latest root. JavaScript-only config/scripts require separate explicit validation, not false tsc claims.

- D-A final docs worker closed: onlyTESTING/DEVELOPMENT/ARCHITECTURE_GUARDS changed; three offline Node contract/config tests and links pass. Main read diff; hold final commit until R18 finishes, then replace acceptance-target wording with verified compiler behavior and ensure local Redis-excluded commands are directly runnable. No runtime code changed.

R18 first candidate passed 655 tests/4 skips and six full vmThreads seeds, but main withheld acceptance: a required ambient legacy editor facade had no installer. Fresh scoped repair requested; no production facade or browser runtime claim authorized.

Wave4 complete at e6acabc. R18 integrated632886b after main scope review and additional RED/GREEN removing invented legacy setter/delete return contracts;680 passed/4 skips,238 TS inputs, zero diagnostics. D-A final followup5d66b3a and D-C command followupe6acabc integrated; constitution and root OpenSpec block byte-identical to baseline. All21 Tier2,3 Tier1 batches and2 proposal tickets now integrated pending independent review. No final acceptance yet.

Wave5 V03 reproduced two R13 draft-loss paths omitted by first tests: dirty typing during load adoption, and recovered cache content after A/B/A switch. Main accepts both as original F06/R13 Tier2 scope, prepares a fresh test-writer/implementer cycle; no acceptance yet. First full integration gates passed736/680 with6/4skips, all22 critical files>=80; results must be refreshed for any repaired client code.

V03 final review confirms four findings: R13 three paths (dirty during load, offline recovered draft switch, background bootstrap stuck loading), plus R12 actual App creation callback never selects new task. Main accepts the fourth against original R12 acceptance and existing create-task-and-write journey, expands only actual caller seam; no new auth/navigation architecture. All repairs require fresh RED/GREEN and V03 re-review.

V06 confirms three D-A P2 doc defects: short Loki delete example triggers correctguard, nonexistent specificE2E command, missing browser auth/CSRF prerequisites. Main accepts these source/probe-confirmed issues and dispatches a fresh docs-writer, only3 existingdocs. Constitution, OpenSpec blocks, cleanup/media preservation and all6 proposed/unapproved drafts passedreview.

R13 review repair92e8efe integrated after main diff/RED/GREEN review (35 focused,690 full/4 skips). R12 caller wiring correctly selects new task but actual editor still shows placeholder; main reproduced again after R13 integration (R12-main-after-r13.log). The implementer correctly stopped at scope boundary. New Tier2 ready ticketR22 isolates existing EditorCore initialization/content-version0 defect; no architecture change. R12 pending changes held, no partial commit; completes only after R22 dependency and actual App GREEN.

D-A correction666a3fb integrated after main full diff review:51-character Unicode Loki context andmatching17-character delete range withprovider assumption; existingE2E filename; exact auth cookie/CSRF/session preparation and unmountedUI limitation. Real offline service/provider and auth middleware probes plus collection-only4 Playwright tests passed; no browser/LLM/accountcreation. Fresh V06 recheck dispatched.

V06 second review found the D-A response JSON still used oldfrom1289. Main accepted, fresh docs-writer corrected onlyJSONto1293 and verified extracted finalrequest/response with sourcefunctions. Integrated one-line followup, fresh V06 final recheck dispatched.

R22 root reviewed actual diff: controlled props reconcile at readiness, native lock filter retained, server load is not user edit, heading-ID nested dispatch emits once. Five accepted RED cases retained; focused38 and full695/4 plus packagegates/coverage/build green. Committed and integrated pending independentreview and R12 actualApp integration.

R12 actual App creation flow passed after R22 integration with real backendversion0 fixture; no assertions weakened. Main inspected App/AppModals wiring and actualfetch/realMilkdown test, ran fullclient lint/format/typecheck/test:696passed4skipped. Integrated R12 reviewrepair; fresh V03/V04 now dispatched.

V03 recheck closed originalfour but reproduced newP1 unknownversion0 write afterfailedload. Main verifiedpersistguard currentlyonlystatusloading and acceptedV03-06; sameR13 boundedreadyrepair extended to unknownversion/cache preservation with known0/offlinecreation controls. V04 recheck0findings includingR22. Finalclient696/4 and6seeds passed but acceptance remainsblocked on thisconfirmeddefect.

R13 second-review RED accepted:6fail/2pass viaactualhook/taskClient/statefulHTTP. Unknown0 overwritesoriginal/locks after503, debounce/switch/unmount/cache; known0 andofflinecreatepositivecontrols pass. Productionunchanged, freshimplementerdispatched.

R13 V03-06 rootreview:27line hookdiff adds privateversionKnown, cachesunknownnull, blocksPUTwithoutknownversion and retriesunknown retaineddraft onreturn. Eighttests6RED/2controls nowgreen; existingtask/App/editorfocused88passed. Workerfull704/4 butnewtestformatfailed, rootappliedonlyPrettier; normalizedTypeScriptASTequals recordedoriginaltest. Rawtext/tokencomparisons were unsuitable forformat/trailingcommadifferences and failed asverificationmethods, notproductdefects. Rootre-ranlint/format/typecheck/test allgreen704/4. Committedand integrated; freshV03finalreview dispatched.

V03 final review reproduced V03-07: unknownversioncache survivesfailedbootstrap but is overwritten on successfulrestartGET becausedirtyfalse. Main independently traced samebootstrap/adoptpath andaccepts originalscope defect. Added boundedreadycriteria forpendingintent/locks and no-editfailedload discriminator; freshTDDcontinues. Existing704/4+242inputs+6seeds green is retained but not acceptance.

V03-07 RED accepted:3addedactualproducer/cachetests,2fail/9pass. Successrestartlosescontent+locks+pending; repeatfailureloseslocks/pending; no-editcontrolpasses. BackgroundBisolationassertionsretained. Productionunchanged, freshimplementer nowdispatched.

V03-07 rootacceptedcandidate:privateunknowncache records pendingLockIds onlywhenactualpendingexists;onChange setsqueuebeforecache;bootstraprestorescontent/locks/pending beforeGETadopt. No-editfallbackdirtyflagalone cannotauthorizequeue. Hook24add/3remove; accepted3tests189linesunchanged;11targeted/91focused/707full4skip andallclientgatespass. Integrated pendingfreshindependentreview.

## Main acceptance — completed

V03 cache-final independentreview returnedSpec0/Standards0, closingV03-07. Otherfivebatchreviewsalreadyclear andrelatedsourcesunchanged. Main inspectedintegrationdifferences, acceptedall22Tier2tickets and3Tier1batches;6Tier3draftsacceptedonlyasdocuments, notapproved/implemented. Finalproductfb797ff:client707/4,242compilerinputsnoomissions/diagnostics,9gatesand6existingvmThreadsseedsallpass. Server736/6 andOpenSpec23 strictpass retainedwithsourceidentityverified. EightDependabotPRs read-onlyrefreshed13:11:18UTC. Originalmain31b,.zcode,media/environment/data preserved; no remote mutation. Finalreport/ledger/evidenceclosureprepared.
