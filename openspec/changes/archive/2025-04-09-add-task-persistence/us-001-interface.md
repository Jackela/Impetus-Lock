# US-001: 任务本地持久化 - 接口定义

## 概述

本文档定义 US-001 的 TypeScript 接口契约，基于 localStorage 纯前端方案。

## 核心决策

- **存储位置**: localStorage (`impetus_tasks_v1`)
- **序列化**: JSON.stringify/parse
- **并发策略**: 最后写入者获胜
- **版本策略**: 不兼容时清空重置

## TypeScript Types

### StoredTask

前端存储的任务结构（简化版 TaskRecord）：

```typescript
interface StoredTask {
  id: string;           // 唯一标识
  title: string;        // 任务标题（内容第一行）
  content: string;      // Markdown 内容
  lockIds: string[];    // 锁定标记ID数组
  createdAt: number;    // 创建时间戳（Unix ms）
  updatedAt: number;    // 更新时间戳（Unix ms）
}
```

### TaskStorage

localStorage 根结构：

```typescript
interface TaskStorage {
  version: 1;                    // 存储格式版本
  tasks: StoredTask[];           // 任务数组
  currentTaskId: string | null;  // 当前选中任务ID
}
```

### StorageError

存储错误类型：

```typescript
type StorageErrorType =
  | "quota_exceeded"    // 存储空间不足
  | "version_mismatch"  // 版本不兼容
  | "parse_error"       // JSON解析失败
  | "unavailable"       // localStorage不可用
  | "unknown";          // 未知错误

class StorageError extends Error {
  type: StorageErrorType;
}
```

### StorageStatus

存储状态：

```typescript
type StorageStatus = "loading" | "ready" | "error";
```

## Hook Interface

### useTaskStorage 返回值

```typescript
interface TaskStorageState {
  tasks: StoredTask[];           // 任务列表（按updatedAt倒序）
  currentTaskId: string | null;  // 当前任务ID
  status: StorageStatus;         // 加载状态
  error: StorageError | null;    // 错误信息
  actions: TaskStorageActions;   // 操作函数包
}
```

### TaskStorageActions

操作函数打包对象（满足 Hook 返回值 ≤5 属性约束）：

```typescript
interface TaskStorageActions {
  addTask: (content: string, lockIds?: string[]) => StoredTask;
  updateTask: (id: string, updates: Partial<Omit<StoredTask, "id" | "createdAt">>) => void;
  deleteTask: (id: string) => void;
  setCurrentTask: (id: string | null) => void;
}
```

## 函数签名详解

### addTask

创建新任务并持久化。

```typescript
addTask(content: string, lockIds?: string[]): StoredTask
```

- **参数**: `content` 必填, `lockIds` 可选（默认空数组）
- **返回**: 创建的 StoredTask（包含生成的 id 和时间戳）
- **副作用**: 自动写入 localStorage

### updateTask

更新现有任务。

```typescript
updateTask(id: string, updates: Partial<Omit<StoredTask, "id" | "createdAt">>): void
```

- **参数**: `id` 目标任务, `updates` 可更新字段（title/content/lockIds/updatedAt）
- **约束**: 自动更新 `updatedAt` 为当前时间
- **错误**: id 不存在时静默忽略

### deleteTask

删除任务。

```typescript
deleteTask(id: string): void
```

- **参数**: 要删除的任务ID
- **副作用**: 如删除的是 currentTaskId，自动置为 null
- **错误**: id 不存在时静默忽略

### setCurrentTask

切换当前任务。

```typescript
setCurrentTask(id: string | null): void
```

- **参数**: 任务ID 或 null（取消选择）
- **副作用**: 自动写入 localStorage

## 与现有代码的关系

### 与 TaskRecord 的转换

```typescript
// API TaskRecord -> StoredTask
function toStoredTask(record: TaskRecord): StoredTask {
  return {
    id: record.id,
    title: extractTitle(record.content),
    content: record.content,
    lockIds: record.lock_ids,
    createdAt: new Date(record.created_at).getTime(),
    updatedAt: new Date(record.updated_at).getTime(),
  };
}
```

### 与 useTaskSync 的协作

- `useTaskSync`: 负责与后端 API 同步当前编辑的任务
- `useTaskStorage`: 负责本地任务列表的持久化
- 两者独立，通过 `currentTaskId` 关联

## 边界情况处理

| 场景 | 行为 |
|------|------|
| localStorage 被禁用 | status="error", error.type="unavailable" |
| 存储空间不足 | status="error", error.type="quota_exceeded" |
| 版本不兼容 | 清空存储，返回空状态 |
| JSON 解析失败 | 清空存储，返回空状态 |
| 多标签页并发 | 最后写入者获胜（无冲突解决） |
| id 不存在时更新/删除 | 静默忽略 |

## Mid Dev Review 意见

1. **版本号**: 在 TaskStorage 根级别添加 `version: 1`，便于未来迁移检测
2. **时间戳**: 使用 number (Unix ms) 而非 ISO string，减少序列化开销
3. **错误类型**: 定义 StorageErrorType，与 useTaskSync 保持一致风格
4. **函数打包**: 操作函数打包为 `actions` 对象，满足 Hook 返回值 ≤5 属性约束
5. **参数约束**: 每个函数 ≤3 个参数，updateTask 使用 Partial 类型简化

## 文件位置

- 类型定义: `client/src/types/task.ts`
- Hook 骨架: `client/src/hooks/useTaskStorage.ts`
- 接口文档: `openspec/changes/add-task-persistence/us-001-interface.md`
