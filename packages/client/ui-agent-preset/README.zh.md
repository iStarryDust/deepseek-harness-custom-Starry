# dsh-client-ui-agent-preset

[English](README.md) | 中文

Agent 预设表层：新会话屏幕上的 hero chip 选择下一个会话的**模式**，以及会话 header 里的只读标签显示当前会话运行在哪个预设上。曾经还有一个"通用设置里的默认预设行"和一个"管理预设列表的设置分区"，但已在 2026-08-21 移除：agent 管理已收归侧边栏（ui-agents），而一个可能指向 agent 本体的默认预设字段更多是误导而非帮助。

## 为什么是"开新会话时"的选择

会话的预设在其创建时固定——host 拒绝把一个已存在的会话改用另一个预设，因为该会话的历史是在第一个预设的工具下产生的。所以这个表层不能是实时开关，它也如此表述：chip 的选择作用于即将开始的会话，而运行中的会话保持其开始时的组合。

## 新会话 chip

chip 位于新会话屏幕上、工作区选择器旁边。它待在那边而不是在输入区里，因为那里才是选择仍然开放的地方：一个大部分时间处于禁用状态的控件应该放在它仍然有效的那块屏幕上。

chip 只提供**聊天时模式**——系统自带预设减去元模式 `cordis`。本地创建的 agent 从不出现于此；四个内置 id（`standard`、`code`、`minimal`、`cordis`）才是选择读取的对象，`cordis` 保持隐藏，因为它是提供给预设作者的元预设，不是会话可以运行其下的模式。

当对话从 agent 页开始时，`uiAgents` agent 上下文会把选择路由到**组合预设**：用户选的模式——或 chip 无人触碰时的默认 `standard`——组合成 `<agentId>-<modeId>`（模式组合 + agent 人格），被 stage 并应用的正是这个组合 id。chip 仍然显示为普通模式（`modeIdFor` 把组合 id 映射回其模式用于显示），而由此产生的会话归属于该 agent 的聊天记录。agent 上下文在应用时消耗（`consumePendingAgent`），因此下一个新会话又回到部署默认。

chip 打开时显示部署默认，其选择是*暂存*的——该屏幕先于它将应用到的会话。当某个会话变为 current 且仍为空白时，暂存到达该会话，这同时覆盖了 workspace 连接创建的会话和被复用的空白会话；搭 `sessions.create` 的车会错过后者。暂存首次使用即消耗，因此下一个新会话再次以默认打开，与旁边的工作区选择器完全一致。

已开始的会话会被拒绝而不是排队：host 回答 `agent-preset-locked`，暂存被丢弃，而不是等待一个永远不会接受它的会话。

## 会话 header 标签

第二个表层，位于会话标题旁：这个会话运行在哪个预设上，作为静态装饰。那里的控件会承诺一个 host 直接拒绝的切换。它从会话自身的摘要读取预设，并对照 roster 解析显示名。转发的 `agent-preset/selected` owner 事件会把已提交的空白会话切换折入每个标签页共享的摘要；发起标签页可能已经应用了 RPC echo，合并是幂等的。

## 读写

选项与当前默认都来自一次 `agentPreset.list` 调用。roster 已经报告了未显式选择的会话会得到哪个 id，因此表层无需 settings schema 内省；默认值存放在 `agent-presets` settings 命名空间的 `default` 字段，由 host 在创建时解析。

本地创建的预设与它命名的插件同样受信任，因此列表会标记 `user` 行，而不是把每个预设都呈现为出厂验证过的。

预设文件发布一个未本地化的 `name` 与 `description`，Web 对每个 `user` 行和未知 `system` 行都使用它。对于四个内置 id（`standard`、`code`、`minimal`、`cordis`），只有当 roster 把该行标记为 `system` 时 Web 才从当前 locale 解析这两个字段；同名 `user` 预设保留其文件元数据。

表层在 agent-presets 命名空间的 `settings/changed` 与 `connection/reset` 时重读：roster 是活目录、默认值是 settings 字段，外部编辑或重连都可能移动它们。

## 表层缺失时

未组合任何预设的部署会以空 roster 应答，chip 与标签都渲染为空——此时每个会话共享 host 组合，没有可选的东西。未记录预设的会话不显示标签、也不读取 roster。

## Model Experience

间接地，通过后续会话所组合的预设；[`dsh-agent-presets`](../../preset/agent-presets/README.zh.md) 拥有"这套组合把什么放在模型面前"的定义。

#### KV Cache 效应

无直接失效。更改默认从不触碰运行中会话的前缀；之后创建的会话从自己的组合建立自己的前缀。

## 已知限制与待办

- **无元数据的预设按 id 列出**——显示文本可选，组合预设的名字在 agent 名或模式名缺失时由两者之一组合而成。
- **标签显示预设而非 agent**——组合预设读作其模式；它所属的 agent 是侧边栏的事。
- **组合编辑对页面不可见**——文件在浏览器外编辑，wire 上没有任何东西宣告文件变更，因此表层在自己的动作、`settings/changed` 与 `connection/reset` 时重读，而不是每次磁盘编辑。
