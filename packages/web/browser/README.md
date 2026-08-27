# @deepseek-ai/dsh-browser

English | [中文](README.zh.md)

The built-in browser plugin for DeepSeek Harness. It owns the `browser` settings namespace, exposes the `ctx.browser` runtime, and registers the model-facing `browser_open` / `browser_interact` tools so an agent can open and interact with real web pages.

The browser is a Playwright-derived Chromium installed under `~/.dsh/browser`, resolved through `dshHomePath('browser')` so it is relative to the Harness home (`$DSH_HOME` or `~/.dsh`) and created automatically on install.

## Capabilities

- **Install / detect** — `host.browserProbe` reports whether a Chromium is installed; `host.browserInstall` runs the Playwright CLI install (fire-and-forget, so the remote call returns immediately) into `~/.dsh/browser`.
- **Agent use switch** — `agentUseBrowser` gates whether the browser tools are usable. When off, tool calls return a "not enabled" message.
- **Request headers** — `requestHeaders` is a JSON object applied as extra headers when the browser navigates, seeded with an Edge-flavoured default.
- **browser_open** — navigate to a URL, wait for dynamic rendering (`networkidle`), and return the rendered title and text.
- **browser_interact** — click / type / scroll / wait / content against the live page. The session is kept between calls.

## Stateful session

The runtime keeps one browser session, launched **headed** so a human can see the window and complete sign-in flows (for example scanning a QR code). The session is created lazily, has an idle timeout of 5 minutes, and is re-created automatically if the window is closed or the browser disconnects.

## Loading modes

The plugin is loaded in two places:

- **Host layer** (the `browser` row in the base composition, `toolOnly` absent) — registers the settings namespace and the `ctx.browser` runtime, then the tools.
- **Agent layer** (a `browser` row with `toolOnly: true` in a preset) — only registers the model tools against the inherited `ctx.browser`, so the namespace is never registered twice.

## Config

| Key | Default | Meaning |
|---|---|---|
| `toolOnly` | `false` | Register only the tools, assuming the host layer owns the settings namespace and the runtime. |
| `timeoutMs` | `30000` | Cooperative tool-call budget (ms). |

## Settings

| Key | Default | Meaning |
|---|---|---|
| `agentUseBrowser` | `false` | Whether the agent tools may drive the built-in browser. |
| `requestHeaders` | Edge-flavoured JSON | Extra request headers, as a JSON object text. |
