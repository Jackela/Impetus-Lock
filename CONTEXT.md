# Domain glossary

| Term              | Meaning                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Task              | An account-owned writing document with content, locks and an optimistic version.                       |
| Lock              | A creative constraint preserved in Markdown that ordinary edits cannot delete.                         |
| Intervention      | A Muse/Loki action that adds or changes writing under the task ownership and version contracts.        |
| Account           | A server-confirmed user identity with a stable ID.                                                     |
| Owned draft       | Writing and locks attached to a server-confirmed account, with or without a remote task.               |
| Unassigned draft  | Retained legacy writing whose account cannot be established; importing it requires an explicit choice. |
| Recovery conflict | A local draft and changed server version retained until the writer decides how to continue.            |
| Session           | Authorization for remote work; expiry must preserve local writing.                                     |

Runtime and dependency versions come from package/lock files and CI. Product requirements come from OpenSpec. Git and validation output establish implementation/check status; neither is release evidence.

## 微信写作挑战的产品术语

以下用于[微信小程序产品设计](PRODUCT.md)。原有 Web Task、Lock、Intervention 的含义见上表。

| 术语     | 含义                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 开场题   | 同题作者共同收到的故事起点。题句自动成为正文第一句，作者可以修改它。                                                       |
| 挑战局   | 从一份开场和初始规则开始，到作者收笔为止的一次独立写作。                                                                   |
| 剧情行动 | 玩家选定的行动或台词。系统把该走向写成新段，成功入稿后算一个有效回合。                                                     |
| 自由写   | 玩家从剧情选项旁的“自己写”接管创作，使用键盘或语音提交自己的段落。成功入稿与点选有相同的成长资格。                         |
| 口述校正 | 按作者选择的风格，对刚说完的这一段识别文字进行整理。                                                                       |
| 锁句     | 正文中受本局规则保护的一句话。玩家可以沿其他情节继续。普通模式保留其原文，高强度模式的特定进阶能力允许玩家主动解锁或替换。 |
| 回应     | 锁句落地后，玩家第一次成功写入新的剧情行动或自由写。转向其他情节也算回应。                                                 |
| 局内能力 | 玩家在回应锁句后获得、影响本局后续故事的能力。两条能力可叠加，再选同类可进化。两条都进化后，可在后续回应时停用或恢复一条。 |
| 规则发现 | 玩家通过有效回合和挑战进度取得以后可用的玩法规则。点选成文与自由写都可推进发现。                                           |
| 个人模式 | 作者用已发现的规则配置、命名并保存的一种玩法，可用来开新局。                                                               |
| 作品     | 作者收笔后得到的独立文字稿。作者可自由编辑并决定是否分享。                                                                 |
| 同题     | 多位作者从同一题句和同一初始规则各自开局，分别创作自己的作品。                                                             |
