/**
 * Registration: the new-session chip and the header label both come from one
 * apply, and each defers until the slot it fills has been declared. A pushed
 * settings change refreshes the surfaces that are already showing. The
 * General-settings default row and the roster-management section were removed
 * (2026-08-21); agent management lives in the sidebar (ui-agents).
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import { AgentPresetLabel } from '../src/client/AgentPresetLabel.tsx'
import type { AgentPresetLabelInjected } from '../src/client/AgentPresetLabel.tsx'
import { AgentPresetSeat } from '../src/client/AgentPresetSeat.tsx'
import type { AgentPresetSeatInjected } from '../src/client/AgentPresetSeat.tsx'

// These specs assert the shipped Chinese copy. The lane has no jsdom `window`,
// so browser-language detection never runs and a fresh LocaleRuntime opens on
// FALLBACK_LOCALE (en); each bench stages zh explicitly on the locale instead.

const ROSTER_ONE = {
  rpcId: 'r',
  result: {
    ok: true as const,
    value: {
      presets: [{ id: 'standard', trust: 'system', isDefault: true }],
      authorable: true,
      hasDocument: true,
    },
  },
}

/** The same roster with a second preset carrying the default. */
const ROSTER_MOVED = {
  rpcId: 'r',
  result: {
    ok: true as const,
    value: {
      presets: [
        { id: 'standard', trust: 'system', isDefault: false },
        { id: 'minimal', trust: 'system', isDefault: true },
      ],
      authorable: true,
      hasDocument: true,
    },
  },
}

async function bench() {
  const ctx = new Context()
  // The host's answer, mutable so a spec can move the default and watch who
  // re-reads it.
  let ROSTER: typeof ROSTER_ONE | typeof ROSTER_MOVED = ROSTER_ONE
  const moveDefault = (): void => { ROSTER = ROSTER_MOVED }
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  // The plugins inject `remote`; forwarded events reach them through the
  // same `$dispatch` handoff the connection sink makes.
  new TestRemote(ctx)
  const calls: string[] = []
  ctx.provide('connection', {
    api: {
      agentPresets: {
        list: () => { calls.push('list'); return Promise.resolve(ROSTER) },
        select: (payload: { agentPreset: string }) => {
          calls.push(`select:${payload.agentPreset}`)
          return Promise.resolve({ rpcId: 'r', result: { ok: true as const, value: { agentPreset: payload.agentPreset } } })
        },
      },
      settings: {
        describe: () => Promise.resolve({
          rpcId: 'r',
          result: { ok: true as const, value: { writable: true, hasDocument: true, namespaces: [] } },
        }),
        update: (payload: { patch: unknown }) => { calls.push(`settings:${JSON.stringify(payload.patch)}`); return Promise.resolve({ rpcId: 'r', result: { ok: true as const, value: {} } }) },
      },
    },
  } as never)
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, calls, moveDefault }
}

function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      conversation: { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
}

/** The conversation's own declarations, which the chip and label wait for. */
function declareConversation(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'conversation',
    children: {
      'conversation.hero.agentPreset': { kind: 'single', scope: 'root' },
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
}

/** A workspaces double recording new-session starts. */
function workspacesDouble() {
  const starts: unknown[] = []
  return {
    starts,
    startSession: (workspaceId?: unknown) => { starts.push(workspaceId ?? null) },
  }
}

/** A sessions double whose list can be moved and whose changes are pushed. */
function sessionsDouble(state: {
  current?: string
  byId: Record<string, { id: string; blank: boolean; agentPreset?: string }>
}) {
  const listeners = new Set<() => void>()
  return {
    list: {
      getSnapshot: () => state,
      subscribe: (fn: () => void) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    },
    noteAgentPreset: (sessionId: string, agentPreset: string) => {
      const summary = state.byId[sessionId]
      if (summary === undefined || summary.agentPreset === agentPreset) return
      summary.agentPreset = agentPreset
      for (const fn of listeners) fn()
    },
    /** Push a list change the way the runtime's store does. */
    notify: () => { for (const fn of listeners) fn() },
  }
}

describe('ui-agent-preset apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope'])
  })

  it('registers the new-session chip and the header label, and drops both on disposal', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    const conversation = declareConversation(slots)
    ctx.provide('conversation', {} as never)
    ctx.provide('sessions', sessionsDouble({ byId: {} }) as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    const fiber = ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply })
    await fiber.await()

    const chip = slots.entries('conversation.hero.agentPreset')[0]!
    expect(chip.component).toBe(AgentPresetSeat)
    const label = slots.entries('conversation.session.header.actions')[0]!
    expect(label.component).toBe(AgentPresetLabel)
    expect(label.options).toMatchObject({ id: 'agent-preset', order: -10 })
    await fiber.dispose()
    expect(slots.entries('conversation.hero.agentPreset')).toHaveLength(0)
    expect(slots.entries('conversation.session.header.actions')).toHaveLength(0)
    conversation()
  })

  it('moves the chip when the default changes on the settings surface', async () => {
    const { ctx, slots, moveDefault } = await bench()
    declareRoot(slots)
    const conversation = declareConversation(slots)
    ctx.provide('conversation', {} as never)
    ctx.provide('sessions', sessionsDouble({ byId: {} }) as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()

    const chip = slots.entries('conversation.hero.agentPreset')[0]!
    const seat = (chip.inject as unknown as () => AgentPresetSeatInjected)()
    await seat.load()
    expect(seat.hooks.agentPresetSeat.getSnapshot().current).toBe('standard')

    // The chip opens on the deployment default, and the setting it comes from
    // lives on another screen: without this the next session — the very one
    // the setting governs — would be composed from the previous default until
    // a reload.
    // An unrelated namespace moves nothing: the chip re-reads on its own
    // setting, not on every settings write in the process.
    moveDefault()
    ctx.remote.$dispatch('settings/document-updated', ['llm-deepseek', 1])
    await Promise.resolve()
    expect(seat.hooks.agentPresetSeat.getSnapshot().current).toBe('standard')

    ctx.remote.$dispatch('settings/document-updated', ['agent-presets', 1])
    await vi.waitFor(() => {
      expect(seat.hooks.agentPresetSeat.getSnapshot().current).toBe('minimal')
    })
    conversation()
  })

  it('folds a remote preset commit into the shared session row', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    declareConversation(slots)
    ctx.provide('conversation', {} as never)
    const state = {
      current: 's1',
      byId: { s1: { id: 's1', blank: true, agentPreset: 'standard' } },
    }
    ctx.provide('sessions', sessionsDouble(state) as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()

    ctx.remote.$dispatch('agent-preset/selected', ['s1', 'minimal'])

    expect(state.byId.s1.agentPreset).toBe('minimal')
  })

  it('applies the staged choice to the blank session the flow lands on', async () => {
    const { ctx, slots, calls } = await bench()
    declareRoot(slots)
    declareConversation(slots)
    ctx.provide('conversation', {} as never)
    const state: {
      current?: string
      byId: Record<string, { id: string; blank: boolean; agentPreset?: string }>
    } = { byId: {} }
    const sessions = sessionsDouble(state)
    ctx.provide('sessions', sessions as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()
    const chip = (slots.entries('conversation.hero.agentPreset')[0]!
      .inject as unknown as () => AgentPresetSeatInjected)()

    await chip.load()
    // Picked on the hero screen, where there is no session yet.
    await chip.select('minimal')
    expect(calls).not.toContain('select:minimal')

    state.current = 's1'
    state.byId['s1'] = { id: 's1', blank: true, agentPreset: 'standard' }
    sessions.notify()

    // Connecting a workspace produced the session; the stage reaches it there.
    await vi.waitFor(() => { expect(calls).toContain('select:minimal') })
  })

  it('applies the stage to a session that records no preset of its own', async () => {
    const { ctx, slots, calls } = await bench()
    declareRoot(slots)
    declareConversation(slots)
    ctx.provide('conversation', {} as never)
    const sessions = sessionsDouble({
      current: 's1',
      byId: { s1: { id: 's1', blank: true } },
    })
    ctx.provide('sessions', sessions as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()
    const chip = (slots.entries('conversation.hero.agentPreset')[0]!
      .inject as unknown as () => AgentPresetSeatInjected)()

    await chip.load()
    await chip.select('minimal')

    // A session created before the deployment composed presets records none;
    // reading that as "already runs it" would drop the pick on the floor.
    expect(calls).toContain('select:minimal')
  })

  it('forgets the stage once it has been spent', async () => {
    const { ctx, slots, calls } = await bench()
    declareRoot(slots)
    declareConversation(slots)
    ctx.provide('conversation', {} as never)
    const state = {
      current: 's1',
      byId: { s1: { id: 's1', blank: true, agentPreset: 'standard' } },
    }
    const sessions = sessionsDouble(state)
    ctx.provide('sessions', sessions as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()
    const chip = (slots.entries('conversation.hero.agentPreset')[0]!
      .inject as unknown as () => AgentPresetSeatInjected)()

    await chip.load()
    await chip.select('minimal')
    const spent = calls.filter(call => call === 'select:minimal').length
    sessions.notify()
    sessions.notify()

    // Every later list movement would re-apply a stage that was not cleared,
    // switching sessions the user never picked for.
    await Promise.resolve()
    expect(calls.filter(call => call === 'select:minimal')).toHaveLength(spent)
  })

  it('gives the header label the roster controller the chip shares', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    declareConversation(slots)
    ctx.provide('conversation', {} as never)
    ctx.provide('sessions', sessionsDouble({ byId: {} }) as never)
    ctx.provide('workspaces', workspacesDouble() as never)
    await ctx.plugin({ inject: [...inject, 'conversation', 'sessions', 'workspaces'], apply }).await()
    const label = (slots.entries('conversation.session.header.actions')[0]!
      .inject as unknown as () => AgentPresetLabelInjected)()

    await label.load()

    // One roster behind the header label; resolving a name costs no second
    // read beyond the controller's own.
    expect(label.hooks.agentPresets.getSnapshot().options).toEqual([{ id: 'standard', trust: 'system' }])
  })
})
