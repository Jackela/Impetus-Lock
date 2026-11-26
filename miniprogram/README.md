# Impetus Lock 微信小程序

直接打开小程序即可从《来信》的两个行动开始，或编辑题句、用键盘和语音自己写。六个原生页面覆盖首页、写作、题材与个人模式、作品库、私密作品和好友读卡。现有 Web 在仓库的 `client/` 独立运行。

## 构建与导入

在本目录使用 Node 22.13+ 或 24 和 npm 执行下列命令。

```sh
npm ci
npm run type-check
WECHAT_API_ORIGIN=https://your-api.example.com WECHAT_SPEECH_ENABLED=1 npm run build
```

将示例域名换成部署该后端的 HTTPS 源地址，只填协议、主机和可选端口。客户端会追加 `/api/wechat`。留空仍可编译并查看首屏，远程操作将显示缺少服务地址。开发机回环 HTTP 仅适合本地联调。

微信开发者工具导入包含 `project.config.json` 的本目录，项目代码目录为生成的 `dist/`。使用自己的小程序 AppID 替换项目配置中的 `touristappid`。先构建再导入；修改 TS、WXML、WXSS 或构建变量后重新构建。正式 AppID 需在公众平台设置 HTTPS request 合法域名、隐私保护指引、录音用途和插件权限。身份交换所用 AppSecret、会话签名密钥、模型服务凭据和内容检查凭据均配置于服务端。

## 语音与数据

需要语音时，在小程序后台添加微信同声传译插件，再设置 `WECHAT_SPEECH_ENABLED=1` 重新构建。产物会登记 `WechatSI` 0.0.7，提供方为 `wx069ba97219f66d99`。插件未启用或设备无法启动识别时，用户仍可打字或点选。麦克风授权在主动使用语音时发起。前台正常松手后发送识别文字；录音时切后台或取消手势会中止自动提交。应用在插件返回临时录音路径时请求清理文件。供应方的数据处理期限与主体后台配置需在上线前核实。[微信同声传译](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/extended/translator.html) · [微信隐私授权](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)

微信技术会话通过服务端交换。Bearer token 仅保存在进程内存，前台重新确认身份后才能读写相应私有数据。作品卡使用独立公开读取路径，默认缩略图来自包内固定封面。原生作品保存调用 `PUT /api/wechat/works/{id}`，与服务端 PATCH 别名共用版本及正文合同。TXT 用 UTF-8 生成，用户主动操作后调用微信文件分享面板。

## 本地检查

要在开发者工具里走完整一局，可用[本地联调服务](../scripts/verify-wechat-local/README.md)启动微信身份和中文剧情样例，再用本机回环地址构建小程序。

```sh
npm test
npm run test:contract
```

`npm test` 编译 TypeScript 和全部 WXML，再在 Node 的页面宿主中运行真实页面方法与微信边界回调。用例涵盖身份、首屏、重试、语音、收笔、规则、作品和卡片。测试数据只存在于测试目录，构建按页面清单复制文件。

`npm run test:contract` 另需相邻 `server/` 已安装 Poetry 依赖。它启动仅监听回环端口的 FastAPI 测试服务，使用临时 SQLite 数据库和真实路由、归属校验、持久化及签名会话。微信上游、模型生成和公开内容检查采用测试替身，覆盖开局幂等、首段、收笔、作品保存、公开卡读取、好友独立开局及撤回。

需要查看首页时间时，构建时附加 `WECHAT_DEV_TIMINGS=1`。在开发版控制台执行 `getApp().getFirstStoryTimings()`，依次可读到 `first_screen_ready_ms`（应用启动至首页可操作）、`action_feedback_ms`（操作到首次界面反馈）、`action_committed_ms`（操作到首段确认入稿）。未完成的节点没有数值。这些字段只在内存中保存毫秒数，体验版和正式版不采样。

真机检查涵盖 iOS 与 Android 微信的实际字号、读屏顺序、键盘与底部安全区、录音授权和系统中断、TXT 分享、双账号作品卡以及实际中文模型响应时间。真实 AppID、合法域名和微信审核发布由项目负责人配置与确认。
