#!/usr/bin/env bash
set -euo pipefail

# AI PR Creation Script - Automates PR creation and CI triggering
# Usage: bash scripts/ai-pr-create.sh <branch> "<title>" "<body>"

BRANCH="${1:-}"
TITLE="${2:-}"
BODY="${3:-Implementation details}"

if [ -z "$BRANCH" ] || [ -z "$TITLE" ]; then
  echo "Usage: $0 <branch> \"<title>\" [\"<body>\"]"
  echo "Example: $0 feature/new-feature \"feat: New Feature\" \"Implements X, Y, Z\""
  exit 1
fi

echo "🚀 Creating PR for branch: $BRANCH"

# 1. 创建PR
PR_NUMBER=$(gh pr create \
  --head "$BRANCH" \
  --title "$TITLE" \
  --body "$BODY" \
  --json number -q .number)

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "✅ PR #$PR_NUMBER created: https://github.com/$REPO/pull/$PR_NUMBER"

# 2. 触发CI workflows
echo "⚡ Triggering CI workflows..."
gh workflow run ci.yml --ref "$BRANCH" 2>/dev/null || echo "  ⚠️ CI workflow trigger failed (may need manual trigger)"
gh workflow run e2e.yml --ref "$BRANCH" 2>/dev/null || echo "  ⚠️ E2E workflow trigger failed (may need manual trigger)"

# 3. 等待workflows启动
echo "⏳ Waiting 30s for workflows to start..."
sleep 30

# 4. 显示workflow状态
echo "📊 Workflow status:"
gh run list --branch "$BRANCH" --limit 3 --json name,status,conclusion,url \
  | jq -r '.[] | "  \(.name): \(.status) - \(.conclusion // "pending")"' 2>/dev/null \
  || echo "  No workflows found yet (may still be queuing)"

# 5. 监控PR checks
echo ""
echo "🔍 Checking PR status..."
gh pr checks "$PR_NUMBER" 2>/dev/null || echo "  No checks reported yet (workflows may still be starting)"

echo ""
echo "✅ PR created successfully!"
echo "   View PR: https://github.com/$REPO/pull/$PR_NUMBER"
echo "   Monitor CI: bash scripts/ai-monitor-ci.sh $PR_NUMBER"
