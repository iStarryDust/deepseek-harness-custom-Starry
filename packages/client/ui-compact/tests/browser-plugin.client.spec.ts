/**
 * ui-compact plugin halves: the browser entry's dictionary and turn-tail-meta
 * registrations against the real SlotRegistry (with fiber teardown proving
 * removal — HMR safety), the inert node entry, and the invariant companion's
 * ownership reservation.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as CompactInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

const SID = 's1' as SessionId

/** Slot ledger reader: entry ids currently registered in the turn-tail meta list. */
function metaEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.chat.turnTailMeta')
    .map(entry => entry.options.id)
}

/**
 * Boot the browser half over a real slot tree that declares the meta list.
 * @param execute - the remote command executor the compact verb rides.
 */
async function bench(execute?: () => Promise<unknown>): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.chat.turnTailMeta': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  // The locale plugin binds a settings scope, which reads the connection handle
  // and the forwarded-event port.
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  const commandsRemote = { execute: execute ?? (() => Promise.resolve({ ok: true, value: { commandId: 'c', result: { kind: 'success' } } })) }
  ctx.provide('remote', { commands: commandsRemote, $on: () => () => {} } as never)
  ctx.provide('remote.commands', commandsRemote as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  // These specs assert the shipped Chinese copy. There is no jsdom `window` in
  // this lane, so browser-language detection never runs and the locale comes
  // from FALLBACK_LOCALE (en): state the asserted locale explicitly.
  ctx.locale.setLocale('zh')
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

/** Resolve the session inject face of the registered turn-tools entry. */
function entryInject(ctx: Context): (sessionId: SessionId) => { compact: () => Promise<{ ok: boolean; text?: string }> } {
  const entry = ctx.slots.entries('conversation.chat.turnTailMeta')
    .find(entry => entry.options.id === 'turn-tools')!
  return entry.inject as unknown as (sessionId: SessionId) => { compact: () => Promise<{ ok: boolean; text?: string }> }
}

describe('ui-compact browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.commands'])
  })

  it('registers the turn-tail meta entry, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(metaEntryIds(ctx)).toContain('turn-tools')
    await fiber.dispose()
    expect(metaEntryIds(ctx)).not.toContain('turn-tools')
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('action.compact')).toBe(zh['action.compact'])
    ctx.locale.setLocale('en')
    expect(translate('action.compact')).toBe(en['action.compact'])

    // Withdrawn dictionaries leave the key unresolved rather than translated.
    await fiber.dispose()
    expect(translate('action.compact')).not.toBe(en['action.compact'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('addresses the command at the session the entry is injected for', async () => {
    const execute = vi.fn(() => Promise.resolve({
      ok: true,
      value: { commandId: 'c', result: { kind: 'success' } },
    }))
    const { ctx, fiber } = await bench(execute)
    const face = entryInject(ctx)(SID)

    await expect(face.compact()).resolves.toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith(SID, '/compact', [])
    await fiber.dispose()
  })

  it('reports transport failures from the command execute path', async () => {
    const { ctx, fiber } = await bench(() => Promise.resolve({
      ok: false,
      error: { code: 'offline', message: 'no channel' },
    }))
    const face = entryInject(ctx)(SID)

    await expect(face.compact()).resolves.toEqual({
      ok: false,
      text: expect.stringContaining('no channel'),
    })
    await fiber.dispose()
  })

  it('reports an unmatched command as malformed', async () => {
    const { ctx, fiber } = await bench(() => Promise.resolve({ ok: true, value: undefined }))
    const face = entryInject(ctx)(SID)

    await expect(face.compact()).resolves.toEqual({
      ok: false,
      text: expect.stringContaining('unknown or malformed'),
    })
    await fiber.dispose()
  })

  it('reports an admitted command that failed in the handler', async () => {
    const { ctx, fiber } = await bench(() => Promise.resolve({
      ok: true,
      value: { commandId: 'c', result: { kind: 'error', text: 'busy' } },
    }))
    const face = entryInject(ctx)(SID)

    await expect(face.compact()).resolves.toEqual({ ok: false, text: 'busy' })
    await fiber.dispose()
  })
})

describe('ui-compact node half', () => {
  it('contributes no host behavior', () => {
    // The node half exists only so the plugin appears in the Loader tree.
    expect(applyNode).not.toThrow()
  })
})

describe('ui-compact invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(CompactInvariant)
    await fiber.await()
    expect(CompactInvariant.name).toBe('client-ui-compact-invariant')
    expect(CompactInvariant.inject).toEqual(['invariants'])
    // Emitting an unrelated event proves the companion installed no audit.
    expect(() => { (ctx.emit as (event: string) => void)('slots/changed') }).not.toThrow()
    await fiber.dispose()
  })
})
