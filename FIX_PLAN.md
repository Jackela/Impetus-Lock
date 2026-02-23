# CI 修复计划

## 问题分析

### 现状
- ✅ Backend Tests: PASS
- ✅ Lint: PASS
- ✅ Type Check: PASS
- ❌ Frontend Tests: FAIL (lock file 跨平台依赖缺失)
- ❌ Playwright E2E Tests: FAIL (同样问题)

### 根因
`package-lock.json` 在 Windows 本地生成，缺少 Linux 平台的可选依赖：
- `@esbuild/*` 各平台包
- `@rollup/*` 各平台包
- `fsevents` (macOS 专用)

当 CI (Ubuntu) 运行 `npm install` 时，lock file 中找不到这些平台的依赖，导致失败。

---

## 修复方案

### 方案 1: 使用 npm ci --legacy-peer-deps (推荐)

修改 CI workflow，让 Frontend Tests 也使用 `--legacy-peer-deps` 标志。

**优点**:
- 保持一致性
- 解决 peer dependency 冲突
- 不需要修改 lock file

**缺点**:
- 可能需要调整 npm 配置

### 方案 2: 使用 actions/setup-node 的 cache 配置

确保 CI 使用正确的缓存策略，避免 lock file 严格检查。

### 方案 3: 添加 .npmrc 配置

添加项目级别的 npm 配置，统一所有环境的安装行为。

---

## 执行步骤

### Phase 1: 添加 .npmrc 配置

创建 `client/.npmrc` 文件：
```
legacy-peer-deps=true
lockfile-version=3
```

### Phase 2: 更新 CI workflow

统一所有 job 使用 `npm ci`（有了 .npmrc 后不需要 --legacy-peer-deps 参数）

### Phase 3: 重新生成 lock file

在 Windows 上重新生成包含所有平台依赖的 lock file：
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

### Phase 4: 本地验证

运行完整检查：
```bash
cd client
npm run lint
npm run type-check
npm run test
```

### Phase 5: 提交并监控 GA

---

## 备选方案

如果上述方案无效，考虑：

1. **使用 npm install 代替 npm ci**
   - 已实施，但 Frontend Tests job 仍有问题

2. **分离平台特定依赖**
   - 将可选依赖标记为 `optionalDependencies`

3. **使用 Docker 统一环境**
   - 长期方案，当前不实施

---

## 预期结果

修复后所有检查应该通过：
- ✅ Backend Tests
- ✅ Frontend Tests
- ✅ Lint
- ✅ Type Check
- ✅ Playwright E2E Tests
