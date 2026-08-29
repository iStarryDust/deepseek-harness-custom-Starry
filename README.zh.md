# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 自定义发行版（iStarryDust fork）

本仓库是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（**`0.1.1-rc.2`**）的定制 fork，在官方版本之上增加以 **Agent 为身份** 为核心的管理层。

### 与上游的不同

| 模块 | 上游 DeepSeek Harness | 本仓库 |
|---|---|---|
| `packages/client/ui-agents` | — | **新增**：Agent 管理界面（侧边栏名单、创建 / 编辑表单、按 Agent 分组的聊天记录） |
| Agent 身份 | 进程级固定 | **Agent 即身份**：每个 Agent 有名字 / 语言 / 描述 / 人格；开新对话时选择能力（标准 / PTC / 极简） |
| 预设布局 | 平级目录 | 嵌套于 `agent/modes/<模式>/`；开新对话组合 `<agentId>-<modeId>` 预设 |
| 从 Agent 页创建会话 | 延迟 hero 绑定 | **直接绑定组合预设** |
| persona 行 | 人格 + 语言指令 + 运行时模板 | 语言指令 + 工作目录行 + 人格原文 |
| `session.remove` | 注入 bug | **已修复** |
| 设置页 Agent 预设入口 | 默认行 + 管理分区 | 收归侧边栏 Agent 名单 |
| `packages/web/browser` | — | **新增**：内置浏览器插件（Playwright Chromium 安装于 `~/.dsh/browser`；Agent 通过 `browser_open` / `browser_interact` 打开并操作网页） |
| `packages/compaction` | 抽象 seam | **增强**：轮次尾部压缩按钮（`ui-compact`）、`CompactionEngine` seam（`ctx.compaction`）、工具结果剪枝、`/compact` 命令 |
| `packages/preset/agent-memory` | — | **新增**：长期记忆——`<dshHome>/agent-memory` 下的 markdown 存储、四个开关（全局 / Agent / 自动 / 询问）、系统提示注入、`memory_add` 工具，以及一个用 Agent 自身模型把圈选消息浓缩成记忆的记忆按钮 |
| `packages/extensions/dsh-schedule-toggle` | — | **新增**：Web 设置→通用设置页的 **“定时提醒”** 开关；通过 profile `cordis.patch.yml`（热重载、无需重启）切换 `time-context` + `schedule` 插件。附带 Agent 技能 `web-schedule` / `web-browser` / `agent-memory`，覆盖定时提醒、内置浏览器、记忆三类工作流 |
| `packages/preset/agent-presets` | `standard` 全量工具集 | **新增「定义模式」**：per-agent 按需环境——在 Web 界面勾选本次对话所需能力（终端 / 文件读写 / 文件检索 / 提问用户 / 待办 / 后台任务 / 技能 / 目标 / 网页检索 / 浏览器 / 计划模式 / 压缩 / 子代理 / 工作流 / Ralph 循环等，组块可拆分为独立勾选的子能力），宿主据此生成一次性合并预设（`<agentId>-env-<slug>`）并绑定空白会话；组装是 `standard` 的**严格子集**，可让宿主用会话自身模型分析描述、辅助推断能力勾选 |
| `packages/client/ui-conversation` | 只读消息流 | **新增：编辑并重新生成** — 每条已发送的用户消息都有内联编辑入口：修改文本，保留 / 移除 / 新增图片（png / jpeg / webp / gif）后重发。会话从被编辑消息处**分叉（fork）**：原会话保留，其后的轮次不再延续，分叉继承原会话的模型选择。重发失败时视图保持原位并自动清理残留的空分叉会话；上下文压缩导致轮次离开当前窗口后，对应消息不可再编辑 |

并继承上游 `0.1.1-rc.2` 的全部能力——含 **统一图像请求管线**（规范化附件、路由级请求版本、DeepSeek Files 生命周期）。

### 从本 fork 运行

```sh
git clone https://github.com/iStarryDust/deepseek-harness-custom-Starry.git
cd deepseek-harness-custom-Starry
pnpm install
pnpm run build
pnpm dsh web
```

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
