#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/deploy-entry.sh
source "$(dirname "${BASH_SOURCE[0]}")/deploy-entry.sh"
deployment_entry staging "$@"
