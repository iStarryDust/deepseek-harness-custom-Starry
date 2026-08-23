/**
 * The built-in browser runtime (`ctx.browser`): a Playwright-derived Chromium
 * installed under `~/.dsh/browser`, plus a **stateful** session the agent tools
 * drive (open a page once, then click / type / scroll / wait against the same
 * page). The install root is always relative to the Harness home, so the plugin
 * behaves identically on Windows, macOS, and Linux without an absolute path.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { BrowserSettings } from './settings.ts'

/** The built-in browser install root: `<harness-home>/browser` (e.g. `~/.dsh/browser`). */
export function browserRoot(): string {
  return dshHomePath('browser')
}

/**
 * Point Playwright's browser registry at `~/.dsh/browser`. Must run before any
 * dynamic `import('playwright')`, because the registry reads the environment
 * variable when the module first resolves.
 */
function configurePlaywrightPath(): void {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= browserRoot()
}

/**
 * Parse the request-headers JSON text into an `extraHTTPHeaders` object. An
 * empty or non-object/array JSON falls back to `undefined`.
 */
export function parseHeaders(json: string | undefined): Record<string, string> | undefined {
  if (json === undefined || json.trim() === '') return undefined
  try {
    const parsed = JSON.parse(json) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const headers = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
      return Object.keys(headers).length > 0 ? headers : undefined
    }
  } catch {
    /* Invalid JSON falls back to the browser's own headers. */
  }
  return undefined
}

/** A rendered page snapshot the tools return. */
export interface BrowserPageResult {
  /** The current page URL. */
  url: string
  /** The page title. */
  title: string
  /** The HTTP status of the last navigation, or 0 for an interaction (no nav). */
  status: number
  /** Rendered page text, capped to keep tool output bounded. */
  text: string
}

/** Interaction actions the `browser_interact` tool performs against the live page. */
export type BrowserActAction = 'click' | 'type' | 'scroll' | 'wait' | 'content'

/** Argument payload for one interaction. */
export interface BrowserActArgs {
  /** CSS selector for `click` / `type` / `wait`. */
  selector?: string
  /** Text typed by `type` (fills the field). */
  text?: string
  /** Pixels scrolled by `scroll`. */
  amount?: number
  /** Timeout (ms) for `wait`. */
  timeoutMs?: number
}

/** The capabilities served through `ctx.browser`. */
export interface BrowserRuntime {
  /** Whether a Chromium is already installed under `~/.dsh/browser`. */
  detect(): Promise<{ installed: boolean; path?: string }>
  /** Install Chromium under `~/.dsh/browser` (fire-and-forget). */
  install(): Promise<{ ok: boolean; output?: string; error?: string }>
  /** Open `url` in the (stateful) built-in browser and return the rendered content. */
  open(url: string): Promise<BrowserPageResult>
  /** Perform one interaction against the live page. */
  act(action: BrowserActAction, args?: BrowserActArgs): Promise<BrowserPageResult>
  /** Close the stateful session and release the browser. */
  close(): Promise<void>
}

/** Build a `ctx.browser` runtime bound to the current settings source. */
export function createBrowserRuntime(source: () => BrowserSettings): BrowserRuntime {
  let browser: Browser | undefined
  let context: BrowserContext | undefined
  let page: Page | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const closeSession = async (): Promise<void> => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer)
      idleTimer = undefined
    }
    try {
      await browser?.close()
    } finally {
      browser = undefined
      context = undefined
      page = undefined
    }
  }

  const scheduleIdleClose = (): void => {
    if (idleTimer !== undefined) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => { void closeSession() }, 5 * 60_000)
  }

  const ensureSession = async (): Promise<Page> => {
    // A headed window may have been closed by the user (or an idle close ran),
    // which makes the next goto fail with "browser has been closed". Re-create
    // the session when the browser or page is no longer usable.
    if (browser !== undefined && !browser.isConnected()) await closeSession()
    const current = source()
    if (browser === undefined) {
      configurePlaywrightPath()
      const { chromium } = await import('playwright')
      browser = await chromium.launch({ headless: false })
    }
    if (context === undefined) {
      const headers = parseHeaders(current.requestHeaders)
      context = await browser.newContext(headers ? { extraHTTPHeaders: headers } : {})
    }
    if (page === undefined || page.isClosed()) page = await context.newPage()
    scheduleIdleClose()
    return page
  }

  const readPage = async (status = 0): Promise<BrowserPageResult> => {
    const target = page ?? await ensureSession()
    const title = await target.title()
    const text = await target.evaluate(() => document.body?.innerText ?? '')
    return { url: target.url(), title, status, text: text.slice(0, 20_000) }
  }

  return {
    async detect(): Promise<{ installed: boolean; path?: string }> {
      configurePlaywrightPath()
      const { chromium } = await import('playwright')
      try {
        const p = chromium.executablePath()
        return existsSync(p) ? { installed: true, path: p } : { installed: false }
      } catch {
        return { installed: false }
      }
    },
    async install(): Promise<{ ok: boolean; output?: string; error?: string }> {
      configurePlaywrightPath()
      await mkdir(browserRoot(), { recursive: true })
      // Fire-and-forget: run Playwright's CLI so the remote call returns
      // immediately instead of hitting the carrier's request timeout.
      const cliPath = join(dirname(createRequire(import.meta.url).resolve('playwright/package.json')), 'cli.js')
      const child = spawn(process.execPath, [cliPath, 'install', 'chromium'], {
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserRoot() },
        stdio: 'ignore',
      })
      child.on('error', () => { /* the next detect() re-judges the install state */ })
      return { ok: true, output: '内置浏览器安装已在后台开始。' }
    },
    async open(url: string): Promise<BrowserPageResult> {
      const current = source()
      if (!current.agentUseBrowser) {
        return { url, title: '', status: 0, text: '内置浏览器未启用。请在 设置→插件→内置浏览器 中开启“启用内置浏览器”开关后重试。' }
      }
      const target = await ensureSession()
      const response = await target.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
      return {
        url: target.url(),
        title: await target.title(),
        status: response?.status() ?? 0,
        text: (await target.evaluate(() => document.body?.innerText ?? '')).slice(0, 20_000),
      }
    },
    async act(action: BrowserActAction, args: BrowserActArgs = {}): Promise<BrowserPageResult> {
      const current = source()
      if (!current.agentUseBrowser) {
        return { url: '', title: '', status: 0, text: '内置浏览器未启用。请在 设置→插件→内置浏览器 中开启“启用内置浏览器”开关后重试。' }
      }
      const target = await ensureSession()
      switch (action) {
        case 'click':
          await target.click(args.selector ?? 'body', { timeout: 10_000 })
          break
        case 'type':
          await target.fill(args.selector ?? '', args.text ?? '')
          break
        case 'scroll':
          await target.evaluate(amount => window.scrollBy(0, amount), args.amount ?? 600)
          await target.waitForTimeout(600)
          break
        case 'wait':
          if (args.selector !== undefined && args.selector !== '') {
            await target.waitForSelector(args.selector, { timeout: args.timeoutMs ?? 10_000 })
          } else {
            await target.waitForTimeout(args.timeoutMs ?? 2_000)
          }
          break
        case 'content':
          break
      }
      return readPage(0)
    },
    async close(): Promise<void> {
      await closeSession()
    },
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The built-in browser runtime. */
    browser: BrowserRuntime
  }
}
