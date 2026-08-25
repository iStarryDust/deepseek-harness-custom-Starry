/**
 * Agent-memory settings page, browser half: registers the Agent记忆 section
 * once the settings shell's section slot is on the ledger, and wires its page
 * store to the `agent-memory` settings scope plus the memory domain wire.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { MemorySection } from './MemorySection.tsx'
import type { MemorySectionInjected } from './MemorySection.tsx'
import { MemorySettingsController, decodeMemorySection } from './memory-store.ts'
import { en, NS, zh, type AgentMemoryKey } from './locales.ts'

export type { MemorySectionInjected, MemorySectionProps } from './MemorySection.tsx'
export { MemorySettingsController, decodeMemorySection } from './memory-store.ts'
export type { AgentMemoryKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The agent-memory settings page copy. */
    'settings.agentMemory': AgentMemoryKey
  }
}

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply; registration depends on the slot declaration being on
 * the ledger, which `slots.inject()` guarantees.
 */
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

/**
 * Register the agent-memory section and its dictionaries.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-agent-memory: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const scope = ctx.settingsScope.bind({ namespace: 'agent-memory', decode: decodeMemorySection })
  const controller = new MemorySettingsController(scope, connection.api)
  // Follow the scope and load the global document immediately: the section's
  // switches must render live host state and refresh after every write, so the
  // controller subscribes from activation rather than first paint.
  void controller.load()
  const t = ctx.locale.bind(NS)
  const injected = (): MemorySectionInjected => ({
    controller,
    hooks: { snapshot: controller.store },
    api: connection.api,
    t,
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'agent-memory',
    order: 20,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, MemorySection))
}
