# @deepseek-ai/dsh-agent-memory

[English](README.md) | 中文

DeepSeek Harness 的长期记忆：harness home 下的两个纯 markdown 存储，四个用户开关，系统提示注入，一个面向模型的 `memory_add` 工具，以及一个 UI 驱动的 `remember()` 路径。它们共同让 agent 在不占用会话 surface 的前提下跨会话保留稳定事实。

## 存储布局

本包在 harness home 下拥有一个段：`<dshHome>/agent-memory`（`.agent-presets` 的兄弟目录，经 `dshHomePath` 解析，因此 `$DSH_HOME` 覆盖与跨平台 home 都能正确落位）：

| 存储 | 路径 | 共享 |
|---|---|---|
| 全局 | `<dshHome>/agent-memory/global/memory.md` | 所有 agent |
| Agent | `<dshHome>/agent-memory/<agentId>/memory.md` | 单个 agent（每 agent 一个目录） |

文件形状：`# <标题>` 头行是自由文本（由用户编辑），每条记忆是一行 `- [YYYY-MM-DD HH:mm] 内容`。时间戳是条目的主要元数据：重新保存会刷新时间戳，重新记住的相同事实会刷新而非复制。读写刻意做成同步——系统提示装配调用 section thunk 时无 await 点，且这些文件很小。

agent id **不是** `SessionId`，而是用户 preset id，由 agent 加入的合并 `<agentId>-<modeId>` preset（`composedPreset` → 拆回 `<agentId>`）推导而来。`agentIdOf()` 与 `resolveAgentId()` 负责该拆分；本包的 invariant 伴生（`/invariant`，`dsh-agent-memory-invariant`）在安装时审计布局。

## 设置开关

命名空间 `agent-memory`（默认全**关**）：

| 开关 | 效果 |
|---|---|
| `globalEnabled` | 把全局存储注入每个系统提示（`memory:global`） |
| `agentEnabled` | 把本 agent 的存储注入其自身系统提示（`memory:agent`） |
| `autoMemory` | 模型可调用 `memory_add`，事实直接写入 agent 存储 |
| `askMemory` | 同一工具调用先经 approval seam 询问人类（无 approval 服务或 `never` 会话策略拒绝时 fail-closed）；仅 `allowed-once` 决定才写入 |

`memory:global` / `memory:agent` 的 section thunk 在每次装配时重读存储，因此编辑器保存后无需重启即生效。该工具仅在 `autoMemory || askMemory` 成立时注册，并跟随每次设置提交。

## Service API（`ctx.agentMemory`）

服务暴露的公开成员（插件本身是 `AgentMemory`）：

| 成员 | 语义 |
|---|---|
| `readGlobal()` | 全局存储文本（编辑器读取） |
| `writeGlobal(text)` | 全局存储保存（编辑器写入） |
| `readAgent(agentId)` | 单 agent 存储文本（编辑器读取） |
| `writeAgent(agentId, text)` | 单 agent 存储保存（编辑器写入） |
| `appendAgent(agentId, content)` | 向 agent 存储追加一条事实（去重 + 时间戳） |
| `switches()` | 当前开关快照（设置缺席时用默认值） |
| `remember(agent, text)` | UI 驱动路径：用 agent 自身模型把选定对话文本浓缩成条目并写入 agent 存储 |
| `resolveAgentId(agent)` | 一个活动 agent 背后的用户 agent id |

### 写入策略

`memory_add` 工具与 `remember()` 都**只**写入调用方 agent 的存储——绝不写全局。全局记忆由用户在编辑器中手动维护；模型侧路径从不触碰它。

## `memory_add` 工具

在 `autoMemory || askMemory` 成立时注册。接收一个 `text` 参数（最终散文形态的稳定事实），`askMemory` 开启时先询问人类，然后把去重后的事实追加到调用方 agent 的存储。返回 `{ saved, agentId?, outcome?, content? }`；渲染器在保存时显示 `记住：…`，否则显示 `未记住：…`。它被告知只记散文结论、合并相关事实，绝不存凭据或一次性任务细节。

## Model Experience（`remember()` UI 路径）

UI 记忆按钮（`dsh-client-ui-compact`）收集勾选的消息，经 `agentMemory.remember` RPC 送交宿主。宿主 `remember()` 解析 agent 自身的 LLM（用 agent 路由请求头模型的 `ctx.llm.stream()`），把选定文本浓缩成每行一条记忆。空行与明显的"无可记"占位符会被丢弃（`isVacuousEntry`），不可见/纯空白输出会被清洗（`stripInvisible`），因此视觉空白但字节非空的行绝不会落成一片空格。写入总是针对调用方 agent 的存储。

### Token 效果

remember 路径本身产生模型调用；其成本由 agent 自身的生成上限约束。这不是压缩——它从不改写会话 surface。

## 已知局限与后续工作

- **注入是 opt-in** —— 只有开关开启时记忆才被读入提示；否则存储惰性。
- **全局记忆仅人类可写** —— 没有面向模型的全局写入；工具与 remember 路径都按设计停在 agent 存储上。
- **无跨 agent 共享** —— 一个 agent 的记忆绝不会出现在另一个 agent 的提示中。
- **编辑器文本为自由格式** —— 头行不校验；只有 `- [时间戳] …` 行才算条目，用于去重。
