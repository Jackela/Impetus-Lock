# 来源和更新记录

可固定的外部资料使用作者原文、发布公告或 Git 提交。动态来源注明核对日期。

## 开发范式

### E1

Microsoft VS Code 团队，2026-02-09 创建，2026-11-26 核对 Issue 正文。 [Iteration Plan for February 2026，#293855](https://github.com/microsoft/vscode/issues/293855)

### E2

Cline，2025-12-11 提交，固定到 `d1085569fb0ae3f9613957e6fc2706c6e2f7da9b`。 [Cline Bench README](https://github.com/cline/cline-bench/blob/d1085569fb0ae3f9613957e6fc2706c6e2f7da9b/README.md)

### E3

Fission AI，2026-11-24 提交，固定到 `f1cd852f4edce22b8df9548a4df889172ca8ff25`。 [OpenSpec README](https://github.com/Fission-AI/OpenSpec/blob/f1cd852f4edce22b8df9548a4df889172ca8ff25/README.md)

### E4

Andrej Karpathy，2026-04-04 发布，固定到原 Gist 修订 `ac46de1ad27f92b28ac95459c782c07f6b8c964a`。 [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/ac46de1ad27f92b28ac95459c782c07f6b8c964a)

## 玩法设计

### G1

Derek Yu（Mossmouth），2013-11-20 发布。 [Daily Challenges Now Available in Spelunky on PS3 and PS Vita](https://blog.playstation.com/2013/11/20/daily-challenges-now-available-in-spelunky-on-ps3-and-ps-vita/)

### G2

Mega Crit，2026-11-26 核对 Steam 商店页的玩法描述。 [Slay the Spire](https://store.steampowered.com/app/646570/Slay_theSpire/)

### G3

Mega Crit，2019-01-23 发布。 [Slay the Spire 1.0: Farewell Early Access](https://steamcommunity.com/games/646570/announcements/detail/1714084208003916507) · [Steam 官方公告存档](https://store.steampowered.com/news/posts/?appids=646570&enddate=1548351763)

### G4

独立项目 bunkiten，2026-11-26 从本地仓库核对 `main` 的提交 `606bd080e1945acf941fb2715c665522598aff1f`。源码展示两种输入的回合提交路径，设计记录与每轮协议说明自由行动和后续正文的关系。

- [选项组件的回合入口](https://github.com/Jackela/bunkiten/blob/606bd080e1945acf941fb2715c665522598aff1f/src/components/game/OptionList.tsx#L35-L36) · [选项点击处理](https://github.com/Jackela/bunkiten/blob/606bd080e1945acf941fb2715c665522598aff1f/src/components/game/OptionList.tsx#L88)
- [自由输入组件的键盘提交和语音处理](https://github.com/Jackela/bunkiten/blob/606bd080e1945acf941fb2715c665522598aff1f/src/components/game/FreeInput.tsx#L55-L85)
- [剧情推进设计决定](https://github.com/Jackela/bunkiten/blob/606bd080e1945acf941fb2715c665522598aff1f/docs/adr/0001-story-tree-is-skeleton-not-rail.md#L3) · [每轮协议](https://github.com/Jackela/bunkiten/blob/606bd080e1945acf941fb2715c665522598aff1f/.grok/skills/bunkiten/SKILL.md#L186-L196)

## 微信小程序平台

以下微信公开文档于 2026-11-26 核对。主体后台的类目、权限、审核和真机结果须另行取证。

### W1

微信同声传译的微信开放文档标注末次编辑 2026-08-24，公众平台插件开发文档的更新记录包括 2024-08-13。 [微信开放文档](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/extended/translator.html) · [公众平台插件开发文档](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx069ba97219f66d99&lang=zh_CN)

### W2

微信开放文档，页面标注末次编辑 2026-07-28。 [小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)

### W3

微信开放文档，页面标注末次编辑 2026-08-11。 [Page.onShareAppMessage](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onShareAppMessage-Object-object)

### W4

微信开放文档，页面标注末次编辑 2026-11-12。 [小程序协同工作和发布](https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/release.html)

## 界面与首次体验

### U1

VoltAgent 的 Apple 网站设计分析，本机资料固定到 `fcc70284932276d085f01ef9f83edde90b1258cb`。定版色彩取该分析的白底、浅灰背景、深灰正文和 `#0066cc` 操作蓝。该资料分析网站视觉样式，触控与字号另参考 Apple 官方指南。 [Apple DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/fcc70284932276d085f01ef9f83edde90b1258cb/design-md/apple/DESIGN.md)

### U2

Apple HIG，2026-11-26 核对。建议通过实际操作学习，在相关界面适时提示，按需请求权限。可访问性指南建议支持字号放大及足够大的触控范围。 [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding?changes=_7) · [Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games) · [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility?changes=____5_8_2) · [UI Design Dos and Don’ts](https://developer.apple.com/design/tips/)

### U3

Roblox Creator Hub，2026-11-26 核对。文档把最初几分钟的实际游玩纳入首次体验，以目标达成和逐步流失检查引导，并建议首次遇到功能时提供情境提示。 [Onboarding](https://create.roblox.com/docs/production/game-design/onboarding) · [Onboarding techniques](https://create.roblox.com/docs/production/game-design/onboarding-techniques)

### U4

微信广告《流量主成长营》，2026-11-26 核对“广告竞争分析与转化漏斗”页。课件把小游戏加载速度列入转化率的优化方向。项目据此优先显示可操作的首屏。该材料描述广告转化，首局交互与留存仍须用本产品验证。 [腾讯广告课堂 PDF](https://training.tencentads.com/uploads/202406/XjoUfkBl_ExGwb9.pdf)

## 项目资料

- 仓库规则、领域术语、开发指南和 CI 均从基线 `6f23cdf1b387a4deefc5e8cf17a598371654642a` 对照。可用 `git show <提交>:<路径>` 回查同版原文。 [仓库约定](../AGENTS.md) · [OpenSpec 工作约定](../openspec/AGENTS.md) · [领域术语](../CONTEXT.md) · [开发指南](../DEVELOPMENT.md) · [CI 工作流](../.github/workflows/ci.yml)
- 本次产品及路线取舍回查同一变更中的项目文件，后续查阅以当前版本为准。 [PRODUCT.md](../PRODUCT.md) · [ROADMAP.md](../ROADMAP.md)

## 更新记录

- 2026-11-26 · 建立入口、来源登记和三个主题，首次核对外部原文及本项目来源。微信主体权限和真机行为等待项目取证。
- 2026-11-26 · 加入 bunkiten 交互参考，补记 Impetus Lock 的点选、自由输入和成长设计。

- 2026-11-26 · 入口确定为剧情选项旁常驻“自己写”，其中提供打字和语音。模式锁法、能力进化与标准回合节奏见[首局功能设计](../docs/product/first-story.md)。

- 2026-11-26 · 根据烧信与留信的三轮对照更新项目设计取舍，包括高强度模式的一次切身后果、两条能力的进化及满级调整。[首局推演](../docs/product/first-story.md) · [挑战规则](../openspec/changes/add-story-challenge-rules/specs/story-challenge-rules/spec.md)

- 2026-11-26 · 登记 Apple、Roblox 和微信广告课堂材料，记录首屏直接游玩和逐步说明的依据。[小程序首局界面](../docs/product/miniapp-interface.md)

[返回知识库](README.md)
