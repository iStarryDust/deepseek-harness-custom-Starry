# DeepSeek Harness Custom

[English](README.en.md) | 中文

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（release `0.1.1-rc.1`）的自定义发行版，引入以 **Agent 为身份** 为核心的 Agent 管理层。

## 功能特性

- **Agent 管理界面**（`packages/client/ui-agents`）：侧边栏用户 Agent 列表，支持创建、档案编辑与按 Agent 分组的聊天记录。
- **Agent 即身份**：Agent 由名字、语言、描述与人格提示词定义；能力在开新对话时选择（标准 / PTC / 极简模式）。
- **组合预设**：开新对话时组合 `<agentId>-<modeId>` 预设，将所选模式的工具组合与 Agent 人格合并；组合预设存放于各 Agent 的 `modes/<模式>/` 目录。
- **直接预设绑定**：从 Agent 页创建的会话直接绑定该 Agent 的组合预设。
- **人格格式**：persona 行包含语言指令、工作目录行与用户人格提示词原文。
- **归属持久化**：Agent↔会话归属记录于会话日志，重启后保持。
- **会话管理**：每条聊天记录支持重命名 / 归档 / 物理删除。

## 环境要求

- Node.js >= 22
- pnpm

## 构建

```bash
git clone https://github.com/iStarryDust/deepseek-harness-custom-Starry.git
cd deepseek-harness-custom-Starry
pnpm install
pnpm run build
```

## 运行

```bash
pnpm dsh web
```

`pnpm run build` 构建仓库产物；`pnpm dsh web` 使用已构建产物（不重新构建）。

浏览器访问 http://127.0.0.1:3080。

## 配置

首次启动后编辑 `~/.dsh/.credentials.yaml` 配置 API Key：

```yaml
deepseek-official:
  apiKey: sk-...
```

## 与上游的差异

| 模块 | 上游 rc.7 | 本仓库 |
|---|---|---|
| `packages/client/ui-agents` | 不存在 | 新增：Agent 管理界面 |
| 侧边栏 | 新会话 / 工作区 | 我的 Agent / 创建 Agent / 返回 |
| 组合预设布局 | 平级目录 | 嵌套于 `agent/modes/<模式>/` |
| 从 Agent 页创建会话 | 延迟 hero 绑定 | 直接绑定组合预设 |
| persona 行 | 人格 + 语言指令 + 运行时模板 | 语言指令 + 工作目录 + 人格原文 |
| `session.remove` | 注入 bug | 已修复 |
| 设置页 Agent 预设入口 | 默认行 + 管理分区 | 已移除；管理收归侧边栏 |

未合并上游 rc.8 的改动（多模态、子代理管理、Windows PTY）。

## 说明

- 源码改动需重新构建对应 `lib/` 产物后生效：host 端包（`npm run build:lib:host`）需重启 DSH；client 端包（`npm run build:lib:client`）刷新页面即可。
- 构建若以 exit code 134（内存不足）失败，请先增大堆：`set NODE_OPTIONS=--max-old-space-size=8192`（Windows cmd）。
- 若 TypeScript 报 `Property 'x' does not exist on type 'TypertClientRemote'`，删除仓库内 `*.tsbuildinfo` 增量缓存后重新构建。

## License

MIT，继承自上游 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。
