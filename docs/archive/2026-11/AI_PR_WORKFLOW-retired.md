# AI PR Workflow - GitHub Actions 自动化指南

> **Retired (archived 2026-11-11).** The "merge automatically once CI is green" rule and the associated helper scripts are retired. Use normal `gh` commands and human approval; see `AGENTS.md`.

## 问题说明

**根本原因**: GitHub Actions 的 `pull_request` 触发器只在以下情况触发：
1. PR创建时 (opened)
2. PR同步时 (synchronized) - 即PR**已存在**的分支推送新commits

**问题场景**: 
- AI先推送commits到分支
- 然后创建PR指向该分支
- 结果：已存在的commits不会触发workflow

---

## 解决方案对比

### 方案1: 添加 `workflow_dispatch` 手动触发器 ⭐ 推荐

**配置** (已添加到 `ci.yml` 和 `e2e.yml`):
```yaml
on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]
  workflow_dispatch:  # 新增：手动触发
    inputs:
      ref:
        description: 'Branch or commit to run CI on'
        required: false
        default: 'main'
```

**AI工作流程**:
```bash
# 1. 创建分支并推送代码
git checkout -b feature/new-feature
# ... 开发代码 ...
git commit -m "feat: implement new feature"
git push origin feature/new-feature

# 2. 创建PR
gh pr create --title "feat: New Feature" --body "Description"

# 3. 手动触发CI workflow
gh workflow run ci.yml --ref feature/new-feature
gh workflow run e2e.yml --ref feature/new-feature

# 4. 等待并监控workflow结果 (30秒后开始检查)
sleep 30
gh run list --workflow=ci.yml --branch feature/new-feature --limit 1

# 5. 获取详细的check结果
gh pr checks <PR_NUMBER>

# 6. 如果失败，查看日志
gh run view <RUN_ID> --log-failed
```

**优点**:
- ✅ 简单：只需添加6行配置
- ✅ 灵活：可随时重新触发
- ✅ 可靠：明确知道何时触发
- ✅ 可调试：可指定任意分支/commit

**缺点**:
- ⚠️ 需要等待30秒才能查询到run (GitHub webhook延迟)
- ⚠️ 多一步手动触发操作

---

### 方案2: 先创建PR，再推送空commit ⭐ 自动化

**AI工作流程**:
```bash
# 1. 创建分支 (不推送)
git checkout -b feature/new-feature

# 2. 先推送一个初始commit
git commit --allow-empty -m "chore: Initialize feature branch"
git push -u origin feature/new-feature

# 3. 立即创建PR (分支已存在，但只有空commit)
gh pr create --title "feat: New Feature" --body "WIP"

# 4. 推送实际代码 (触发 pull_request synchronized 事件)
# ... 开发代码 ...
git commit -m "feat: implement new feature"
git push origin feature/new-feature

# 5. 自动触发CI，等待30秒后检查
sleep 30
gh pr checks <PR_NUMBER>
```

**优点**:
- ✅ 完全自动：PR存在后，每次push自动触发
- ✅ 符合Git最佳实践：commits按开发顺序推送

**缺点**:
- ⚠️ 需要调整工作流程：先创建空分支+PR，再推送代码
- ⚠️ 产生额外的空commit

---

### 方案3: 推送后立即创建PR + 监控延迟 ⚠️ 不推荐

**AI工作流程**:
```bash
# 1. 推送代码
git push origin feature/new-feature

# 2. 创建PR (触发 pull_request opened 事件)
gh pr create --title "feat: New Feature" --body "Description"

# 3. 理论上应该触发，但实际可能延迟5-10分钟
# 等待更长时间 (GitHub webhook处理延迟)
sleep 300  # 5分钟

# 4. 检查结果
gh pr checks <PR_NUMBER>
```

**为什么不推荐**:
- ❌ 不可靠：GitHub webhook延迟不可预测 (1分钟-10分钟)
- ❌ 浪费时间：需要等待很久才能确认是否触发
- ❌ 难以调试：无法区分是"未触发"还是"延迟触发"

---

## 推荐实践：方案1 (workflow_dispatch) + 自动化脚本

创建辅助脚本 `scripts/ai-pr-create.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BRANCH="$1"
TITLE="$2"
BODY="${3:-}"

echo "🚀 Creating PR for branch: $BRANCH"

# 1. 创建PR
PR_NUMBER=$(gh pr create \
  --head "$BRANCH" \
  --title "$TITLE" \
  --body "$BODY" \
  --json number -q .number)

echo "✅ PR #$PR_NUMBER created: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pull/$PR_NUMBER"

# 2. 触发CI workflows
echo "⚡ Triggering CI workflows..."
gh workflow run ci.yml --ref "$BRANCH"
gh workflow run e2e.yml --ref "$BRANCH"

# 3. 等待workflows启动
echo "⏳ Waiting 30s for workflows to start..."
sleep 30

# 4. 显示workflow状态
echo "📊 Workflow status:"
gh run list --branch "$BRANCH" --limit 2 --json name,status,conclusion,url

# 5. 监控PR checks
echo ""
echo "🔍 Monitoring PR checks (Ctrl+C to stop)..."
while true; do
  gh pr checks "$PR_NUMBER" 2>/dev/null && break
  echo "  Waiting for checks to appear..."
  sleep 10
done

echo ""
echo "✅ PR created and CI triggered successfully!"
echo "   View PR: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pull/$PR_NUMBER"
```

**使用方式**:
```bash
# AI执行
bash scripts/ai-pr-create.sh feature/new-feature "feat: New Feature" "Implementation details"
```

---

## AI监控CI结果的完整流程

### 1. 创建PR并触发CI

```bash
# 方案1: 使用脚本 (推荐)
bash scripts/ai-pr-create.sh <branch> "<title>" "<body>"

# 方案2: 手动步骤
gh pr create --title "..." --body "..."
gh workflow run ci.yml --ref <branch>
gh workflow run e2e.yml --ref <branch>
```

### 2. 等待workflow启动 (必须)

```bash
# GitHub需要时间处理webhook和启动runner
sleep 30
```

### 3. 查询workflow运行状态

```bash
# 方法A: 查看PR checks (推荐)
gh pr checks <PR_NUMBER>

# 方法B: 查看workflow runs
gh run list --workflow=ci.yml --branch <branch> --limit 1 \
  --json name,status,conclusion,url

# 方法C: 查看最新的runs
gh run list --branch <branch> --limit 5
```

### 4. 等待workflow完成

```bash
# 轮询检查 (每15秒检查一次)
while true; do
  STATUS=$(gh run list --workflow=ci.yml --branch <branch> --limit 1 \
    --json status -q '.[0].status')
  
  if [ "$STATUS" = "completed" ]; then
    echo "✅ CI workflow completed"
    break
  fi
  
  echo "⏳ Workflow status: $STATUS (waiting...)"
  sleep 15
done

# 获取结论
CONCLUSION=$(gh run list --workflow=ci.yml --branch <branch> --limit 1 \
  --json conclusion -q '.[0].conclusion')

if [ "$CONCLUSION" = "success" ]; then
  echo "✅ All checks passed!"
else
  echo "❌ Checks failed: $CONCLUSION"
  # 查看失败日志
  RUN_ID=$(gh run list --workflow=ci.yml --branch <branch> --limit 1 \
    --json databaseId -q '.[0].databaseId')
  gh run view "$RUN_ID" --log-failed
fi
```

### 5. 完整监控脚本示例

```bash
#!/usr/bin/env bash
# scripts/ai-monitor-ci.sh
set -euo pipefail

PR_NUMBER="$1"
TIMEOUT="${2:-600}"  # 默认10分钟超时

echo "🔍 Monitoring CI for PR #$PR_NUMBER (timeout: ${TIMEOUT}s)"

ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  # 获取所有checks状态
  CHECKS=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion 2>/dev/null || echo "[]")
  
  # 检查是否有checks
  if [ "$CHECKS" = "[]" ]; then
    echo "  ⏳ Waiting for checks to appear... (${ELAPSED}s)"
  else
    # 解析状态
    ALL_COMPLETE=true
    HAS_FAILURE=false
    
    echo "$CHECKS" | jq -r '.[] | "\(.name): \(.state) - \(.conclusion // "pending")"' | while read line; do
      echo "  $line"
      if echo "$line" | grep -q "PENDING\|IN_PROGRESS"; then
        ALL_COMPLETE=false
      fi
      if echo "$line" | grep -q "FAILURE\|CANCELLED"; then
        HAS_FAILURE=true
      fi
    done
    
    # 检查是否全部完成
    if $ALL_COMPLETE; then
      if $HAS_FAILURE; then
        echo "❌ Some checks failed!"
        exit 1
      else
        echo "✅ All checks passed!"
        exit 0
      fi
    fi
  fi
  
  sleep 15
  ELAPSED=$((ELAPSED + 15))
done

echo "⏱️ Timeout reached (${TIMEOUT}s) - checks still running"
exit 2
```

---

## Claude Code 实践建议

### 工作流程模板

```bash
# 1. 开发功能
git checkout -b feature/xxx
# ... 编码 ...
git commit -m "feat: implement xxx"
git push origin feature/xxx

# 2. 创建PR并触发CI
PR_NUMBER=$(gh pr create --title "feat: XXX" --body "..." --json number -q .number)
gh workflow run ci.yml --ref feature/xxx
gh workflow run e2e.yml --ref feature/xxx

# 3. 监控CI (等待30秒后开始)
sleep 30
bash scripts/ai-monitor-ci.sh "$PR_NUMBER" 600

# 4. 根据结果决定下一步
if [ $? -eq 0 ]; then
  echo "✅ CI passed - ready to merge"
  gh pr merge "$PR_NUMBER" --squash
else
  echo "❌ CI failed - review logs and fix issues"
  gh pr view "$PR_NUMBER" --web
fi
```

### 关键注意事项

1. **必须等待30秒**: GitHub webhook处理需要时间
2. **使用 `gh pr checks`**: 最可靠的获取PR状态的方式
3. **设置超时**: 避免无限等待 (推荐10-15分钟)
4. **错误处理**: 检查 `gh` 命令返回值，处理网络错误
5. **日志查看**: 失败时立即使用 `gh run view --log-failed` 查看原因

---

## 故障排查

### 问题1: `gh pr checks` 返回 "no checks reported"

**原因**: Workflows尚未启动或分支没有关联PR

**解决**:
```bash
# 检查workflow是否在运行
gh run list --branch <branch> --limit 5

# 如果没有runs，手动触发
gh workflow run ci.yml --ref <branch>
```

### 问题2: Workflow触发但未关联到PR

**原因**: Workflow在PR创建之前就完成了

**解决**:
```bash
# 重新触发workflow
gh workflow run ci.yml --ref <branch>
gh workflow run e2e.yml --ref <branch>
```

### 问题3: 长时间无响应

**原因**: GitHub Actions队列繁忙或runner启动慢

**解决**:
```bash
# 查看workflow queue状态
gh run list --limit 10

# 查看具体run的详情
gh run view <RUN_ID>

# 如果确实卡住，取消并重试
gh run cancel <RUN_ID>
gh workflow run ci.yml --ref <branch>
```

---

## 总结

**推荐方案**: 方案1 (workflow_dispatch) + 监控脚本

**完整AI工作流**:
1. ✅ 开发代码并推送到feature分支
2. ✅ 创建PR: `gh pr create`
3. ✅ 手动触发workflows: `gh workflow run ci.yml --ref <branch>`
4. ✅ 等待30秒: `sleep 30`
5. ✅ 监控状态: `gh pr checks <PR_NUMBER>` 或使用监控脚本
6. ✅ 根据结果决定merge或修复

**时间成本**: 创建PR (5s) + 触发workflows (5s) + 等待启动 (30s) + 等待完成 (2-5分钟) = **约3-6分钟**
