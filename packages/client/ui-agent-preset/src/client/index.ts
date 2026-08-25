/**
 * Agent-preset surface plugin, browser half — two surfaces over one roster:
 * a chip on the new-session screen for the mode of the session about to
 * start, and a read-only label in the session header reporting the preset a
 * session already runs.
 *
 * The General-settings default row and the roster-management section were
 * removed (2026-08-21): agent management lives in the sidebar (ui-agents),
 * and the default-preset field only misled when it could point at an agent
 * body. The hero chip and the header label keep working off the same roster
 * and settings namespace.
 *
 * A running session keeps the composition it began with (the host refuses to
 * adopt an existing session under a different preset). That is what splits
 * the choice from the display: the hero chip is before-the-fact, while the
 * header only reports what a session already runs.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face
// (the settings invalidation rides the allowlist) into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { AgentPresetLabel } from './AgentPresetLabel.tsx'
import type { AgentPresetLabelInjected } from './AgentPresetLabel.tsx'
import { AgentPresetSeat } from './AgentPresetSeat.tsx'
import type { AgentPresetSeatInjected } from './AgentPresetSeat.tsx'
import { AgentPresetSeatController } from './seat-store.ts'
import type { SeatSessionSummary } from './seat-store.ts'
import { en, zh } from './locales.ts'
import { AGENT_PRESET_SETTINGS_NS, AgentPresetSettingsController } from './settings-store.ts'

export type { AgentPresetLabelInjected, AgentPresetLabelProps } from './AgentPresetLabel.tsx'
export type { AgentPresetSeatInjected, AgentPresetSeatProps } from './AgentPresetSeat.tsx'
export type { AgentPresetSeatState, SeatSessionSummary } from './seat-store.ts'
export type { AgentPresetOption, AgentPresetSettingsState } from './settings-store.ts'
export { AGENT_PRESET_SETTINGS_NS, writeDefaultPreset } from './settings-store.ts'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Mount the new-session chip and the session-header label.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  const controller = new AgentPresetSettingsController(api, ctx.settingsScope.describe())
  // One roster, two surfaces. The chip is registered in a later scope, so it
  // subscribes here rather than being reached from this one.
  const rosterReaders = new Set<() => void>()

  ctx.effect(() => ctx.locale.register('settings.agentPreset', { zh, en }), 'ui-agent-preset: settings dictionaries')

  ctx.effect(() => {
    // The roster is a live directory and the default is a settings field, so
    // both an external settings edit and a reconnect can move the header.
    const refresh = (): void => { void controller.load() }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns) => {
        if (ns !== AGENT_PRESET_SETTINGS_NS) return
        refresh()
      }),
      ctx.on('connection/reset', () => { refresh() }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-agent-preset: settings refresh')

  // The new-session chip and the header label: one controller, because the
  // staged choice belongs to the flow rather than to any one session.
  ctx.inject(['slots', 'conversation', 'sessions', 'workspaces'], (scope: ClientContext) => {
    const api = (scope.get('connection') as ConnectionHandle).api
    // The chat-time agent context, when ui-agents is mounted: a mode pick
    // from an agent page then composes a combined preset for that agent.
    const agents = scope.get('uiAgents') as
      | {
        pendingAgent: () => string | undefined
        composeForPendingAgent: (modeId: string) => Promise<string | undefined>
        modeIdFor: (combinedId: string) => string | undefined
        consumePendingAgent: () => void
      }
      | undefined
    const seat = new AgentPresetSeatController(api, (): SeatSessionSummary | undefined => {
      const state = scope.sessions.list.getSnapshot()
      const summary = state.current === undefined ? undefined : state.byId[state.current]
      return summary === undefined
        ? undefined
        : {
          id: summary.id,
          blank: summary.blank,
          ...summary.agentPreset === undefined ? {} : { agentPreset: summary.agentPreset },
        }
    }, (sessionId, agentPreset) => {
      scope.sessions.noteAgentPreset(sessionId as never, agentPreset)
    }, agents === undefined ? undefined : {
      pendingAgent: agents.pendingAgent,
      composeForPendingAgent: agents.composeForPendingAgent,
      modeIdFor: agents.modeIdFor,
      consumePendingAgent: agents.consumePendingAgent,
    })

    const seatInjected = (): AgentPresetSeatInjected => ({
      hooks: { agentPresetSeat: seat.store },
      load: () => seat.load(),
      select: (id: string) => seat.select(id),
      introduced: () => { seat.introduced() },
    })

    const labelInjected = (): AgentPresetLabelInjected => ({
      hooks: { agentPresets: controller.store },
      load: () => controller.load(),
    })

    scope.effect(() => {
      // Connecting a workspace either creates a blank session or reuses one,
      // and either way the chip's pick predates it — so the stage is applied
      // when the session arrives, not when it was made.
      const stop = scope.sessions.list.subscribe(() => { void seat.apply() })
      // The chip opens on the deployment default, so a default changed from
      // settings moves it too — otherwise the screen that starts the next
      // session keeps offering the previous default until a reload.
      const settingsMoved = scope.remote.$on('settings/document-updated', (ns) => {
        if (ns !== AGENT_PRESET_SETTINGS_NS) return
        void seat.load()
      })
      // Every tab folds the committed preset into the shared session row; the
      // initiating tab may already have applied the RPC echo, which is idempotent.
      const presetSelected = scope.remote.$on('agent-preset/selected', (sessionId, agentPreset) => {
        scope.sessions.noteAgentPreset(sessionId, agentPreset)
      })
      // Authoring writes a FILE, not a setting, so nothing on the wire
      // announces it — without this the screen that starts the next session
      // keeps offering the roster as it stood when the chip first loaded.
      const readRoster = (): void => { void seat.load() }
      rosterReaders.add(readRoster)
      const chip = scope.slots.register({
        name: 'conversation.hero.agentPreset',
        locale: 'settings.agentPreset',
        inject: seatInjected,
      }, AgentPresetSeat)
      const label = scope.slots.register({
        name: 'conversation.session.header.actions',
        id: 'agent-preset',
        // Static session context occupies the header's leading negative-order band.
        order: -10,
        locale: 'settings.agentPreset',
        inject: labelInjected,
      }, AgentPresetLabel)
      return () => {
        stop()
        settingsMoved()
        presetSelected()
        rosterReaders.delete(readRoster)
        chip()
        label()
      }
    }, 'ui-agent-preset: new-session chip and header label')
  })
}
