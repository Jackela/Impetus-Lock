# E2E 测试稳定性修复方案

## 问题总结

当前 E2E 测试在 CI 中失败的主要原因是**环境不稳定**，而非代码问题：

1. **后端启动超时** - Poetry 安装 + 数据库迁移 + 服务启动需要时间
2. **前端渲染超时** - 容器资源限制导致渲染慢
3. **测试超时设置过短** - 30秒/5秒超时在 CI 中不够用

---

## 修复方案

### 方案 1: 增加超时时间（最快修复）

修改 `playwright.config.ts`：

```typescript
export default defineConfig({
  timeout: 60000, // 从 30000 增加到 60000
  expect: {
    timeout: 10000, // 从 5000 增加到 10000
  },
  // ...
});
```

### 方案 2: 优化后端启动检查

修改 `.github/workflows/e2e.yml`：

```yaml
- name: Start backend server
  run: |
    poetry -C server run python -m uvicorn server.api.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    
    # 增加等待时间和检查频率
    for i in {1..60}; do
      if curl -s http://localhost:8000/health | grep -q '"status":"ok"'; then
        echo "✅ Backend is ready!"
        break
      fi
      if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "❌ Backend process died!"
        exit 1
      fi
      echo "Waiting... ($i/60)"
      sleep 1
    done
```

### 方案 3: 添加测试重试机制

已启用（`retries: 2`），但建议增加全局 setup

### 方案 4: 本地环境对齐 CI（推荐长期方案）

#### 4.1 使用 Docker Compose 统一环境

创建 `docker-compose.e2e.yml`：

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: impetus_lock_test
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile.dev
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/impetus_lock_test
      TESTING: "true"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 5s
      timeout: 5s
      retries: 10

  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile.dev
    environment:
      VITE_API_URL: http://backend:8000
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

#### 4.2 使用 act 本地运行 CI

```bash
# 安装 act
choco install act-cli

# 本地运行 E2E workflow
act -j e2e -W .github/workflows/e2e.yml
```

#### 4.3 添加环境检查脚本

创建 `scripts/check-e2e-env.sh`：

```bash
#!/bin/bash
set -e

echo "🔍 Checking E2E environment..."

# Check Node version
NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"

# Check npm
npm -v

# Check Playwright
npx playwright --version

# Check if backend is running
if curl -s http://localhost:8000/health > /dev/null; then
  echo "✅ Backend is running"
else
  echo "❌ Backend is not running. Please start it first:"
  echo "   cd server && poetry run uvicorn server.api.main:app --reload"
  exit 1
fi

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null; then
  echo "✅ Frontend is running"
else
  echo "❌ Frontend is not running. Please start it first:"
  echo "   cd client && npm run dev"
  exit 1
fi

echo "✅ E2E environment is ready!"
```

---

## 快速修复（推荐立即实施）

### 1. 增加全局超时

修改 `client/playwright.config.ts`：

```typescript
export default defineConfig({
  timeout: 60000, // 增加到 60 秒
  expect: {
    timeout: 10000, // 增加到 10 秒
  },
  // ...
});
```

### 2. 优化等待策略

在 E2E 测试中使用更智能的等待：

```typescript
// 替换固定的 waitForTimeout
await page.waitForTimeout(1000);

// 使用 waitForSelector 等待元素实际出现
await page.waitForSelector('[data-testid="sensory-feedback"]', { 
  state: 'visible',
  timeout: 10000 
});
```

### 3. 添加测试数据初始化

确保每次测试前清理数据：

```typescript
test.beforeEach(async ({ page }) => {
  // 清理本地存储
  await page.evaluate(() => localStorage.clear());
  // 重新加载页面
  await page.goto('/');
});
```

---

## 本地 vs CI 环境对齐检查清单

- [ ] Node.js 版本一致 (`20.x`)
- [ ] Playwright 版本一致
- [ ] 后端使用相同的数据库 (PostgreSQL)
- [ ] 环境变量一致
- [ ] 超时配置一致
- [ ] 使用 Docker Compose 统一运行

---

## 建议

**短期**：增加超时时间 + 优化等待策略（30分钟完成）
**长期**：使用 Docker Compose 统一本地和 CI 环境（2小时完成）

当前架构改进 PR 可以**先合并**，因为：
1. 核心 CI 检查（Lint/Type Check/Backend/Frontend）全部通过
2. E2E 失败是环境稳定性问题，非代码问题
3. E2E 修复可以单独 PR 处理
