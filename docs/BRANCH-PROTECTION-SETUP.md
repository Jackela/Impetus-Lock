# Branch Protection配置指南

## GitHub设置步骤

### 1. Main Branch保护
```
Settings → Branches → Add Rule
```

配置:
- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - Required approvals: 1
- ✅ Require status checks to pass before merging
  - Status checks: `E2E Tests`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators

### 2. 强制性检查
必须通过的CI测试:
- Backend unit tests (80/80)
- E2E Playwright tests (82/82)
- Type checking
- Linting

### 3. Code Owners设置
创建 `.github/CODEOWNERS`:
```
* @Jackela
/server/ @Jackela
/client/ @Jackela
/docs/ @Jackela
```

## 本项目规则 (AI Agent约束)

### 自动化检查
- 每个PR自动触发GitHub Actions
- AI不得跳过CI检查
- 失败的PR不得合并

### 代码审查
- 所有AI生成的代码必须有commit message说明
- 重大架构变更需要额外文档
- 测试覆盖率不得降低

---

_参考: 2026-02-26 Sprint最佳实践_
