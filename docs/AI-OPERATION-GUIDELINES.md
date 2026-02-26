# AI操作规范指南

## 1. Branch保护规则

### Main Branch (主分支)
- ✅ **强制PR审核**: 所有合并必须通过Pull Request
- ✅ **禁止直接推送**: 不允许直接推送到main
- ✅ **必须通过CI**: 所有PR必须通过GitHub Actions测试
- ✅ **代码所有者审核**: 至少1位reviewer批准

### Feature Branches (功能分支)
- 命名规范: `feature/功能名称` 或 `fix/问题描述`
- 必须从main创建
- 完成后通过PR合并回main

## 2. Gitflow工作流

```
main (受保护)
  ↑
feature/xxx (开发中)
  ↑
develop (集成分支)
```

### 标准流程
1. 从main创建feature分支
2. 开发完成后创建PR
3. 等待CI通过 + 代码审查
4. 合并到main

## 3. AI自主审查工作流

### 工作流程
```
1. AI创建feature分支 → 2. 开发并测试 → 3. 创建PR → 4. 等待CI → 5. AI审查CI结果 → 6. 合并
```

### ✅ AI自动合并条件（全部满足）
- ✅ 所有CI检查通过（Backend Tests, Frontend Tests, Type Check, Lint, E2E Tests）
- ✅ 代码符合项目规范
- ✅ 没有破坏性变更
- ✅ 测试覆盖率不降低

### ✅ 允许的操作
- 创建feature分支
- 提交代码到feature分支
- 创建Pull Request
- 运行测试
- **审查CI结果并合并PR**（只要所有CI通过）

### ❌ 禁止的操作
- 直接推送到main分支
- 强制合并未通过CI的PR
- 删除main分支
- 降低测试覆盖率
- 跳过CI检查

### 🔍 AI审查流程
1. 检查所有CI状态（必须全部SUCCESS）
2. 审查代码变更（确保符合规范）
3. 验证测试结果（不降低覆盖率）
4. 如果全部通过 → 自动合并
5. 如果有失败 → 修复或关闭PR

## 4. 应急措施

如果AI操作出现问题:
1. 立即停止相关操作
2. 在GitHub上锁定受影响的分支
3. 人工review所有未合并的PR
4. 必要时回滚到稳定版本

---

_创建时间: 2026-02-26_
_目的: 防止AI自动化操作造成不可逆的破坏_
