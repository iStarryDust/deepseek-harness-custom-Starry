/**
 * The turn-tail meta controls: a compact-messages trigger over the host
 * `/compact` command chain, and the memory-entry button that opens the
 * selectable-messages dialog and sends what the human checks to the host
 * remember path (AI condenses it into the agent's own memory).
 */

import { useEffect, useRef, useState } from 'react'
import { IconAgentPresetOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the turnTailMeta entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { CompressIcon } from './CompressIcon.tsx'
import { MemoryDialog } from './MemoryDialog.tsx'
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
  /** Condense selected conversation text into the agent's memory. */
  remember: (text: string) => Promise<void>
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
 * @param props - injected compact/remember verbs plus the runtime session kit.
 * @returns the two icon buttons (and any transient inline copy).
 */
export function TurnTools({ compact, remember, useSession, sessionId, t }: TurnToolsProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [memoryOpen, setMemoryOpen] = useState(false)
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

  /** Remember: open the dialog; nothing is written until the human checks + submits. */
  const onMemory = (): void => {
    setMemoryOpen(true)
  }

  const onRemember = async (text: string): Promise<void> => {
    await remember(text)
  }

  const busy = state.kind === 'running'
  return (
    <>
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
      {memoryOpen && (
        <MemoryDialog
          sessionId={sessionId}
          useSession={useSession}
          onRemember={onRemember}
          onClose={() => { setMemoryOpen(false) }}
          t={t}
        />
      )}
    </>
  )
}
