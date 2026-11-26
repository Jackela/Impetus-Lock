# 微信小程序本地联调

先安装后端 Poetry 依赖，并在 `miniprogram/` 运行 `npm ci`。准备一个专用的本地 PostgreSQL 数据库。以下示例使用默认本地端口和当前 PostgreSQL 账号。

```sh
createdb -h 127.0.0.1 impetus_wechat_local
export WECHAT_WIRE_DATABASE_URL="postgresql+asyncpg://$(whoami)@127.0.0.1:5432/impetus_wechat_local"
./scripts/verify-wechat-local/run.sh
```

账号、密码和端口按本地 PostgreSQL 配置调整。脚本执行 Alembic 迁移，并用独立的测试身份写入数据。每次运行使用新身份，退出时关闭自建的 FastAPI 和模型服务，保留数据库和日志。需要时用 `WECHAT_WIRE_PORT` 指定未占用的 FastAPI 端口。已有本地 Redis 时可用 `WECHAT_WIRE_REDIS_PORT` 指定端口。

脚本编译小程序实际请求模块，通过 HTTP 连接完整的 FastAPI 应用和 PostgreSQL。微信换码和内容检查使用固定样例，模型接口使用本地中文样例。应用仍执行会话签发、身份校验、局规、作品授权和数据库事务。

## 在微信开发者工具中打开

```sh
./scripts/verify-wechat-local/run.sh serve
```

另开终端，将小程序构建配置指向本地服务。用微信开发者工具导入 `miniprogram/` 并按开发工具提示允许访问本地地址。

```sh
cd miniprogram
WECHAT_API_ORIGIN=http://127.0.0.1:58474 npm run build
```

前台服务使用单个本地开发身份，提供题材和剧情样例。按 Ctrl+C 停止。真实微信身份、审核、手机录音、模型效果和生产域名需各自在目标环境检验。
