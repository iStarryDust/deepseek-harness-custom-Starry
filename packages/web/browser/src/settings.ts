/**
 * `browser` settings namespace and plugin composition config.
 *
 * Two distinct shapes live here:
 * - `BrowserSettings` / `SettingsConfig` are the **user-facing** settings the
 *   Plugins card edits (the agent-use switch and the request headers).
 * - `BrowserPluginConfig` / `Config` are the **composition** config that says
 *   how the plugin is loaded (whether this layer registers only the agent tool,
 *   and the tool's timeout), and are never part of the settings section.
 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** The settings namespace owned by this plugin. */
export const BROWSER_SETTINGS_NAMESPACE = settingsNamespace('browser')

/** Edge-flavored default user agent used to seed the request headers. */
export const DEFAULT_EDGE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'

/** Default request headers, as JSON text, in an Edge-browser style. */
export const DEFAULT_REQUEST_HEADERS = JSON.stringify(
  {
    'User-Agent': DEFAULT_EDGE_USER_AGENT,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  null,
  2,
)

/** Default cooperative tool-call budget (ms) for one `browser_navigate` call. */
export const DEFAULT_BROWSER_TOOL_TIMEOUT_MS = 30_000

/** The resolved `browser` settings section (user-facing). */
export interface BrowserSettings {
  /** Whether the agent tool may drive the built-in browser. */
  agentUseBrowser?: boolean
  /** JSON object text applied as extra request headers when the browser navigates. */
  requestHeaders?: string
}

/** schemastery schema for the `browser` settings namespace. */
export const SettingsConfig: z<BrowserSettings> = z.object({
  agentUseBrowser: z.boolean().default(false),
  requestHeaders: z.string().default(DEFAULT_REQUEST_HEADERS),
})

/** Plugin composition config (not a user setting). */
export interface BrowserPluginConfig {
  /**
   * Register only the model-facing tool, assuming the host layer already owns
   * the settings namespace and the `ctx.browser` runtime. Used by the
   * per-session agent layer so the plugin does not re-register its namespace.
   */
  toolOnly?: boolean
  /**
   * Whether the host layer also registers the model-facing tools. `false`
   * keeps the settings namespace and the `ctx.browser` runtime mounted while
   * leaving tool registration to preset `toolOnly` rows — a preset that omits
   * the `browser` row (e.g. an env "define" mode that did not pick the
   * browser) then gets no browser tools at all.
   */
  registerTool?: boolean
  /** Cooperative tool-call timeout budget (ms). */
  timeoutMs?: number
}

/** schemastery schema for the plugin composition config. */
export const Config: z<BrowserPluginConfig> = z.object({
  toolOnly: z.boolean().default(false),
  registerTool: z.boolean().default(true),
  timeoutMs: z.number().min(1).default(DEFAULT_BROWSER_TOOL_TIMEOUT_MS),
})
