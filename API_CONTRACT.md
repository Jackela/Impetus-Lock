# Impetus Lock - API Contract (SSOT)

**Version:** 2.0.0  
**Protocol:** OpenAPI 3.0.3  
**Description:** 对抗式 AI Agent 的核心 API。通过幂等键和锚点保证 Vibe 的健壮性。

---

## 📋 契约概述 | Contract Overview

本文档是 **Impetus Lock 后端 API 的唯一真相源（SSOT）**。所有客户端和服务端实现必须严格遵循此契约。

**核心设计原则 | Core Design Principles:**

1. **幂等性保证 | Idempotency Guarantee**  
   通过 `Idempotency-Key` header 确保同一行动不会重复执行

2. **锚点系统 | Anchor System**  
   使用 `lock_id` 和 `anchor` 定位文档中的稳定位置，抵抗并发编辑

3. **强类型输出 | Strongly-Typed Outputs**  
   所有响应通过 Pydantic + Instructor 生成，无原始字符串

4. **版本化契约 | Versioned Contract**  
   通过 `X-Contract-Version` header 支持灰度发布和回滚

---

## 🌐 服务器配置 | Server Configuration

```yaml
Production:  /  (相对路径，便于网关代理)
Development: http://127.0.0.1:8000/
```

---

## 🔌 核心端点 | Core Endpoints

### 1. Health Check

**`GET /health`**

健康检查端点，用于监控和负载均衡。

**Response: 200 OK**
```json
{
  "status": "ok",
  "service": "impetus-lock",
  "version": "0.1.0"
}
```

---

### 2. Generate Intervention (核心端点)

**`POST /impetus/generate-intervention`**

这是项目的**核心端点**。客户端调用此端点，告知 Agent 当前的模式和上下文。Agent（后端）将决策并返回一个具体的行动。

---

#### 📥 Request Headers

| Header | Required | Type | Description |
|--------|----------|------|-------------|
| `Idempotency-Key` | ✅ | string (UUID) | 请求幂等键。相同 key 在冷却窗口内返回相同结果 |
| `X-Contract-Version` | ✅ | string | 客户端契约版本（必须等于 "2.0.0"） |
| `Content-Type` | ✅ | string | 必须为 `application/json` |

**Idempotency-Key 规范:**
- 格式：UUID v4 (例如 `550e8400-e29b-41d4-a716-446655440000`)
- 长度：8-64 字符
- 冷却窗口：15 秒（相同 key 在 15 秒内返回缓存结果）

---

#### 📥 Request Body

**Schema: `InterventionRequest`**

```json
{
  "context": "他打开门,犹豫着要不要进去。",
  "mode": "muse",
  "mock": false,
  "client_meta": {
    "doc_version": 42,
    "selection_from": 1234,
    "selection_to": 1234
  }
}
```

**字段说明 | Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string | ✅ | 光标前最后 N 句话。服务端不持久化原文 |
| `mode` | enum | ✅ | `"muse"` 或 `"loki"` |
| `mock` | boolean | ❌ | 是否使用模拟数据（用于测试），默认 `false` |
| `client_meta` | object | ✅ | 客户端编辑器的当前状态，用于后端决策 |
| `client_meta.doc_version` | integer | ✅ | ProseMirror 文档版本号 (≥0) |
| `client_meta.selection_from` | integer | ✅ | 选区起始位置 (≥0) |
| `client_meta.selection_to` | integer | ✅ | 选区结束位置 (≥0) |

**Mode 说明:**
- **`muse`**: Agent 在检测到 STUCK 状态时触发（例如 60 秒无输入）
- **`loki`**: Agent 随机触发，无论用户是否在写作

---

#### 📤 Response: 200 OK

**Schema: `InterventionResponse`**

```json
{
  "action": "provoke",
  "content": "门后是一堵砖墙。",
  "source": "muse",
  "action_id": "act_01j4z3m8a6q3qz2x8j4z3m8a",
  "issued_at": "2025-01-15T10:30:45.123Z",
  "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8b",
  "anchor": {
    "type": "pos",
    "from": 1234
  }
}
```

**字段说明 | Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | enum | ✅ | `"provoke"` / `"delete"` / `"rewrite"` |
| `content` | string | ⚠️ | 纯文本内容（`provoke`/`rewrite` 必填；`delete` 为空） |
| `source` | enum | ✅ | `"muse"` 或 `"loki"` |
| `action_id` | string | ✅ | 服务端生成的行动唯一 ID (UUID)，用于幂等和审计 |
| `issued_at` | string (ISO 8601) | ✅ | 行动发出时间 |
| `lock_id` | string | ⚠️ | 锁 ID (UUID)，用于前端事务拦截（仅 `provoke`/`rewrite` 时存在） |
| `anchor` | object | ⚠️ | 目标锚点（`delete`/`rewrite` 必填，`provoke` 可选） |

**Response Headers:**

| Header | Type | Description |
|--------|------|-------------|
| `X-Cooldown-Seconds` | integer | 建议在多少秒后再次触发 Loki（Muse 可忽略） |

---

#### 📤 Action Types (行动类型)

##### 1. **PROVOKE** (注入约束)

当 `action="provoke"` 时，响应包含**纯文本**提示，客户端自行渲染为引用块：

```json
{
  "action": "provoke",
  "content": "你的主角此时必须对黑市宣誓效忠。",
  "source": "muse",
  "action_id": "act_01j4z3m8a6q3qz2x8j4z3m8a",
  "issued_at": "2025-01-15T10:30:45.123Z",
  "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8b"
}
```

**客户端处理流程:**
1. 在光标位置插入 `content`（可包裹为 `> content` 以保持 Markdown 引用）
2. 为插入的内容打上 `lock_id` 标记
3. 在 ProseMirror `filterTransaction` 中拦截删除此 `lock_id` 的操作
4. 用户无法通过 Backspace/Delete/Undo 删除此内容

---

##### 2. **DELETE** (删除内容)

当 `action="delete"` 时，响应包含：

```json
{
  "action": "delete",
  "source": "loki",
  "action_id": "act_01j4z3m8a6q3qz2x8j4z3m8a",
  "issued_at": "2025-01-15T10:31:12.456Z",
  "anchor": {
    "type": "range",
    "from": 1245,
    "to": 1289
  }
}
```

**Anchor Types (锚点类型):**

| Type | Fields | Description |
|------|--------|-------------|
| `pos` | `{ "type": "pos", "from": 1250 }` | 单点位置 |
| `range` | `{ "type": "range", "from": 1245, "to": 1289 }` | 位置范围 |
| `lock_id` | `{ "type": "lock_id", "ref_lock_id": "lock_xxx" }` | 引用已存在的锁 ID |

> **Current implementation:** 服务端对 `delete`/`rewrite` 行动要求 `range` 锚点；`lock_id`/`pos` 锚点当前不会通过验证，需要先在服务端/客户端支持后再使用。

**客户端处理流程:**
1. 根据 `anchor.type` 定位文档位置
2. 删除指定范围的内容
3. 操作**绕过** Undo 栈（用户无法撤销）

---

##### 3. **REWRITE** (替换约束)

`rewrite` 是一种“局部 provoke”：将目标句子替换为新的、立即锁定的文本。

```json
{
  "action": "rewrite",
  "content": "他所有的技能其实来自名为“洛基”的黑客。",
  "source": "loki",
  "lock_id": "lock_rewrite_01xx",
  "anchor": {
    "type": "range",
    "from": 1380,
    "to": 1412
  }
}
```

**客户端处理流程:**
1. 使用 `anchor` 删除旧文本
2. 插入 `content`，并附加 `lock_id`
3. 触发与 Provoke 相同的锁定与视觉反馈逻辑

---

#### ❌ Error Responses

##### 400 Bad Request

**场景:** 无效输入（语义错误，例如锚点不存在或上下文非法）

```json
{
  "detail": "Anchor lock_id 'lock_xxx' does not exist in current document"
}
```

---

##### 422 Unprocessable Entity

**场景:** 请求体验证失败（Pydantic 字段级错误）

```json
{
  "detail": [
    {
      "loc": ["body", "mode"],
      "msg": "Input should be 'muse' or 'loki'",
      "type": "enum"
    }
  ]
}
```

---

##### 429 Too Many Requests

**场景:** 触发限流或冷却

```json
{
  "detail": "Rate limit exceeded. Please wait 15 seconds."
}
```

**Response Headers:**

| Header | Type | Description |
|--------|------|-------------|
| `Retry-After` | integer | 客户端需要等待多少秒才能再次请求 |

---

##### 500 Internal Server Error

**场景:** 服务端内部错误（例如 LLM API 调用失败）

```json
{
  "detail": "LLM provider error: timeout after 30s"
}
```

---

## 🔐 幂等性设计 | Idempotency Design

### 幂等键工作原理

1. **客户端生成 UUID:**  
   ```javascript
   const idempotencyKey = crypto.randomUUID(); // 例如 "550e8400-e29b-41d4-a716-446655440000"
   ```

2. **首次请求:**  
   服务端处理请求，生成 `action_id` 和响应，并缓存 `(idempotency_key → response)` 映射（15 秒 TTL）

3. **重复请求（15 秒内）:**  
   服务端检测到相同 `Idempotency-Key`，直接返回缓存的响应（无副作用）

4. **冷却期后:**  
   缓存过期，服务端视为新请求

### 使用场景

- **网络重试:** 客户端可安全重试失败的请求
- **防止重复行动:** 避免用户快速点击触发多次 Loki 删除
- **审计追踪:** 每个 `action_id` 对应唯一的幂等键

---

## 🎯 锚点系统设计 | Anchor System Design

### 为什么需要锚点？

ProseMirror 文档是**可变的**（用户不断编辑），绝对位置（如 `pos: 1250`）会随着前面的内容变化而失效。

**锚点系统解决方案:**
- **PROVOKE 行动:** 使用 `lock_id` 标记注入的内容，即使文档变化，锁依然可追踪
- **DELETE 行动:** 使用 `anchor.type="lock_id"` 引用之前注入的锁，精准定位删除目标

### 锚点类型详解

#### 1. Position Anchor (pos)

```json
{
  "type": "pos",
  "from": 1250
}
```

**适用场景:** 删除光标附近的内容（例如最后一句话）  
**风险:** 如果用户在前面插入/删除内容，位置会失效  
**推荐:** 仅用于**立即执行**的删除操作

---

#### 2. Range Anchor (range)

```json
{
  "type": "range",
  "from": 1245,
  "to": 1289
}
```

**适用场景:** 删除一段连续文本  
**风险:** 同 `pos` 类型，位置可能失效  
**推荐:** 客户端应在执行前验证范围有效性

---

#### 3. Lock ID Anchor (lock_id)

```json
{
  "type": "lock_id",
  "ref_lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8b"
}
```

**适用场景:** 删除之前 Muse/Loki 注入的**不可删除内容**（Loki 的"恶作剧"）  
**优势:** `lock_id` 通过 ProseMirror Decoration 跟踪，不受文档变化影响  
**推荐:** **首选**锚点类型，最稳定

---

## 🧪 测试用例 | Test Cases

### 1. Muse Mode - PROVOKE

**Request:**
```bash
curl -X POST http://localhost:8000/impetus/generate-intervention \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "context": "他打开门,犹豫着要不要进去。",
    "mode": "muse",
    "client_meta": {
      "doc_version": 42,
      "selection_from": 1234,
      "selection_to": 1234
    }
  }'
```

**Expected Response (200 OK):**
```json
{
  "action": "provoke",
  "content": "门后传来低沉的呼吸声。",
  "source": "muse",
  "action_id": "act_01j4z3m8a6q3qz2x8j4z3m8a",
  "issued_at": "2025-01-15T10:30:45.123Z",
  "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8b",
  "anchor": {"type": "pos", "from": 1234}
}
```

---

### 2. Loki Mode - DELETE

**Request:**
```bash
curl -X POST http://localhost:8000/impetus/generate-intervention \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 660e8400-e29b-41d4-a716-446655440001" \
  -d '{
    "context": "他打开门,犹豫着要不要进去。突然,门后传来脚步声。",
    "mode": "loki"
  }'
```

**Expected Response (200 OK):**
```json
{
  "action": "delete",
  "source": "loki",
  "action_id": "act_01j4z3m8a6q3qz2x8j4z3m8c",
  "issued_at": "2025-01-15T10:31:12.456Z",
  "anchor": {
    "type": "range",
    "from": 1289,
    "to": 1310
  }
}
```

**Response Headers:**
```
X-Cooldown-Seconds: <30-120 derived from Idempotency-Key>
```

---

### 3. Idempotency - 重复请求

**Request 1:**
```bash
curl -X POST http://localhost:8000/impetus/generate-intervention \
  -H "Idempotency-Key: 770e8400-e29b-41d4-a716-446655440002" \
  -H "Content-Type: application/json" \
  -d '{"context": "测试", "mode": "muse"}'
```

**Request 2 (15 秒内，相同 Idempotency-Key):**
```bash
curl -X POST http://localhost:8000/impetus/generate-intervention \
  -H "Idempotency-Key: 770e8400-e29b-41d4-a716-446655440002" \
  -H "Content-Type: application/json" \
  -d '{"context": "测试", "mode": "muse"}'
```

**Expected Behavior:**  
两次请求返回**完全相同**的响应（包括 `action_id`, `issued_at`, `lock_id`）

---

### 4. Validation Error - 422

**Request (无效 mode):**
```bash
curl -X POST http://localhost:8000/impetus/generate-intervention \
  -H "Idempotency-Key: 880e8400-e29b-41d4-a716-446655440003" \
  -H "Content-Type: application/json" \
  -d '{"context": "测试", "mode": "chaos"}'
```

**Expected Response (422):**
```json
{
  "detail": [
    {
      "loc": ["body", "mode"],
      "msg": "Input should be 'muse' or 'loki'",
      "type": "enum"
    }
  ]
}
```

---

## 🔄 版本管理 | Version Management

### 契约版本历史

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-12-04 | 严格契约验证（必填且精确匹配） |

### 客户端版本协商

客户端通过 `X-Contract-Version` header 声明其理解的契约版本：

```bash
curl -H "X-Contract-Version: 2.0.0" ...
```

**服务端行为:**
- 如果客户端版本 < 服务端最低支持版本 → 返回 `426 Upgrade Required`
- 如果客户端版本 > 服务端版本 → 返回 `200` 并使用当前版本
- 如果未提供版本 → 默认使用最新版本

---

## 📊 监控与可观测性 | Monitoring & Observability

### 关键指标

**请求指标:**
- `impetus_intervention_requests_total` (Counter) - 按 mode 和 action 分组
- `impetus_intervention_duration_seconds` (Histogram) - 响应时间分布
- `impetus_idempotency_cache_hit_rate` (Gauge) - 幂等缓存命中率

**错误指标:**
- `impetus_errors_total` (Counter) - 按 HTTP 状态码分组
- `impetus_llm_failures_total` (Counter) - LLM API 调用失败数

**业务指标:**
- `impetus_provoke_count` (Counter) - PROVOKE 行动计数
- `impetus_delete_count` (Counter) - DELETE 行动计数
- `impetus_average_cooldown_seconds` (Gauge) - 平均冷却时间

---

## 🚨 紧急恢复 | Emergency Recovery

### Revert Token 使用

（撤销功能暂未开放，仅保留后台审计日志。）

**使用场景:**
- Agent 误删重要内容
- 需要审计某次行动的原始数据
- 紧急回滚"恶作剧"行动

**存储位置:**
- 后端数据库（例如 Redis）
- 保留 7 天，自动过期

---

## 🗂️ 任务持久化 API

用于在前端会话之间保存文稿内容与锁信息，支持乐观锁更新与审计历史。

### 1) Create Task — `POST /tasks`
- Body: `TaskCreateRequest`（`content`, 可选 `lock_ids`）
- Response: `201 Created` → `TaskResponse`（包含 `id`, `version`）

### 2) Get Task — `GET /tasks/{task_id}`
- Response: `200 OK` → `TaskResponse`
- Errors: `404`（不存在）

### 3) Update Task — `PUT /tasks/{task_id}`
- Body: `TaskUpdateRequest`（`content`, `lock_ids`, `version`）
- Response: `200 OK` → `TaskResponse`
- Errors: `404`（不存在）, `409`（版本冲突，需先 GET 最新）

### 4) Delete Task — `DELETE /tasks/{task_id}`
- Response: `204 No Content`
- Errors: `404`（不存在）

### 5) List Actions — `GET /tasks/{task_id}/actions?limit&offset`
- Response: `200 OK` → `InterventionHistoryResponse`（`total`, `limit`, `offset`, `actions[]`）
- `actions[].anchor` 复用 `Anchor` 枚举，数值字段保持整数类型
- Errors: `404`（任务不存在）

### Schema 摘要
- `TaskResponse`: `id` (uuid), `content` (string), `lock_ids` (string[]), `created_at`, `updated_at` (ISO 8601), `version` (int)
- `InterventionActionResponse`: `action_type` (`provoke`/`delete`/`rewrite`), `lock_id?`, `content?`, `anchor` (Anchor), `mode` (`muse`/`loki`), `context`, `issued_at`, `created_at`
- `InterventionHistoryResponse`: `total`, `limit`, `offset`, `actions[]`

---

## 📝 附录 | Appendix

### OpenAPI 3.0.3 完整规范

完整的 OpenAPI YAML 规范存储在 `.specify/openapi.yaml`，可用于：
- 自动生成 FastAPI Pydantic 模型
- 生成客户端 SDK (TypeScript, Python)
- Postman/Insomnia 导入
- API 文档自动生成

**导出命令:**
```bash
# 从 FastAPI 自动生成 OpenAPI JSON
curl http://localhost:8000/openapi.json > .specify/openapi.json

# 使用 yq 转换为 YAML
yq -P '.specify/openapi.json' > .specify/openapi.yaml
```

---

## ✅ 契约验证清单 | Contract Validation Checklist

在实现 API 端点时，确保：

- [ ] 所有响应字段与契约完全匹配（无额外字段）
- [ ] Pydantic 模型与 OpenAPI schema 一致
- [ ] Idempotency-Key 在 15 秒窗口内生效
- [ ] 所有错误响应使用正确的 HTTP 状态码
- [ ] `action_id`, `lock_id` 使用 UUID 格式
- [ ] `issued_at` 使用 ISO 8601 格式（带时区）
- [ ] DELETE 行动必须包含 `anchor` 字段
- [ ] PROVOKE 行动必须包含 `content` 和 `lock_id` 字段
- [ ] 所有 LLM 输出通过 Instructor + Pydantic 验证
- [ ] Rate limiting 返回 `Retry-After` header

---

**Last Updated:** 2025-01-15  
**Maintainer:** Impetus Lock Core Team  
**Contact:** <team@impetus-lock.dev>

---

## 实现现状速记（2025-xx）

- 版本协商：服务端仅接受 `X-Contract-Version: 2.0.0`，缺失或不匹配会返回 422 `ContractVersionMismatch`。
- 冷却头：服务端在 Loki 响应中返回 `X-Cooldown-Seconds`，值由 Idempotency-Key 决定且落在 30-120 秒范围内，确保缓存命中时保持一致。
- 锚点约束：服务端验证要求 `delete`/`rewrite` 仅使用 `range` 锚点；`lock_id`/`pos` 目前会被拒绝。
- Muse 安全护栏：Muse 模式收到 `delete` 响应会在服务端转写为 `provoke/rewrite` 并附带新 `lock_id`，避免 Muse 删除内容。
- 短文档保护：服务端在 context <50 字时会强制改写为 `provoke`，与“全文 <50 字不删除”原则接近但基于上下文长度。
