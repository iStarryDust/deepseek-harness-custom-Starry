---
name: web-browser
description: Use when the user wants to browse a web page, or the agent needs to navigate, click, type, scroll, or read a page through the built-in browser.
---

# Built-in Browser

## Tools

- **`browser_open`** — open a URL, wait for dynamic rendering, and return the page title and visible text.
- **`browser_interact`** — act on the live page: `click` / `type` / `scroll` / `wait` / `content`.

## Behavior

- **Stateful session.** Both tools share one open browser page; interactions persist between calls.
- Requires installing the built-in browser first: **Settings → 插件 → 内置浏览器 → 安装内置浏览器**.

## Notes

- `browser_open` navigates and returns a status; `browser_interact` does not navigate.
- Only one live session; `isConcurrencySafe` is false.
- **Screenshot alternative.** The built-in browser tools return text only. When a visual view is required *and* the current model supports image input, screenshot via `pwsh` + Playwright (launch chromium from `~/.dsh/browser`, `page.screenshot()` → PNG) and read it with `read_image`. This is an independent Playwright session, not the built-in browser's live session.
