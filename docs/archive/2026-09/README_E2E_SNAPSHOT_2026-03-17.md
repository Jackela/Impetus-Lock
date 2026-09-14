## 🧪 端到端测试报告

### 历史测试快照 (2026-03-17)

以下结果是 2026-03-17 的记录，保留用于历史追踪，不代表当前测试状态。

**测试范围**: 全功能端到端测试（真实 API 调用）  
**测试工具**: Playwright E2E 测试套件  
**测试环境**: WSL2 / Linux / Chromium

| 指标     | 数值               |
| -------- | ------------------ |
| 总测试数 | **121**            |
| 通过     | **107** ✅ (88.4%) |
| 失败     | **9** ❌           |
| 跳过     | **5** ⚪           |

### ✅ 核心功能验证通过

- ✅ **编辑器**: 渲染、编辑、Markdown格式化正常
- ✅ **模式系统**: Off/Muse/Loki 三种模式可切换
- ✅ **手动触发**: "I'm stuck!" 按钮调用 API 成功 (返回200)
- ✅ **锁定机制**: AI内容无法删除（震动+Bonk声音反馈）
- ✅ **感官反馈**: Glitch动画、Clank声音、Bonk声音正常工作
- ✅ **API健康检查**: `/health` 返回200正常
- ✅ **响应式设计**: 移动端(375px)、平板(768px)、桌面(1024px)正常
- ✅ **欢迎模态框**: 首次访问引导、快捷键(?)、偏好持久化
- ✅ **键盘快捷键**: Alt+T, ?, ESC 正常工作

### ⚠️ 已知问题

#### 数据库连接配置 (开发环境问题)

**当时状态**: 任务管理功能暂时不可用
**影响**: 9个测试失败（全部与数据库相关）

**错误信息**:

```
ConnectionRefusedError: [Errno 111] Connection refused
asyncpg.exceptions.InvalidPasswordError: password authentication failed
```

**修复方案**:

```bash
# 1. 启动 PostgreSQL 容器
docker run -d \
  --name impetus-lock-db \
  -e POSTGRES_USER=impetus \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=impetus_lock \
  -p 5432:5432 \
  postgres:15-alpine

# 2. 修改 pg_hba.conf 允许本地连接
docker exec impetus-lock-db su postgres -c \
  "sed -i 's/scram-sha-256/trust/g' /var/lib/postgresql/data/pg_hba.conf && \
   pg_ctl reload"

# 3. 运行数据库迁移
cd server
poetry run alembic upgrade head

# 4. 重新测试
cd client
npx playwright test database-persistence.spec.ts
```

**说明**: 这不是代码缺陷，是 WSL2 + Docker 网络配置问题。修复后预计测试通过率可达 **98%+**。

### 运行测试

```bash
# 启动服务
./scripts/dev-start.sh

# 运行所有 E2E 测试
cd client
npx playwright test

# 运行特定测试
npx playwright test smoke.spec.ts

# 查看测试报告
npx playwright show-report
```

### 🎥 Record Demo

```bash
./scripts/record-demo.sh  # Generates demo-artifacts/impetus-lock-demo.webm
```
