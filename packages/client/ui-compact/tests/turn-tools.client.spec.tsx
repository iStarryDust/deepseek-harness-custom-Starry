// @vitest-environment jsdom
/**
 * TurnTools rendering and gestures: both icon buttons expose their labels, the
 * compact trigger dispatches the injected verb once (and stays in flight while
 * it runs), success resets the row silently, an admitted failure shows the
 * host's detail inline for a few seconds, and the memory entry opens the
 * selectable-messages dialog (empty snapshot shows the empty state; cancel
 * closes it; a checked row hands its text to the injected remember verb).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { TurnTools } from '../src/client/TurnTools.tsx'
import type { CompactOutcome } from '../src/client/TurnTools.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
beforeEach(() => {
  vi.useFakeTimers()
})

const t = makeTranslate(zh, commonZh)

const SID = 's1' as never

/** Minimal empty conversation snapshot the dialog reads through useSession. */
const EMPTY_SNAPSHOT = {
  sessionId: SID,
  chat: {
    nodes: { values: () => [] as never[], get: () => undefined },
  },
} as unknown as ConversationSnapshot

/** Render the controls over a recording compact verb and a stub session kit. */
function mount(
  compact: () => Promise<CompactOutcome> = () => Promise.resolve({ ok: true }),
  snapshot: ConversationSnapshot = EMPTY_SNAPSHOT,
) {
  const compactFn = vi.fn(compact)
  const rememberFn = vi.fn(() => Promise.resolve())
  const useSession = ((selector: (s: ConversationSnapshot) => unknown) => selector(snapshot)) as never
  const props = {
    compact: compactFn,
    remember: rememberFn,
    useSession,
    sessionId: SID,
    t,
  } as unknown as Parameters<typeof TurnTools>[0]
  const ui = render(<TurnTools {...props} />)
  return { ui, compact: compactFn, remember: rememberFn }
}

describe('TurnTools', () => {
  it('renders both icon buttons with their accessible labels', () => {
    const { ui } = mount()

    expect(ui.getByLabelText(zh['action.compact'])).toBeTruthy()
    expect(ui.getByLabelText(zh['action.memory'])).toBeTruthy()
  })

  it('dispatches the compact verb on click and resets silently on success', async () => {
    const { ui, compact } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    await act(async () => { await Promise.resolve() })

    expect(compact).toHaveBeenCalledTimes(1)
    expect(ui.queryByRole('alert')).toBeNull()
  })

  it('shows the in-flight state and ignores repeat clicks while running', async () => {
    let release = (): void => {}
    const gate = new Promise<CompactOutcome>((resolve) => { release = () => { resolve({ ok: true }) } })
    const { ui, compact } = mount(() => gate)

    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    expect(ui.getByLabelText(zh['action.compact']).getAttribute('aria-busy')).toBe('true')
    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    expect(compact).toHaveBeenCalledTimes(1)

    release()
    await act(async () => { await gate })
  })

  it('surfaces the host failure detail inline and clears it after a few seconds', async () => {
    const { ui } = mount(() => Promise.resolve({ ok: false, text: 'busy' }))

    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    await act(async () => { await Promise.resolve() })

    const alert = ui.getByRole('alert')
    expect(alert.textContent).toBe('busy')

    act(() => { vi.advanceTimersByTime(4_000) })
    expect(ui.queryByRole('alert')).toBeNull()
  })

  it('falls back to the generic failure copy when the host gives no detail', async () => {
    const { ui } = mount(() => Promise.resolve({ ok: false }))

    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    await act(async () => { await Promise.resolve() })

    expect(ui.getByRole('alert').textContent).toBe(zh['state.compactFailed'])
  })

  it('opens the memory dialog on the memory button and shows the empty state', () => {
    const { ui } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    expect(ui.getByText(zh['memory.title'])).toBeTruthy()
    expect(ui.getByText(zh['memory.empty'])).toBeTruthy()
  })

  it('closes the memory dialog via cancel without remembering anything', () => {
    const { ui, remember } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    fireEvent.click(ui.getByText(zh['memory.cancel']))

    expect(ui.queryByText(zh['memory.title'])).toBeNull()
    expect(remember).not.toHaveBeenCalled()
  })

  it('hands the checked message text to the remember verb and closes on success', async () => {
    const snapshot = {
      sessionId: SID,
      chat: {
        nodes: {
          values: () => [{
            kind: 'user',
            id: 'u1',
            key: 'u1',
            target: 'chat',
            anchorSeq: 1,
            data: { content: [{ type: 'text', text: '我叫吐司' }] },
          }] as never[],
          get: () => undefined,
        },
      },
    } as unknown as ConversationSnapshot
    const { ui, remember } = mount(() => Promise.resolve({ ok: true }), snapshot)

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    fireEvent.click(ui.getByText(zh['memory.user']))
    await act(async () => { fireEvent.click(ui.getByText(zh['memory.remember'])) })
    await act(async () => { await Promise.resolve() })

    expect(remember).toHaveBeenCalledTimes(1)
    expect(remember).toHaveBeenCalledWith(expect.stringContaining('我叫吐司'))
    expect(ui.queryByText(zh['memory.title'])).toBeNull()
  })

  it('keeps the dialog open and surfaces a remember failure inline', async () => {
    const snapshot = {
      sessionId: SID,
      chat: {
        nodes: {
          values: () => [{
            kind: 'assistant-step',
            id: 'a1',
            key: 'a1',
            target: 'chat',
            anchorSeq: 1,
            data: { blocks: [{ kind: 'text', text: '好的，我会记住' }] },
          }] as never[],
          get: () => undefined,
        },
      },
    } as unknown as ConversationSnapshot
    const { ui } = mount(
      () => Promise.resolve({ ok: true }),
      snapshot,
    )
    const remember = vi.fn(() => Promise.reject(new Error('boom')))
    const useSession = ((selector: (s: ConversationSnapshot) => unknown) => selector(snapshot)) as never
    const props = {
      compact: () => Promise.resolve({ ok: true }),
      remember,
      useSession,
      sessionId: SID,
      t,
    } as unknown as Parameters<typeof TurnTools>[0]
    ui.unmount()
    const rerendered = render(<TurnTools {...props} />)

    fireEvent.click(rerendered.getByLabelText(zh['action.memory']))
    fireEvent.click(rerendered.getByText(zh['memory.assistant']))
    await act(async () => { fireEvent.click(rerendered.getByText(zh['memory.remember'])) })
    await act(async () => { await Promise.resolve() })

    expect(remember).toHaveBeenCalledTimes(1)
    expect(rerendered.getByText(zh['memory.title'])).toBeTruthy()
    expect(rerendered.getByText('boom')).toBeTruthy()
  })
})
