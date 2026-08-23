/**
 * The turn-tail meta controls: a compact-messages trigger over the host
 * `/compact` command chain, and the reserved memory entry (placeholder only —
 * no behavior beyond the coming-soon notice until the memory feature lands).
 */

import { useEffect, useRef, useState } from 'react'
import { IconAgentPresetOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the turnTailMeta entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { CompressIcon } from './CompressIcon.tsx'
import { NS } from './locales.ts'
import css from './TurnTools.module.css'

/** Outcome of one compact dispatch through the host command chain. */
export interface CompactOutcome {
  /** Whether the host admitted (and therefore ran) the command. */
  ok: boolean
  /** Human-readable failure detail when `ok` is false. */
  text?: string
}

/** Injected business face: the compact verb bound to this session's agent. */
export interface TurnToolsInjected {
  compact: () => Promise<CompactOutcome>
}

/** Full props of one turn-tail meta entry. */
export type TurnToolsProps =
  PropsRuntime<'conversation.chat.turnTailMeta'>
  & InjectFace<TurnToolsInjected>
  & PropsLocale<typeof NS>

/** Short-lived row state: idle, in-flight command, inline failure, reserved-feature notice. */
type State =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'failed'; text: string }
  | { kind: 'noted'; text: string }

/**
 * Compact and memory icon actions for the settled turn-tail row.
 * @param props - injected compact verb plus the namespace translator.
 * @returns the two icon buttons (and any transient inline copy).
 */
export function TurnTools({ compact, t }: TurnToolsProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  /** Replace the row state and schedule the return to idle. */
  const settle = (next: State, ms: number): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    setState(next)
    timer.current = setTimeout(() => { setState({ kind: 'idle' }) }, ms)
  }

  /** Dispatch `/compact`; the admitted command renders its own lifecycle card. */
  const onCompact = async (): Promise<void> => {
    if (state.kind === 'running') return
    setState({ kind: 'running' })
    const outcome = await compact()
    if (outcome.ok) {
      if (timer.current !== null) clearTimeout(timer.current)
      setState({ kind: 'idle' })
      return
    }
    settle({ kind: 'failed', text: outcome.text ?? t('state.compactFailed') }, 4_000)
  }

  /** Reserved memory entry: acknowledges the seat without implementing anything yet. */
  const onMemory = (): void => {
    settle({ kind: 'noted', text: t('state.memorySoon') }, 2_500)
  }

  const busy = state.kind === 'running'
  return (
    <span className={css.tools}>
      <Tooltip label={t('action.compact')} side="bottom">
        <button
          type="button"
          className={css.action}
          aria-label={t('action.compact')}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          onClick={() => { void onCompact() }}
        >
          {busy ? <span className={css.spinner} aria-hidden /> : <CompressIcon size={16} />}
        </button>
      </Tooltip>
      <Tooltip label={t('action.memory')} side="bottom">
        <button
          type="button"
          className={css.action}
          aria-label={t('action.memory')}
          onClick={onMemory}
        >
          <IconAgentPresetOutline16 size={16} />
        </button>
      </Tooltip>
      {state.kind === 'failed' && <span className={css.failed} role="alert">{state.text}</span>}
      {state.kind === 'noted' && <span className={css.note} role="status">{state.text}</span>}
    </span>
  )
}
