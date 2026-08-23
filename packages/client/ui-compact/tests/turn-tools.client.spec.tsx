// @vitest-environment jsdom
/**
 * TurnTools rendering and gestures: both icon buttons expose their labels, the
 * compact trigger dispatches the injected verb once (and stays in flight while
 * it runs), success resets the row silently, an admitted failure shows the
 * host's detail inline for a few seconds, and the reserved memory entry only
 * acknowledges the seat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
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

/** Render the controls over a recording compact verb. */
function mount(compact: () => Promise<CompactOutcome> = () => Promise.resolve({ ok: true })) {
  const fn = vi.fn(compact)
  const props = { compact: fn, t } as unknown as Parameters<typeof TurnTools>[0]
  const ui = render(<TurnTools {...props} />)
  return { ui, compact: fn }
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

  it('cancels a pending memory notice when a successful compact lands first', async () => {
    const { ui } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    expect(ui.getByRole('status').textContent).toBe(zh['state.memorySoon'])

    fireEvent.click(ui.getByLabelText(zh['action.compact']))
    await act(async () => { await Promise.resolve() })

    // The stale note timer must not resurrect the notice after the success reset.
    act(() => { vi.advanceTimersByTime(3_000) })
    expect(ui.queryByRole('status')).toBeNull()
    expect(ui.queryByRole('alert')).toBeNull()
  })

  it('shows the reserved memory notice briefly and returns to idle', () => {
    const { ui } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    expect(ui.getByRole('status').textContent).toBe(zh['state.memorySoon'])

    act(() => { vi.advanceTimersByTime(2_500) })
    expect(ui.queryByRole('status')).toBeNull()
  })

  it('clears a pending notice timer when the row unmounts', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const { ui } = mount()

    fireEvent.click(ui.getByLabelText(zh['action.memory']))
    ui.unmount()

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('re-acknowledges the reserved memory entry and resets its timer', () => {
    const { ui } = mount()
    const memory = ui.getByLabelText(zh['action.memory'])

    fireEvent.click(memory)
    fireEvent.click(memory)
    expect(ui.getByRole('status').textContent).toBe(zh['state.memorySoon'])

    act(() => { vi.advanceTimersByTime(2_500) })
    expect(ui.queryByRole('status')).toBeNull()
  })
})
