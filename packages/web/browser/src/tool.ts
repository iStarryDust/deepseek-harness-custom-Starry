/**
 * The model-facing built-in browser tools: `browser_open` (navigate and read
 * rendered content, waiting for dynamic rendering) and `browser_interact`
 * (click / type / scroll / wait / content against the live page). Both drive
 * the stateful `ctx.browser` runtime and honour the `browser` settings switch
 * at execution time.
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.tools merge and defineTool signature.
import type {} from '@deepseek-ai/dsh-tools'
// Type-only: pulls the ctx.systemPrompt merge.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { BrowserRuntime, BrowserActAction } from './browser.ts'

/** The output schema shared by both browser tools. */
const pageSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    url: { type: 'string', required: true },
    title: { type: 'string' },
    status: { type: 'number' },
    text: { type: 'string' },
  },
} as const

/**
 * Register the `browser_open` and `browser_interact` tools and their
 * system-prompt guidance.
 * @param ctx - context whose `tools` and `systemPrompt` registries receive the
 *   registration; both are effect-scoped and unregister on plugin dispose.
 * @param runtime - the `ctx.browser` runtime the tools drive (stateful).
 * @param timeoutMs - the cooperative tool-call budget (ms).
 */
export function applyBrowserTool(ctx: Context, runtime: BrowserRuntime, timeoutMs: number): void {
  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 120,
    text: 'Use the browser_open tool to open a URL in the built-in browser and read its rendered content. Use browser_interact to click, type, scroll, or wait against the already-open page (the session is kept between calls). Both only work when the built-in browser is enabled in settings.',
  })

  ctx.tools.register(defineTool({
    name: 'browser_open',
    description: 'Open a URL in the built-in browser, wait for dynamic rendering, and return the page title and visible text.',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The absolute URL to open.',
      },
    },
    output: { schema: pageSchema, render: renderPage },
    timeoutMs,
    isConcurrencySafe: () => false, // the runtime keeps one live session
    async execute(args) {
      return runtime.open(args.url)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'browser_interact',
    description: 'Interact with the already-open built-in browser page (click / type / scroll / wait / content) and return the resulting page text.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'One of click, type, scroll, wait, or content.',
      },
      selector: {
        type: 'string',
        description: 'CSS selector target for click / type / wait.',
      },
      text: {
        type: 'string',
        description: 'Text typed by type.',
      },
      amount: {
        type: 'number',
        description: 'Pixels scrolled by scroll.',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout (ms) for wait.',
      },
    },
    output: { schema: pageSchema, render: renderPage },
    timeoutMs,
    isConcurrencySafe: () => false, // the runtime keeps one live session
    async execute(args) {
      return runtime.act(args.action as BrowserActAction, args)
    },
  }))
}

/** Render a browser page result as a text block. */
function renderPage(_args: unknown, value: { title?: string; text?: string }): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: [value.title, value.text].filter(Boolean).join('\n\n') }]
}
