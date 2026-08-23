/**
 * Compact-and-memory turn-tail controls, browser half: contributes the
 * `conversation.chat.turnTailMeta` entry. The compact verb dispatches the
 * host `/compact` command through the existing command chain (admission and
 * AI summarization stay with the host compaction backend); memory is a
 * reserved placeholder entry only.
 * @module @deepseek-ai/dsh-client-ui-compact/client
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the generated Remote API (remote.commands.execute) and the
// ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ui-conversation SlotMap merge (the turnTailMeta entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { TurnTools } from './TurnTools.tsx'
import type { CompactOutcome, TurnToolsInjected } from './TurnTools.tsx'
import { en, NS, zh } from './locales.ts'

export type { CompactOutcome, TurnToolsInjected, TurnToolsProps } from './TurnTools.tsx'
export type { CompactKey } from './locales.ts'

/** Required services: the slot registry, the command Remote namespace, the copy. */
export const inject = ['slots', 'locale', 'remote', 'remote.commands']

/**
 * Client plugin body: register the dictionaries and the turn-tail meta entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-compact: dictionaries')

  ctx.slots.inject('conversation.chat.turnTailMeta', () => ctx.slots.register({
    name: 'conversation.chat.turnTailMeta',
    id: 'turn-tools',
    order: 10,
    locale: NS,
    inject: (sessionId: SessionId): TurnToolsInjected => ({
      compact: async (): Promise<CompactOutcome> => {
        const result = await ctx.remote.commands.execute(sessionId, '/compact', [])
        if (!result.ok) {
          return { ok: false, text: `command.execute failed: ${result.error.code}: ${result.error.message}` }
        }
        if (result.value === undefined) {
          return { ok: false, text: 'unknown or malformed command: /compact' }
        }
        if (result.value.result.kind === 'error') {
          return { ok: false, text: result.value.result.text }
        }
        return { ok: true }
      },
    }),
  }, TurnTools))
}
