/**
 * Agent management plugin, browser half: registers the agent browser into the
 * sidebar shell's browsing hole (shadowing the workspace browser at a lower
 * priority), gates the conversation region (blank while on the roster/create
 * surfaces), and answers the shell's primary-control presses (create on the
 * roster page, back from an agent page).
 *
 * The roster is a live host directory, so the browser re-reads on mount and
 * after every mutation instead of caching; the base-mode options are the
 * shipped system presets minus the meta "cordis" mode.
 *
 * One controller owns the view state; the sidebar browser and the
 * conversation gate both bind to it (the gate registers a shadow occupant for
 * the `conversation` slot only while the view is the roster or a create form).
 *
 * Event contract (literals on both sides; cross-plugin value imports are
 * forbidden by the client bundle purity gate):
 * - `ui-agents/view-changed` (emitted) — the browser view moved; the shell
 *   uses it to shape its primary control (back vs create).
 * - `ui-agents/primary-action` (listened) — the shell's control was pressed.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-sidebar SlotMap merge ('sidebar.workspaces').
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the ui-layout SlotMap merge ('conversation').
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  createSnapshotStore, type ClientContext, type SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { AgentBrowser } from './AgentBrowser.tsx'
import type { AgentBrowserInjected } from './AgentBrowser.tsx'
import { BlankScreen } from './BlankScreen.tsx'
import { AgentBrowserController } from './stores.ts'
import type { AgentFormInput } from './stores.ts'
import { en, zh, type AgentsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The agent roster and form copy. */
    agents: AgentsKey
  }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * The agent browser's view moved; the sidebar shell shapes its primary
     * control from it (back arrow inside an agent, create otherwise).
     * @mode emit
     */
    'ui-agents/view-changed'(view: string): void
    /**
     * The sidebar shell's primary control was pressed; the browser acts on
     * it by its current view (back from an agent, open create otherwise).
     * @mode emit
     */
    'ui-agents/primary-action'(): void
  }
  interface Context {
    /**
     * The chat-time agent context: which agent a pending chat-start belongs
     * to, and how the hero's mode pick composes a combined preset for it.
     */
    uiAgents?: UiAgentsService
  }
}

/** The service ui-agents publishes for the chat-time mode pick. */
export interface UiAgentsService {
  /** The agent a pending chat-start belongs to, absent otherwise. */
  pendingAgent: () => string | undefined
  /**
   * Ensure the combined preset for the pending agent + mode exists and return
   * its id.
   * @param modeId - the mode the user picked (standard / code / minimal).
   */
  composeForPendingAgent: (modeId: string) => Promise<string | undefined>
  /** Map a combined preset id back to its mode id, when it is one. */
  modeIdFor: (combinedId: string) => string | undefined
  /** Clear the pending chat context once the session has bound its preset. */
  consumePendingAgent: () => void
}

/** Dictionary namespace owned by this plugin. */
const NS = 'agents'

/** Lower priority than ui-workspace's registration (default 0): lowest renders. */
const SIDEBAR_SHADOW_PRIORITY = -20

/** Lower priority than ui-conversation's own registration (default 0). */
const CONVERSATION_SHADOW_PRIORITY = -30

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces']

/**
 * Register the agent browser and the conversation gate once their slot
 * declarations are on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-agents: dictionaries')

  const api = (ctx.get('connection') as ConnectionHandle).api
  const controller = new AgentBrowserController(api, ctx)

  // The registry-global archive set, projected for the browser's chat
  // history: archived sessions belong to no agent's list. Mirroring the
  // workspaces list store keeps the projection reactive to archive frames.
  const archived = createSnapshotStore<readonly SessionId[]>(
    ctx.workspaces.list.getSnapshot().archivedSessionIds,
  )
  const stopArchived = ctx.workspaces.list.subscribe(() => {
    archived.update(() => ctx.workspaces.list.getSnapshot().archivedSessionIds)
  })

  // Announce view moves so the shell can reshape its primary control.
  const stopViewAnnouncer = controller.subscribeView((view) => {
    ctx.emit('ui-agents/view-changed', view)
  })

  // The shell's primary control: open create on the roster page, back from
  // an agent page.
  const stopAction = ctx.on('ui-agents/primary-action', () => {
    if (controller.store.getSnapshot().view === 'agent') {
      controller.backToRoster()
    } else {
      controller.openCreate()
    }
  })

  ctx.effect(() => () => {
    stopAction()
    stopViewAnnouncer()
    stopArchived()
    controller.dispose()
  }, 'ui-agents: lifecycle')

  // The chat-time mode pick (ui-agent-preset's hero chip) needs to know which
  // agent a pending chat-start belongs to and to re-compose the combined
  // preset when the user picks a mode.
  ctx.provide('uiAgents', {
    pendingAgent: () => controller.pendingAgent(),
    composeForPendingAgent: (modeId: string) => controller.composeForPendingAgent(modeId),
    modeIdFor: (combinedId: string) => controller.modeIdFor(combinedId),
    consumePendingAgent: () => { controller.consumePendingAgent() },
  })

  ctx.slots.inject('sidebar.workspaces', () => {
    const injected = (): AgentBrowserInjected => ({
      hooks: { agents: controller.store, archived },
      load: () => controller.load(),
      selectAgent: (id: string) => { void controller.selectAgent(id) },
      back: () => { controller.back() },
      startChat: (id: string) => { void controller.startChat(id) },
      openSession: (sessionId: string) => { controller.openSession(sessionId) },
      openProfile: (id: string) => controller.openProfile(id),
      toggleCollapsed: () => { controller.toggleCollapsed() },
      create: (input: AgentFormInput) => controller.create(input),
      saveEdit: (id: string, input: AgentFormInput) => controller.saveEdit(id, input),
      remove: (id: string) => controller.remove(id),
      renameSession: async (sessionId, title) => {
        // Row → session-face hop: rename is a per-session verb (ISession),
        // not a list-service verb; the binding resolves any listed session.
        const session = ctx.sessions.binding(sessionId as SessionId)?.session
        if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
        const result = await session.rename(title)
        if (!result.ok) throw new Error(result.error.message)
      },
      archiveSession: async (sessionId) => {
        await ctx.workspaces.archiveSession(sessionId as SessionId)
      },
      removeSession: async (sessionId) => {
        await ctx.sessions.remove(sessionId as SessionId)
      },
    })

    const unregister = ctx.slots.register({
      name: 'sidebar.workspaces',
      priority: SIDEBAR_SHADOW_PRIORITY,
      locale: NS,
      inject: injected,
    }, AgentBrowser)

    return unregister
  })

  // The blank right side while browsing the roster / creating an agent. The
  // controller binds its factory only after this slot declaration is live and
  // registers / retires the shadow as the view moves.
  ctx.slots.inject('conversation', () => {
    controller.bindConversationShadow(() => ctx.slots.register({
      name: 'conversation',
      priority: CONVERSATION_SHADOW_PRIORITY,
      locale: NS,
    }, BlankScreen))

    // An idle browser shadows nothing; surface the default roster view
    // through the same reconcile path.
    void controller.load()

    return () => { controller.unbindConversationShadow() }
  })
}
