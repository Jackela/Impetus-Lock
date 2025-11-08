#!/usr/bin/env bash
set -euo pipefail

# AI CI Monitoring Script - Monitors PR checks until completion
# Usage: bash scripts/ai-monitor-ci.sh <PR_NUMBER> [timeout_seconds]

PR_NUMBER="${1:-}"
TIMEOUT="${2:-600}"  # 默认10分钟超时

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <PR_NUMBER> [timeout_seconds]"
  echo "Example: $0 12 600"
  exit 1
fi

echo "🔍 Monitoring CI for PR #$PR_NUMBER (timeout: ${TIMEOUT}s)"
echo ""

ELAPSED=0
LAST_STATUS=""

while [ $ELAPSED -lt $TIMEOUT ]; do
  # 获取PR checks状态
  CHECKS_JSON=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion 2>/dev/null || echo "[]")
  
  # 检查是否有checks
  if [ "$CHECKS_JSON" = "[]" ] || [ "$CHECKS_JSON" = "null" ]; then
    echo "  ⏳ Waiting for checks to appear... (${ELAPSED}s elapsed)"
    sleep 15
    ELAPSED=$((ELAPSED + 15))
    continue
  fi
  
  # 解析状态并显示
  CURRENT_STATUS=$(echo "$CHECKS_JSON" | jq -r 'map("\(.name):\(.state)") | join(",")')
  
  # 只在状态变化时输出
  if [ "$CURRENT_STATUS" != "$LAST_STATUS" ]; then
    echo "📊 Check status (${ELAPSED}s):"
    echo "$CHECKS_JSON" | jq -r '.[] | "  [\(.state)] \(.name): \(.conclusion // "pending")"'
    LAST_STATUS="$CURRENT_STATUS"
  fi
  
  # 检查是否全部完成
  PENDING_COUNT=$(echo "$CHECKS_JSON" | jq '[.[] | select(.state == "PENDING" or .state == "IN_PROGRESS")] | length')
  FAILURE_COUNT=$(echo "$CHECKS_JSON" | jq '[.[] | select(.conclusion == "FAILURE" or .conclusion == "CANCELLED")] | length')
  
  if [ "$PENDING_COUNT" -eq 0 ]; then
    echo ""
    if [ "$FAILURE_COUNT" -gt 0 ]; then
      echo "❌ CI checks failed ($FAILURE_COUNT failures)"
      echo ""
      echo "Failed checks:"
      echo "$CHECKS_JSON" | jq -r '.[] | select(.conclusion == "FAILURE" or .conclusion == "CANCELLED") | "  - \(.name): \(.conclusion)"'
      echo ""
      echo "View details: gh pr view $PR_NUMBER"
      exit 1
    else
      echo "✅ All CI checks passed!"
      exit 0
    fi
  fi
  
  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

echo ""
echo "⏱️ Timeout reached (${TIMEOUT}s) - checks still running"
echo "Current status:"
echo "$CHECKS_JSON" | jq -r '.[] | "  [\(.state)] \(.name): \(.conclusion // "pending")"'
exit 2
