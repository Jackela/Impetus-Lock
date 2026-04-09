# US-002: 云端任务同步 (精简版)

## 原始需求

**US-002**: 作为用户，我希望任务数据存储在云端，多设备同步

> 当前任务仅存储在 localStorage，用户无法跨设备访问，数据也容易丢失。

---

## PO 详情

### 用户故事

**作为** 一个多设备使用 Impetus Lock 的用户  
**我希望** 我的任务自动同步到云端  
**从而** 我可以在任何设备上继续我的写作工作

### 验收标准

1. **AC1**: 登录后自动加载云端任务列表
2. **AC2**: 任务变更自动同步到云端（防抖 2s）
3. **AC3**: 离线时本地缓存，联网后自动同步
4. **AC4**: 冲突时保留最新版本（基于 updatedAt）
5. **AC5**: 登出后本地数据清空，保护隐私

### 边界情况

| 场景 | 预期行为 |
|------|----------|
| 网络中断 | 本地继续编辑，恢复后自动同步 |
| 多设备同时编辑 | 最后保存者获胜 |
| 令牌过期 | 自动刷新或跳转登录 |
| 服务端删除 | 本地跟随删除 |

---

## Tech Lead 评估

### 推荐方案: 用户认证 + PostgreSQL + REST API

**架构**:
```
Frontend (React Query) 
  ↓
API Client (Axios + 拦截器)
  ↓
Backend (FastAPI + JWT)
  ↓
PostgreSQL (tasks table)
```

**工作量**: 8 小时
- 后端 API: 3h (CRUD + auth)
- 前端集成: 3h (React Query + 乐观更新)
- 测试: 2h

### 关键问答

**Tech Lead**: 最简实现是什么？
> 复用现有 FastAPI 后端，添加 JWT 认证中间件， tasks 表已设计好。

**PO**: 不做这个功能用户还能用吗？
> **能**，但仅单设备，数据不安全。建议 P1 而非 P0。

---

## 精简需求

### IN 范围
- JWT 登录/注册 API
- 任务 CRUD API（带用户隔离）
- React Query 集成（自动同步）
- 离线缓存 + 恢复同步

### OUT 范围
- 实时 WebSocket 同步
- 复杂冲突解决 UI
- 数据导出/导入
- 社交功能

### 数据库 Schema

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    lock_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 任务拆分

1. **T1**: 后端认证 API (2h)
2. **T2**: 后端任务 CRUD API (2h)
3. **T3**: 前端 React Query 集成 (2h)
4. **T4**: 测试 (2h)

**总计**: 8 小时
