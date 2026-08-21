/** Registers the sidebar shell into the layout-owned slot. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SidebarRootInjected } from './contract/slots.ts'
import { SidebarRoot } from './SidebarRoot.tsx'
import { en, zh, type SidebarKey } from './locales.ts'

export type {
  SidebarBrandMarkOwnerProps, SidebarBrandNameOwnerProps, SidebarFooterActionOwnerProps,
  SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from './contract/slots.ts'
export type { SidebarKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar shell controls copy. */
    sidebar: SidebarKey
  }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * The agent browser's view moved; the shell reshapes its primary control
     * (back arrow inside an agent, create otherwise). Mirrors ui-agents.
     * @mode listen
     */
    'ui-agents/view-changed'(view: string): void
    /**
     * The shell's primary control was pressed; the agent surface acts on it
     * by its view. Mirrors ui-agents.
     * @mode emit
     */
    'ui-agents/primary-action'(): void
  }
}

/** Dictionary namespace owned by this plugin (shell controls copy). */
const NS = 'sidebar'

/** Services required by the sidebar plugin. */
export const inject = ['slots', 'layout', 'sessions', 'workspaces', 'locale']

/** Registers the sidebar shell and its service callbacks.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar: dictionaries')

  // Whether the agent surface is inside an agent page. The shell only reads
  // this to shape its primary control; ui-agents owns the state and announces
  // every move. Defaults to false (the roster page), matching the browser's
  // initial view even before the first announcement lands.
  const inAgentStore = createSnapshotStore({ inAgent: false })
  const stopView = ctx.on('ui-agents/view-changed', (view) => {
    const next = view === 'agent'
    if (inAgentStore.getSnapshot().inAgent !== next) {
      inAgentStore.set({ inAgent: next })
    }
  })
  ctx.effect(() => stopView, 'ui-sidebar: agent view listener')

  const injectProps = (): SidebarRootInjected => ({
    // The primary control: ui-agents decides by its view (back from an agent
    // page, open the create form on the roster page). The shell only signals.
    pressPrimary: () => { ctx.emit('ui-agents/primary-action') },
    inAgentPage: {
      getSnapshot: () => inAgentStore.getSnapshot().inAgent,
      subscribe: listener => inAgentStore.subscribe(listener),
    },
    // The brand mark still starts a bare session (current Session
    // Workspace, then recent Workspace).
    startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
  })
  ctx.effect(
    () => ctx.slots.register({
      name: 'sidebar',
      locale: NS,
      // The shell owns geometry; the agent-management surface (ui-agents)
      // registers the whole browsing region at a lower slot priority.
      children: {
        'sidebar.brand.mark': { kind: 'single', scope: 'root' },
        'sidebar.brand.name': { kind: 'single', scope: 'root' },
        'sidebar.workspaces': { kind: 'single', scope: 'root' },
        'sidebar.settings': { kind: 'single', scope: 'root' },
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
      },
      inject: injectProps,
    }, SidebarRoot),
    'ui-sidebar: slot registration',
  )
}
