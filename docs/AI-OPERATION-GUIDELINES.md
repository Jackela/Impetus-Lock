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

## 3. AI Agent操作约束

### ✅ 允许的操作
- 创建feature分支
- 提交代码到feature分支
- 创建Pull Request
- 运行测试

### ❌ 禁止的操作
- 直接推送到main分支
- 强制合并未通过CI的PR
- 删除main分支
- 修改branch保护规则

### 🔍 代码审查要求
- 所有AI生成的代码必须经过CI测试
- 关键文件变更需要人工审查
- 架构变更必须文档化

## 4. 应急措施

如果AI操作出现问题:
1. 立即停止相关操作
2. 在GitHub上锁定受影响的分支
3. 人工review所有未合并的PR
4. 必要时回滚到稳定版本

---

_创建时间: 2026-02-26_
_目的: 防止AI自动化操作造成不可逆的破坏_
