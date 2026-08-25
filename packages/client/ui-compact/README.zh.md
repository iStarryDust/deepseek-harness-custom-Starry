# @deepseek-ai/dsh-client-ui-compact

[English](README.md) | 中文

Web 轮次尾部（turn-tail）元信息控件：向 `conversation.chat.turnTailMeta`——已结算轮次 meta 行中、消息时钟与运行统计之间的那行小图标座位——贡献一个条目。

压缩按钮通过既有[命令链](../../interaction/commands/README.md)（`remote.commands.execute`）派发宿主 `/compact` 命令，因此接纳、AI 摘要、范围选择与持久化生命周期卡片全部留在 [`dsh-compaction-basic`](../../compaction/compaction-basic/README.md) 与 [`dsh-command-compact`](../../compaction/command-compact/README.md)；本包只拥有按钮与其瞬态反馈。命令在途时按钮旋转并忽略重复点击；已接纳的命令由它自己的 `/compact` 卡片呈现（此处无需补充），接纳失败则把宿主详情内联展示数秒，随后按钮恢复空闲。

第二个按钮是记忆入口：使用 `IconAgentPresetOutline16` 图形渲染。点击打开勾选窗口，列出当前会话中可选的用户/助手消息；勾选后点击「记忆」，勾选内容经 `agentMemory.remember` RPC 送交宿主，由该会话自己的模型把对话浓缩成稳定的记忆条目，写入该 agent 的长期记忆存储（`<dshHome>/agent-memory/<agentId>/memory.md`）。窗口支持空态、取消与内联失败展示；样式为轻量内联实现，后续再打磨。

两个按钮沿用与复制/分支控件相同的图标按钮外观，悬停显示提示文案（`压缩消息` / `记忆`）。文案位于本包自己的 `compact` locale 命名空间；样式仅使用 token。

## Model Experience

无，本包渲染的是人类触发的压缩命令及其宿主所有结果，不触及任何提示词、消息、schema、流或工具结果。压缩本身见 [`dsh-compaction-basic`](../../compaction/compaction-basic/README.md)。记忆按钮的 AI 分析发生在宿主侧（见 [`dsh-agent-memory`](../../preset/agent-memory/README.md)），本包只收集勾选文本并转发。

#### KV Cache effect

无；本包既不组装也不发送提供方请求。

## Known Limitations and Deferred Work

- **压缩为无参数形式** — 宿主命令不接受范围或强度参数，按钮尚不能请求"整场压缩"或自定义区间。更激进模式需要先有覆盖 `compactRegion` 的宿主编程接口，UI 才能提供。
- **记忆窗口样式为初版** — 勾选窗口使用内联样式以先跑通链路；与主题 token 体系的深度整合、消息分页与跨页选择延后。
