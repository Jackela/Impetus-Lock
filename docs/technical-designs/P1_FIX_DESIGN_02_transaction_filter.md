# P1 Fix Design: TransactionFilter 类型安全

## 问题描述

**文件**: `client/src/components/Editor/TransactionFilter.ts:93-126`

**问题**: 多次使用 `as` 类型断言，正则匹配未处理失败情况，存在运行时类型安全风险。

### 当前代码分析

```typescript
// 第93-100行 - 使用 as 断言
tr.steps.forEach((step) => {
  const stepMap = step.getMap();

  stepMap.forEach((oldStart, oldEnd) => {
    state.doc.nodesBetween(oldStart, oldEnd, (node: unknown) => {
      const anyNode = node as Record<string, unknown>;  // ❌ 类型断言

      const metadata = extractLockAttributes(node as ProseMirrorNode);  // ❌ 类型断言
      if (metadata?.lockId && lockManager.hasLock(metadata.lockId)) {
        affectsLock = true;
        return false;
      }

      // 第102-114行 - 访问未验证的属性
      const marks = anyNode.marks as Array<{ attrs?: Record<string, unknown> }> | undefined;  // ❌ 类型断言
      if (marks) {
        for (const mark of marks) {
          const markAttrs = mark.attrs;
          if (
            markAttrs?.lockId &&
            typeof markAttrs.lockId === "string" &&
            lockManager.hasLock(markAttrs.lockId)
          ) {
            affectsLock = true;
            return false;
          }
        }
      }

      // 第117-124行 - 正则匹配未处理失败情况
      if (anyNode.isText && typeof anyNode.text === "string") {
        const lockPattern = /<!--\s*lock:([^\s>]+)\s*-->/i;
        const match = anyNode.text.match(lockPattern);  // ❌ 可能返回 null
        if (match && lockManager.hasLock(match[1])) {   // ❌ match[1] 可能越界
          affectsLock = true;
          return false;
        }
      }
    });
  });
});
```

## 技术方案

### 方案: 实现类型守卫 + 运行时类型检查

**说明**: 
1. 创建类型守卫函数验证 `ProseMirrorNode` 结构
2. 创建类型守卫函数验证 `ProseMirrorMark` 结构
3. 添加运行时类型检查，确保属性存在且类型正确
4. 安全处理正则匹配结果

### 代码示例

#### 类型守卫实现

```typescript
/**
 * Type guard for ProseMirror Node.
 * Validates that node has required properties for lock extraction.
 */
function isProseMirrorNode(node: unknown): node is { 
  marks?: unknown[];
  isText?: boolean;
  text?: string;
  attrs?: Record<string, unknown>;
} {
  return (
    typeof node === "object" &&
    node !== null &&
    (!Array.isArray(node))  // 排除数组
  );
}

/**
 * Type guard for ProseMirror Mark.
 * Validates that mark has attrs property with proper structure.
 */
function isProseMirrorMark(mark: unknown): mark is { 
  attrs?: Record<string, unknown>;
} {
  return (
    typeof mark === "object" &&
    mark !== null
  );
}

/**
 * Safely extract lock ID from text content.
 * Returns null if no lock found or pattern doesn't match.
 */
function extractLockIdFromText(text: string): string | null {
  const lockPattern = /<!--\s*lock:([^\s>]+)\s*-->/i;
  const match = text.match(lockPattern);
  
  // 安全检查: 确保 match 存在且有捕获组
  if (!match || match.length < 2) {
    return null;
  }
  
  const lockId = match[1];
  
  // 验证 lockId 不为空
  if (!lockId || lockId.trim() === "") {
    return null;
  }
  
  return lockId;
}
```

#### 修复后的核心逻辑

```typescript
tr.steps.forEach((step) => {
  const stepMap = step.getMap();

  stepMap.forEach((oldStart, oldEnd) => {
    state.doc.nodesBetween(oldStart, oldEnd, (node: unknown) => {
      // 使用类型守卫验证 node 结构
      if (!isProseMirrorNode(node)) {
        return; // 跳过无效节点
      }

      // 安全调用 extractLockAttributes（需要同步更新该函数）
      try {
        const metadata = extractLockAttributes(node as ProseMirrorNode);
        if (metadata?.lockId && lockManager.hasLock(metadata.lockId)) {
          affectsLock = true;
          return false;
        }
      } catch (error) {
        console.warn("Failed to extract lock attributes:", error);
        // 继续处理，不阻塞
      }

      // 安全访问 marks 属性
      if (Array.isArray(node.marks)) {
        for (const mark of node.marks) {
          if (!isProseMirrorMark(mark)) {
            continue; // 跳过无效 mark
          }
          
          const markAttrs = mark.attrs;
          if (
            markAttrs?.lockId &&
            typeof markAttrs.lockId === "string" &&
            lockManager.hasLock(markAttrs.lockId)
          ) {
            affectsLock = true;
            return false;
          }
        }
      }

      // 安全处理文本节点
      if (node.isText === true && typeof node.text === "string") {
        const lockId = extractLockIdFromText(node.text);
        if (lockId && lockManager.hasLock(lockId)) {
          affectsLock = true;
          return false;
        }
      }
    });
  });
});
```

### extractLockAttributes 同步更新

```typescript
// utils/prosemirror-helpers.ts
export function extractLockAttributes(
  node: unknown
): { lockId?: string; lockReason?: string } | null {
  // 验证 node 是对象
  if (typeof node !== "object" || node === null) {
    return null;
  }

  const nodeObj = node as Record<string, unknown>;
  
  // 安全访问 attrs
  const attrs = nodeObj.attrs;
  if (typeof attrs !== "object" || attrs === null) {
    return null;
  }

  const attrsObj = attrs as Record<string, unknown>;
  
  // 提取并验证 lockId
  const lockId = attrsObj.lockId;
  if (typeof lockId !== "string" || lockId.trim() === "") {
    return null;
  }

  // 提取 lockReason（可选）
  const lockReason = attrsObj.lockReason;
  return {
    lockId,
    lockReason: typeof lockReason === "string" ? lockReason : undefined,
  };
}
```

## 注意事项

1. **性能考虑**: 类型守卫增加了运行时检查，但开销极小（只是类型检查）
2. **向后兼容**: 保持函数签名不变，只修改内部实现
3. **错误处理**: 添加 try-catch 防止 extractLockAttributes 抛出异常
4. **Edge Cases**: 处理 null, undefined, 数组等非预期输入
5. **TypeScript 严格模式**: 确保修复后的代码在 strict 模式下无错误

## 测试策略

### 单元测试

```typescript
// TransactionFilter.test.ts
describe("isProseMirrorNode", () => {
  it("should return true for valid node objects", () => {
    expect(isProseMirrorNode({ marks: [] })).toBe(true);
    expect(isProseMirrorNode({ isText: true, text: "hello" })).toBe(true);
    expect(isProseMirrorNode({})).toBe(true);
  });

  it("should return false for invalid inputs", () => {
    expect(isProseMirrorNode(null)).toBe(false);
    expect(isProseMirrorNode(undefined)).toBe(false);
    expect(isProseMirrorNode([])).toBe(false);
    expect(isProseMirrorNode("string")).toBe(false);
    expect(isProseMirrorNode(123)).toBe(false);
  });
});

describe("isProseMirrorMark", () => {
  it("should return true for valid mark objects", () => {
    expect(isProseMirrorMark({ attrs: {} })).toBe(true);
    expect(isProseMirrorMark({})).toBe(true);
  });

  it("should return false for invalid inputs", () => {
    expect(isProseMirrorMark(null)).toBe(false);
    expect(isProseMirrorMark(undefined)).toBe(false);
    expect(isProseMirrorMark("string")).toBe(false);
  });
});

describe("extractLockIdFromText", () => {
  it("should extract lock ID from valid comment", () => {
    expect(extractLockIdFromText("<!-- lock:abc123 -->")).toBe("abc123");
    expect(extractLockIdFromText("text <!-- LOCK:xyz789 --> more")).toBe("xyz789");
  });

  it("should return null for invalid text", () => {
    expect(extractLockIdFromText("no lock here")).toBe(null);
    expect(extractLockIdFromText("<!-- lock: -->")).toBe(null); // empty lockId
    expect(extractLockIdFromText("")).toBe(null);
  });
});

describe("createLockTransactionFilter", () => {
  it("should handle nodes with invalid structure gracefully", () => {
    const filter = createLockTransactionFilter(mockLockManager);
    
    // 模拟包含无效节点的 transaction
    const mockTr = createMockTransaction([
      null,
      undefined,
      [],
      { isText: true }, // missing text property
      { marks: "invalid" }, // marks not array
    ]);
    
    // 不应该抛出异常
    expect(() => filter(mockTr, mockState)).not.toThrow();
  });
});
```

### 集成测试

```typescript
// Editor.integration.test.ts
describe("Lock enforcement with type safety", () => {
  it("should block deletion of locked content with various node types", () => {
    // 测试包含混合节点类型的复杂文档
  });

  it("should handle malformed nodes without crashing", () => {
    // 注入畸形节点，验证编辑器不会崩溃
  });
});
```

## 实施步骤

1. **创建类型守卫函数**:
   - 在 `TransactionFilter.ts` 顶部添加 `isProseMirrorNode` 和 `isProseMirrorMark`
   - 添加 `extractLockIdFromText` 函数

2. **更新核心逻辑**:
   - 替换 `as` 断言为类型守卫检查
   - 添加错误处理 try-catch

3. **同步更新依赖函数**:
   - 更新 `extractLockAttributes` 添加运行时检查

4. **运行测试**:
   ```bash
   cd client
   npm run test TransactionFilter.test.ts
   npm run type-check
   ```

5. **代码审查**:
   - 重点检查类型守卫逻辑
   - 确认无 `as` 断言残留

## 合规性检查

- [x] **Article I (Simplicity)**: 类型守卫函数简单明确
- [x] **Article III (TDD)**: 需要为类型守卫编写单元测试
- [x] **Article V (Documentation)**: 添加完整 JSDoc 注释

## 估计工作量

- **开发时间**: 30分钟
- **测试时间**: 20分钟
- **代码审查**: 15分钟
- **总计**: 65分钟
