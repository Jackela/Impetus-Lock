# Change: Update Python dependencies for reviewed security advisories

## Why

The backend lock contains affected releases of cryptography, OpenTelemetry API and pytest. The fixes for the reviewed advisories require crossing the locked cryptography and pytest major versions. This is the scoped security update for [#266](https://github.com/Jackela/Impetus-Lock/issues/266).

## What changes

- Move cryptography to the 50.0 release line with OpenSSL wheel fixes through 50.0.2 and verify that existing Fernet tokens remain readable.
- Move OpenTelemetry API, SDK and the OTLP HTTP exporter together to the 1.45.2 patch line and verify real span export to a local collector.
- Move development-only pytest to the first fixed release, 9.0.3, while retaining compatible plugins, test collection and coverage gates.
- Keep the Python 3.11 and 3.12 test matrix and the existing CI workflow definitions.

## Sources

- [PyCA 50.0.2 release notes](https://github.com/pyca/cryptography/blob/50.0.2/CHANGELOG.rst) and [CVE-2026-69249](https://github.com/advisories/GHSA-jwv3-5hgf-82ww).
- [OpenTelemetry 1.45.2 release notes](https://github.com/open-telemetry/opentelemetry-python/releases/tag/v1.45.2), [CVE-2026-126360](https://github.com/advisories/GHSA-mf5v-w3w3-f6cg) and [CVE-2026-114603](https://github.com/advisories/GHSA-xcq7-p3pf-p88h).
- [pytest 9.0.3 release notes](https://github.com/pytest-dev/pytest/releases/tag/9.0.3) and [CVE-2025-71176](https://github.com/advisories/GHSA-6w46-j5rx-g56g).

## Impact

- The developer bootstrap and observability specs retain their existing requirements.
- This change updates the server Poetry manifest and lock, backend test tooling and the dependency contract tests.
- PyCA publishes wheels for Linux x86-64 and ARM64, Apple silicon macOS, and 64-bit Windows. Intel macOS and 32-bit Windows are outside upstream support starting with cryptography 49.
