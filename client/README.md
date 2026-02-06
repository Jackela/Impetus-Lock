# Impetus Lock Client

React + TypeScript + Vite frontend for Impetus Lock - an un-deletable task pressure system.

## 项目概述 | Project Overview

Impetus Lock 客户端使用现代 React 技术栈构建，提供流畅的 Markdown 编辑体验和对抗式 AI 干预功能。

- **Runtime**: React 19 with strict mode
- **Build Tool**: Vite 6 with HMR
- **Type System**: TypeScript strict mode (mandatory)
- **Editor**: Milkdown v7 + ProseMirror (WYSIWYG Markdown)
- **Animations**: Framer Motion
- **Testing**: Vitest + Playwright
- **Linting**: ESLint + @typescript-eslint (no-any allowed)

### 核心特性 | Core Features

- **Markdown 编辑器**: 基于 Milkdown 的所见即所得编辑器
- **Lock Enforcement**: AI 添加的内容不可删除（带抖动动画和音效）
- **Muse 模式**: 60 秒无输入时自动触发创意建议
- **Loki 模式**: 随机混乱干预（删除/重写）
- **Floating Toolbar**: 文本选中时显示格式化工具栏
- **Responsive**: 移动端适配（Bottom Docked Toolbar）

---

## 项目结构 | Project Structure

```
client/
├── src/
│   ├── components/             # React 组件
│   │   ├── Editor/             # 编辑器组件
│   │   │   ├── EditorCore.tsx      # 主编辑器 (Milkdown + Lock)
│   │   │   ├── FloatingToolbar.tsx # 浮动格式化工具栏
│   │   │   └── BottomDockedToolbar.tsx # 移动端底部工具栏
│   │   ├── TaskList/           # 任务列表组件
│   │   │   └── TaskList.tsx
│   │   ├── CreateTaskModal/    # 创建任务弹窗
│   │   │   └── CreateTaskModal.tsx
│   │   ├── NewTaskButton/      # 浮动操作按钮 (FAB)
│   │   │   └── NewTaskButton.tsx
│   │   ├── ErrorBoundary/      # 错误边界
│   │   │   └── ErrorBoundary.tsx
│   │   ├── Toast/              # Toast 通知
│   │   │   ├── Toast.tsx
│   │   │   └── ToastContainer.tsx
│   │   ├── Skeleton/           # 加载占位符
│   │   │   └── Skeleton.tsx
│   │   ├── WelcomeModal.tsx    # 欢迎弹窗
│   │   ├── ManualTriggerButton.tsx  # 手动触发按钮
│   │   ├── TimerIndicator.tsx  # Muse 模式倒计时
│   │   └── SensoryFeedback.tsx # 感官反馈（动画+音效）
│   │
│   ├── hooks/                  # React Hooks
│   │   ├── useCreateTask.ts    # 创建任务
│   │   ├── useTasks.ts         # 查询任务列表
│   │   ├── useWritingState.ts  # 写入状态检测（STUCK）
│   │   ├── useLokiTimer.ts     # Loki 随机定时器
│   │   ├── useMediaQuery.ts    # 响应式断点
│   │   └── useFocusTrap.ts     # Modal 焦点陷阱
│   │
│   ├── services/               # API 服务层
│   │   └── api/
│   │       ├── interventionClient.ts  # AI 干预 API
│   │       └── taskClient.ts          # 任务 CRUD API
│   │
│   ├── contexts/               # React Context
│   │   └── LockManagerContext.ts # 锁管理器依赖注入
│   │
│   ├── types/                  # TypeScript 类型定义
│   │   ├── task.ts
│   │   ├── ai-actions.ts
│   │   └── mode.ts
│   │
│   ├── utils/                  # 工具函数
│   │   ├── prosemirror-helpers.ts   # ProseMirror 辅助函数
│   │   ├── contextExtractor.ts     # 文本上下文提取
│   │   ├── textRange.ts             # 文本范围计算
│   │   └── logger.ts                # 日志工具
│   │
│   ├── assets/                 # 静态资源
│   │   └── audio/              # 音效文件
│   │       ├── whoosh.mp3      # 删除音效
│   │       ├── bonk.mp3        # 拒绝音效
│   │       └── clank.mp3       # Provoke 音效
│   │
│   ├── App.tsx                 # 应用入口
│   ├── main.tsx                # Vite 入口
│   └── vite-env.d.ts           # Vite 类型声明
│
├── e2e/                        # Playwright E2E 测试
│   └── ...
│
├── public/                     # 静态文件
│
├── index.html                  # HTML 入口
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # Node TypeScript 配置
├── eslint.config.js            # ESLint 配置
├── package.json                # 依赖配置
├── package-lock.json           # 依赖锁定
└── README.md                   # 本文件
```

### 架构分层 | Architecture Layers

```
┌─────────────────────────────────────────────────┐
│              Components (UI Layer)               │
│  - TaskList, CreateTaskModal, EditorCore, etc.  │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            Hooks (Abstraction Layer)             │
│  - useTasks, useCreateTask, useWritingState     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          Services (API Communication Layer)      │
│  - taskClient, interventionClient               │
└─────────────────────────────────────────────────┘
```

**架构规则** (由 ESLint `no-restricted-imports` 强制执行):

- ❌ 组件不能直接导入 `services/` - 必须使用 hooks
- ❌ 组件不能导入 `features/` - 保持展示层纯净
- ✅ EditorCore.tsx 例外 - 作为集成层协调服务

---

## 开发工作流 | Development Workflow

### 环境要求 | Prerequisites

- Node.js 20+ (LTS)
- npm (comes with Node.js)

### 安装 | Installation

```bash
# 进入客户端目录
cd client

# 安装依赖 (使用 ci 而非 install，确保可重现构建)
npm ci

# 创建环境变量文件
cp .env.example .env
# 编辑 .env 配置 VITE_API_URL
```

### 开发服务器 | Development Server

```bash
# 启动开发服务器 (HMR)
npm run dev

# 访问应用
open http://localhost:5173
```

### 测试 | Testing (TDD 工作流)

```bash
# 运行单元测试 (Vitest)
npm run test

# 监听模式 (开发时使用)
npm run test:watch

# 运行特定测试文件
npx vitest run src/App.test.tsx

# E2E 测试 (Playwright)
npm run test:e2e

# E2E 测试 + UI 模式
npx playwright test --ui
```

### 代码检查 | Linting & Formatting

```bash
# ESLint 检查 (max-warnings=0)
npm run lint

# Prettier 格式检查
npm run format

# 类型检查 (tsc --noEmit)
npm run type-check
```

### 构建 | Build

```bash
# 生产构建
npm run build

# 预览生产构建
npm run preview
```

---

## 状态管理 | State Management

### React Query (TanStack Query)

用于服务端状态管理和缓存：

```typescript
// hooks/useTasks.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
}

// 缓存失效
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ["tasks"] });
```

### 本地状态

使用 React 内置 `useState` 管理组件本地状态。

---

## 编辑器集成 | Editor Integration

### EditorCore 组件

核心编辑器组件，封装了 Milkdown、ProseMirror 和 Lock Enforcement：

```tsx
import { EditorCore } from "./components/Editor";

function App() {
  const [content, setContent] = useState("");
  const [locks, setLocks] = useState<string[]>([]);

  return (
    <EditorCore
      initialContent={content}
      mode="muse"
      onChange={(markdown, lockIds) => {
        setContent(markdown);
        setLocks(lockIds);
      }}
      onReady={(editor) => {
        console.log("Editor ready", editor);
      }}
    />
  );
}
```

**Props**:

- `initialContent`: 初始 Markdown 内容
- `mode`: AI 模式 (`'off' | 'muse' | 'loki'`)
- `onChange`: 内容变化回调
- `onReady`: 编辑器就绪回调
- `initialLocks`: 初始锁 ID 列表
- `externalTrigger`: 外部触发干预
- `onTimerUpdate`: Muse 模式倒计时更新
- `onInterventionError`: 干预错误回调

### Lock Enforcement

AI 添加的内容通过 ProseMirror Transaction Filter 防止删除：

```typescript
// 在 EditorCore.tsx 中
view.setProps({
  filterTransaction: (tr, state) => {
    // 检查是否试图删除锁定的内容
    if (violatesLocks(tr, state)) {
      showSensoryFeedback(AIActionType.REJECT);
      return false; // 阻止事务
    }
    return true;
  },
});
```

---

## 关键 Hooks | Key Hooks

### useTasks

查询任务列表：

```tsx
import { useTasks } from "../hooks/useTasks";

function TaskListPage() {
  const { data, error, isLoading } = useTasks();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBoundary error={error} />;
  return <TaskList tasks={data} />;
}
```

### useCreateTask

创建任务：

```tsx
import { useCreateTask } from "../hooks/useCreateTask";

function CreateTaskButton() {
  const { mutate, isLoading } = useCreateTask({
    onSuccess: (task) => {
      console.log("Task created:", task.id);
    },
  });

  return <button onClick={() => mutate({ content: "New task" })} />;
}
```

### useWritingState

检测用户输入停滞（Muse 模式）：

```tsx
import { useWritingState } from "../hooks/useWritingState";

function Editor() {
  const { onInput } = useWritingState({
    mode: "muse",
    onStuck: () => {
      console.log("User is stuck!");
    },
    onTimerUpdate: (seconds) => {
      console.log(`${seconds}s until stuck`);
    },
  });
}
```

---

## 测试策略 | Testing Strategy

### 单元测试 (Vitest)

组件测试使用 `@testing-library/react`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskList } from "./TaskList";

describe("TaskList", () => {
  it("renders empty state", () => {
    render(<TaskList tasks={[]} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });
});
```

### E2E 测试 (Playwright)

用户旅程测试：

```ts
import { test, expect } from "@playwright/test";

test("create task flow", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-testid="new-task-button"]');
  await page.fill('[data-testid="create-task-input"]', "My first task");
  await page.click('[data-testid="create-task-confirm"]');
  await expect(page.locator(".task-list-item")).toHaveCount(1);
});
```

---

## 环境变量 | Environment Variables

创建 `.env` 文件在 `client/` 目录：

```bash
# Backend API URL
VITE_API_URL=http://localhost:8000

# 开发模式标志
DEV=true

# Debug 日志
VITE_DEBUG=false
```

---

## 架构边界 | Architecture Boundaries

ESLint 强制执行以下导入限制：

```typescript
// ❌ FORBIDDEN: 组件直接导入服务
import { taskClient } from "../../services/api/taskClient";

// ✅ CORRECT: 使用 Hook 抽象
import { useTasks } from "../../hooks/useTasks";
```

详见 `eslint.config.js` 中的 `no-restricted-imports` 规则。

---

## 常见问题 | Troubleshooting

### Vitest 在 Windows 上挂起

Git Bash 在 Windows 上有进程管理问题。建议：

1. 使用 PowerShell 或 CMD 运行测试
2. 或使用 WSL2 环境

### Playwright 超时

增加 `playwright.config.ts` 中的超时设置：

```ts
export default defineConfig({
  timeout: 30000, // 30 seconds
});
```

---

## 相关文档 | Related Documentation

- [Server README](../server/README.md) - 后端文档
- [Component Catalog](../docs/components/catalog.md) - 组件参考
- [CLAUDE.md](../CLAUDE.md) - AI Agent 开发指南
- [Troubleshooting Guide](../docs/guides/troubleshooting.md) - 故障排除
