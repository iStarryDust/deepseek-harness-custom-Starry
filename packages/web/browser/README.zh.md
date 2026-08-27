# @deepseek-ai/dsh-browser

[English](README.md) | 中文

DeepSeek Harness 的内置浏览器插件。它持有 `browser` 设置命名空间，暴露 `ctx.browser` 运行时，并注册面向模型的 `browser_open` / `browser_interact` 工具，使 Agent 能够打开并操作真实网页。

浏览器是基于 Playwright 的 Chromium，安装于 `~/.dsh/browser`。路径通过 `dshHomePath('browser')` 解析，因此相对于 Harness 主目录（`$DSH_HOME` 或 `~/.dsh`），并在安装时自动创建。

## 能力

- **安装 / 检测** — `host.browserProbe` 报告是否已安装 Chromium；`host.browserInstall` 通过 Playwright CLI 安装（fire-and-forget，远程调用立即返回），目标目录为 `~/.dsh/browser`。
- **Agent 使用开关** — `agentUseBrowser` 控制浏览器工具是否可用。关闭时工具调用返回"未启用"提示。
- **请求头** — `requestHeaders` 为浏览器导航时附加的请求头 JSON 对象，默认带 Edge 风格取值。
- **browser_open** — 打开 URL，等待动态渲染（`networkidle`），返回渲染后的标题与正文。
- **browser_interact** — 对已打开的页面执行 click / type / scroll / wait / content 操作，会话在多次调用间保持。

## 有状态会话

运行时保持单个浏览器会话，以**有头**模式启动，使人类可看到窗口并完成登录流程（例如扫码）。会话按需创建，空闲超时为 5 分钟；若窗口被关闭或浏览器断开，下次调用会自动重建会话。

## 加载模式

该插件在两个位置加载：

- **宿主层**（基础组合中的 `browser` 行，不含 `toolOnly`）— 注册设置命名空间与 `ctx.browser` 运行时，再注册工具。
- **Agent 层**（预设中带 `toolOnly: true` 的 `browser` 行）— 仅针对继承的 `ctx.browser` 注册模型工具，避免命名空间重复注册。

## 配置

| 键 | 默认值 | 说明 |
|---|---|---|
| `toolOnly` | `false` | 仅注册工具，假定宿主层已拥有设置命名空间与运行时。 |
| `timeoutMs` | `30000` | 合作的工具调用预算（毫秒）。 |

## 设置

| 键 | 默认值 | 说明 |
|---|---|---|
| `agentUseBrowser` | `false` | Agent 工具是否可驱动内置浏览器。 |
| `requestHeaders` | Edge 风格 JSON | 浏览器导航时附加的请求头（JSON 对象文本）。 |
