# @deepseek-ai/dsh-client-ui-settings-agent-memory

[English](README.md) | 中文

Agent 记忆设置页（浏览器半）。向设置外壳的 `settings.section` 槽（id `agent-memory`，标签 `Agent记忆`）贡献一个条目，并渲染四个记忆开关加全局记忆编辑器。它从不拥有存储——而是把开关状态经 `agent-memory` 设置命名空间 scope 移动、把全局文档经 `agentMemory` wire 移动，二者都由 [`dsh-agent-memory`](../../preset/agent-memory/README.md) 拥有。

## 页面展示

- **开关行** —— `globalEnabled`、`agentEnabled`、`autoMemory`、`askMemory`，每行附带简短提示。`askMemory` 仅在 `autoMemory` 开启后可用（否则 UI 禁用并附提示）。
- **全局记忆编辑器** —— 绑定到全局存储草稿的文本框。编辑器同时显示 `- [YYYY-MM-DD HH:mm] 内容` 行与 `# 标题` 头文本；保存会把整份文档经 wire 写入。它只针对全局存储——per-agent 存储不能在此编辑。

## 数据流

`MemorySettingsController` 持有页面状态的一个 `createSnapshotStore`，并：

- 订阅 `agent-memory` 设置命名空间 scope（在 loopback 下开关经持久 Host section 传输，远程浏览器记忆模式下则为进程本地——与欢迎提示完全一致）；通过 `decodeMemorySection()` 把畸形 section 解析成全关
- 激活时加载全局文档（`agentMemory.readGlobal`），并在每次写入后刷新编辑器（`saveGlobal` 经 `agentMemory.writeGlobal`）。

开关切换经 `scope.set(field, next)` 写入；section 渲染 scope 解析出的内容。locale 命名空间为 `settings.agentMemory`，以 zh 字典为准。

## Model Experience

无。页面只渲染开关状态与全局文档；不触及任何提示词、消息、schema、流或工具结果。四个开关改变记忆的注入方式（见 [`dsh-agent-memory`](../../preset/agent-memory/README.md)），但此页只移动这些开关与全局文档过 wire。

#### KV Cache effect

无；本页既不组装也不发送提供方请求。

## 已知局限与后续工作

- **此处不能编辑 per-agent 记忆** —— 页面只暴露全局存储编辑器；目标 agent 的自身存储在对应 agent 的设置中只读展示（或完全不显示）。对选定 agent 记忆的行内编辑延后。
- **开关相等性非即时** —— 优化的 `load` 只跟随 scope 一次并从快照推导开关；若 scope 迟解析，可能短暂显示 `loading`。
- **仅全局编辑器** —— section 刻意只暴露一个编辑器；per-agent 编辑器界面与记忆历史列表延后。
