/**
 * Built-in browser plugin. Owns the `browser` settings namespace (the agent
 * use switch and the request headers), the `ctx.browser` runtime, and the
 * model-facing `browser_navigate` tool.
 *
 * Two loading modes:
 * - **Host layer** (the `browser` row in the base composition, `toolOnly`
 *   absent): registers the settings namespace and the `ctx.browser` runtime,
 *   then the tool.
 * - **Agent layer** (a `browser` row with `toolOnly: true` in a preset): only
 *   registers the model tool against the inherited `ctx.browser`, so the same
 *   namespace is never registered twice.
 * @module @deepseek-ai/dsh-browser
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import {
  BROWSER_SETTINGS_NAMESPACE,
  SettingsConfig,
  DEFAULT_BROWSER_TOOL_TIMEOUT_MS,
  DEFAULT_REQUEST_HEADERS,
  type BrowserSettings,
  type BrowserPluginConfig,
} from './settings.ts'
import { createBrowserRuntime } from './browser.ts'
import { applyBrowserTool } from './tool.ts'

export {
  BROWSER_SETTINGS_NAMESPACE,
  SettingsConfig,
  Config,
  DEFAULT_BROWSER_TOOL_TIMEOUT_MS,
  DEFAULT_EDGE_USER_AGENT,
  DEFAULT_REQUEST_HEADERS,
  type BrowserSettings,
  type BrowserPluginConfig,
} from './settings.ts'
export { browserRoot, createBrowserRuntime, parseHeaders } from './browser.ts'
export type {
  BrowserActAction,
  BrowserActArgs,
  BrowserPageResult,
  BrowserRuntime,
} from './browser.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser'

/** Services required by the browser plugin. */
export const inject = ['tools', 'systemPrompt']

/**
 * Mount the browser plugin.
 * @param ctx - the plugin context.
 * @param config - the resolved composition config (schema defaults applied).
 */
export function apply(ctx: Context, config: BrowserPluginConfig): void {
  const timeoutMs = config.timeoutMs ?? DEFAULT_BROWSER_TOOL_TIMEOUT_MS

  // Agent layer: the host layer already registered the namespace and runtime;
  // only the model tool is registered here, against the inherited runtime.
  if (config.toolOnly) {
    const runtime = ctx.get('browser')
    if (runtime !== undefined) applyBrowserTool(ctx, runtime, timeoutMs)
    return
  }

  let current: () => BrowserSettings = () => ({
    agentUseBrowser: false,
    requestHeaders: DEFAULT_REQUEST_HEADERS,
  })
  installSettingsSection(ctx, BROWSER_SETTINGS_NAMESPACE, SettingsConfig, {}, {
    setSource: (source) => {
      current = source
    },
    // The tool and the runtime read `current()` at execution time, so a
    // committed switch needs no re-registration.
    onChange: () => {},
  })

  const runtime = createBrowserRuntime(() => current())
  ctx.provide('browser', runtime)
  applyBrowserTool(ctx, runtime, timeoutMs)
}
