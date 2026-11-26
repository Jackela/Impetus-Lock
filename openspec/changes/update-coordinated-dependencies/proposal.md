# Change: Upgrade the supported runtimes and dependency groups in #266

## Why

[Issue #266](https://github.com/Jackela/Impetus-Lock/issues/266) tracks runtime, build and provider dependencies that must move together. The November dependency updates also include TanStack Query, pytest, Hypothesis and a proposed update to an unused Passlib adapter.

## What changes

- Upgrade the Node toolchain to Node 26, Vite 8, the React plugin 6, ESLint 10, React Hooks 7, Node types 26 and lint-staged 17. Preserve compatibility with the supported Node 22 and 24 releases and keep the existing lint and coverage gates.
- Verify Python 3.15 for the backend container and keep older Python CI coverage. Upgrade redis-py to 8 and the Google Gen AI SDK to 3. Retain the existing provider output, timeout, rate-limit and synchronization contracts.
- Keep bcrypt as a direct dependency for existing accounts. Remove the unused Passlib helper and exercise stored bcrypt hashes through the HTTP login route.
- Upgrade setup-node, Docker login and Docker build/push actions together. Keep registry and deployment permissions unchanged. Incorporate the reviewed package updates from #319 and #321 and resolve #318 through removal of the unused dependency.

## Python 3.15 dependency

The released Instructor 1.17.0 constrains `jiter` to versions below 0.15. Its 0.14 extension has no wheel for CPython 3.15. Use the published Instructor package on earlier supported Python versions. For Python 3.15, pin the official upstream source commit that permits the published jiter 0.18.0 wheel built with the final 3.15 ABI. Test the legacy OpenAI and Anthropic tool-call protocols at the HTTP transport boundary. Return to a PyPI release when it supports the same wheel and passes those contracts. [Instructor 1.17.0](https://pypi.org/project/instructor/1.17.0/) · [upstream change](https://github.com/567-labs/instructor/commit/7b28ef5dd62af32e1c09726679b3486cc9721efd) · [jiter wheels](https://pypi.org/project/jiter/0.18.0/#files)

## Impact

The change affects development installs, CI, container builds and internal client/provider adapters. No application database migration is required. Reverting the coordinated change restores the prior runtimes and locks.
