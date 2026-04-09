# US-003: 数据库迁移机制 (精简版)

## 原始需求

**US-003**: 作为开发者，我希望有完整的数据库迁移机制

> 当前数据库 schema 变更需要手动处理，需要 Alembic 自动化迁移。

---

## PO 详情

### 验收标准

1. **AC1**: Alembic 配置完整，可创建迁移脚本
2. **AC2**: 迁移脚本包含升级和降级逻辑
3. **AC3**: CI/CD 自动运行迁移
4. **AC4**: 迁移文档完整

---

## Tech Lead 评估

### 方案: Alembic + SQLAlchemy

**工作量**: 2 小时
- 配置 Alembic: 0.5h
- 创建初始迁移: 0.5h
- 测试迁移流程: 0.5h
- 文档: 0.5h

### 关键问答

**Tech Lead**: 最简实现是什么？
> 使用 alembic init，配置 env.py 使用异步引擎，创建首版迁移。

**PO**: 不做这个功能能发布吗？
> **能**，但 schema 变更困难。建议 P2 优先级。

---

## 精简需求

### IN 范围
- Alembic 配置
- 初始迁移脚本
- 迁移文档

### OUT 范围
- 自动迁移检测
- 数据迁移工具
- 回滚 UI

---

## 实现命令

```bash
cd server
poetry run alembic init alembic
# 配置 alembic/env.py 使用 async engine
poetry run alembic revision --autogenerate -m "initial schema"
poetry run alembic upgrade head
```
