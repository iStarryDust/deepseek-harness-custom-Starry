# dsh-client-ui-agents

[English](README.md) | 中文

Agent 管理界面：侧边栏的 agent 浏览器——用户的 agent 列表（roster）、创建/编辑身份表单，以及展示某个 agent 专属聊天记录的 agent 页。**agent 只是身份（名字 / 语言 / 人格提示词）**；能力在开新对话时通过由"模式 + agent 人格"构成的**组合 preset** 注入。本包是纯 UI 插件：host 端 `apply` 为空，浏览器端通过 `exports["./client"]` 提供，注册进侧边栏壳的 `sidebar.workspaces` 槽位，优先级低于工作区浏览器，因此 agent 界面将其"遮蔽"（shadow）。

## 为什么 agent 只是身份

创建 agent 的表单恰好三个字段：名字、语言、人格提示词。**没有基底模式选择器**——因为模式是开新对话时的能力选项，不是 agent 的属性。实际创建的 agent 预设（`agentPresets.create`，`from: 'minimal'`）只携带身份；一次对话获得什么工具，由开新对话那一刻决定。这与原版预设流程相反：原版里 agent 就是"模式 + 人格"，两者无法分离。

## 组合 preset 机制

从 agent 页点"开启新对话"后，hero 的模式选择只出现三个系统模式（`standard`、`code`、`minimal`；元模式 `cordis` 隐藏）。选择其一——或接受默认的 `standard`——就组合出一个**组合 preset**：

- 组合 id 是确定性的：`<agentId>-<modeId>`，如 `agent-mt1m0r75-standard`。
- 首次生成（`agentPresets.create`，`from: <modeId>`，名字为 `<agent 名字>（<模式名>）`），之后同一对（agent, mode）一直复用，因此同一组合始终解析为同一套会话组合。
- **一个 agent 是一个文件夹**：组合预设的文件位于可写预设根下的 `<agentId>/modes/<modeId>/`——绝不是平级目录——因此 `~/.dsh/.agent-presets/agent-mt1m0r75/modes/standard/` 存放标准模式组合，而 agent 的身份文件位于其文件夹顶层。discovery 把这些嵌套目录展开回会话层所绑定的扁平 `<agentId>-<modeId>` id。
- 会话在创建时绑定组合 preset，从而**归入该 agent 的聊天记录**。
- 裸模式会话（`standard` / `code` / `minimal`，无 agent 前缀）不属于任何 agent，不会出现在任何 agent 的记录里。

待定的 agent 上下文由 `startChat` 登记，seat 应用预设后消耗（`consumePendingAgent`），并通过 `composeForPendingAgent(modeId)` 完成组合。

## 聊天记录的归属与排序

每个 agent 页只列出属于自己的会话：会话记录的 `agentPreset` 等于该 agent id，或以 `<agentId>-` 开头（即它的任一组合 preset）。其余一切——其他 agent 的会话、裸模式会话、subagent 子会话——都被排除。列表按会话最近活动时间（`updatedAt`）从新到旧排序；进入 agent 时右侧自动打开其最近一次对话。浏览器读取完整会话快照并在渲染时过滤，因为 `useSyncExternalStore` 的 selector 只有在数据源变化时才重跑：若 selector 闭包捕获当前选中项，当选中项切换而会话列表本身未变时，列表会停留在旧 agent 的会话上。

## 级联编辑与删除

编辑 agent 身份会同时重写 agent 预设和它 id 前缀下的所有既有组合预设，因此一次人格修改会落到该 agent 的全部会话上。删除 agent 先移除其组合预设，再删除 agent 本体——不留任何幽灵组合。组合 preset 不会出现在 roster 里（"我的 Agent"只列用户 agent），也不能作为 agent 进入或编辑。

## 界面

- **roster（默认页）**——可折叠的"我的 Agent"列表。创建不在这里做按钮，它属于壳的主控件：在该页显示"创建 Agent"，在 agent 页内显示"返回"。
- **agent 页**——所选 agent 的名字，下方聊天记录上方固定两个操作："开启新对话"与"助理档案"。
- **创建 / 编辑**——身份表单。编辑表单与创建共用字段，从 host 预填，并在"确定"旁边带"删除"操作。

## 对话区门（conversation gate）

浏览器处于 roster 或创建页时，`conversation` 槽位注册一个影子占用者，让右侧保持干净的空白起始页。进入 agent 页后影子被撤下，真实对话接管，因此右列读起来就是该 agent 自己的工作区。

## 读写

所有 roster 与预设操作都走 `agentPresets.list / read / create / update / remove`；打开聊天记录行调用 `sessions.open`；开启新对话调用 `workspaces.startSession` 并登记待定 agent。控制器对外暴露待定 agent 面（`pendingAgent`、`composeForPendingAgent`、`modeIdFor`、`consumePendingAgent`），供 hero 芯片（ui-agent-preset）把它的模式选择路由进来。

## Model Experience

间接地，通过后续会话所组合的 preset：模式的工具清单 + 折入的 agent 人格。[`dsh-agent-presets`](../../preset/agent-presets/README.zh.md) 拥有"这套组合把什么放在模型面前"的定义。

#### KV Cache 效应

无直接失效。每个会话用自身的组合建立自己的前缀；编辑人格只影响之后组合的预设，从不触碰运行中会话的前缀。

## 已知限制与待办

- **归属持久化在会话日志中。** 会话的 `agentPreset` 记录在会话日志里——header 的 `agentPreset` 字段，以及空白期切换预设时追加的 `agent-preset/selected` 事件（后者优先）；host 的 `session.list` 对未打开（cold）的会话直接读磁盘解析归属，因此**跨重启保留**。不跨重启的只是运行时状态（当前选中/打开的会话），刷新页面即恢复。
- **人格编辑不即时生效。** 运行中的会话保持它开始时的组合；人格修改只作用于之后开启的对话。
