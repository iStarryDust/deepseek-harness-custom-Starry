# Agent Note：基于组合 preset 的 Agent 管理

状态：implemented

[English](2026-08-20-agent-management-combined-presets.md) | 中文

## 问题

agent 与基底模式不可分离：创建 agent 就是复制某个模式（`standard` / `code` / `minimal`）的组合并加上人格，因此"agent"与"模式"是同一个轴。用户无法把 agent 当作身份来浏览，所有 agent 的会话混在同一个会话列表里，从某 agent 以不同模式开新对话会静默产生一个不再属于该 agent 的会话。新建会话界面把五个选项（三个模式、元模式 `cordis`、用户 agent）塞进同一个选择器。

## 决策

**agent 只是身份。** `ui-agents`（新 client 包）拥有侧边栏 agent 浏览器：创建时只有名字 / 语言 / 人格提示词，没有基底模式选择器。实际创建的 agent 预设（`agentPresets.create`，`from: 'minimal'`）只携带身份。

**模式是开新对话时的能力选择。** 从 agent 页开启新对话后，hero 的模式选择只出现三个随附系统模式（`standard`、`code`、`minimal`；`cordis` 保持隐藏）。选择其一——或默认的 `standard`——组合出**组合 preset** `<agentId>-<modeId>`：对所选模式做一次确定性的 `agentPresets.create` 并折入该 agent 的身份，首次生成、之后复用。会话绑定组合 preset，从而归入该 agent 的聊天记录；裸模式会话不属于任何 agent。

**一个 agent 是一个文件夹。** 组合 preset 的文件位于可写预设根下的 `<agentId>/modes/<modeId>/`，绝不是平级目录：`~/.dsh/.agent-presets/<agentId>/` 顶层放身份文件，每个模式的组合嵌套在下面。discovery 把嵌套目录展开回扁平的 `<agentId>-<modeId>` id，从而会话层、wire API 与浏览器都无需改动；authoring 在 agent 本体存在时把组合 id 解析到其嵌套目录。

**聊天记录专属且有序。** `agentChats` 用会话记录的 `agentPreset` 匹配 agent id 或 `<agentId>-` 前缀，并按 `updatedAt` 从新到旧排序。浏览器读取完整会话快照并在渲染时过滤，因为 `useSyncExternalStore` 的 selector 闭包捕获选中项时，当选中的 agent 切换而会话列表未变，selector 不会重跑。

**编辑与删除级联。** 更新 agent 会一并重写它的组合 preset；删除先移除组合 preset，再删 agent 本体。组合 preset 永不进入名单。

**由 seat 统一应用暂存值。** hero 芯片（ui-agent-preset）接收 `uiAgents` 的 agent 上下文（`pendingAgent`、`composeForPendingAgent`、`modeIdFor`、`consumePendingAgent`），使模式选择暂存组合 id，应用后消耗上下文，显示上仍是纯模式。

## 备选方案

**保留基底模式选择器，仅按前缀记录归属。** 否决：裸模式下开启的会话仍会逃出 agent，且选择器的五路拆分依旧令人困惑。

**用会话字段存储 agent 归属。** 否决：运行中的会话列表已携带 `agentPreset`；从组合 id 推导归属可以保持持久化日志不变。

**用 `useSessions` selector 过滤。** 否决：selector 以其数据源为缓存键，切换 agent 而会话列表未变时会一直显示旧 agent 的会话。

## 影响

Web GUI 现在以"agent = 身份"为中心组织，能力在开新对话时选择；三模式选择取代了五路选择器。`packages/client/ui-agents/README.md` 是行为的事实之家；用户全局 `~/.dsh/AGENTS.md` 把当前格局广播给每个 agent 会话。归属**持久化在会话日志中**：会话的 `agentPreset` 记录在 header 里，空白期切换预设时还会追加 `agent-preset/selected` 事件；`session.list` 对未打开的会话直接从磁盘解析，因此归属跨重启保留；只有运行时的选中/打开状态是进程内的。注：本 note 初稿曾写"归属为运行时绑定"，2026-08-21 重启后的会话探测证明它是持久化的。
