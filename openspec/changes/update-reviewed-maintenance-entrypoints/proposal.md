# Verify deployment entry points

## Why

The November 26 review at `daab9e2` found that the deployment entry points could report a successful backup, database readiness check or rollback without establishing that the operation had succeeded.

## What changes

- Document the external Compose contract and verify the actual API and client image identities, database compatibility, backup and readiness at deployment and rollback.
- Exercise the built Web client and reverse proxy on Linux. Include regression checks for development process ownership and the supported authentication and runtime contracts in regular CI.

## Scope and authorization

The maintainer authorized the review remediation, compatible entry points, maintenance documentation and build workflows on November 26, including isolated backup and rollback rehearsals. Production and staging infrastructure access, paid provider calls and changes to repository protection are outside the exercise. Existing author-text, receipt, ownership, optimistic-write and database contracts are repaired under their current specifications.
