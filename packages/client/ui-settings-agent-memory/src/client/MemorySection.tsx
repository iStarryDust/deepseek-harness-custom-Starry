/**
 * Agent-memory settings section: the four switches over the `agent-memory`
 * settings namespace plus the global memory editor over the agentMemory wire
 * domain. The ask switch is available only while auto memory is on — the
 * confirmation flow can only gate a write the agent is already allowed to
 * propose — so it renders disabled with its reason until auto memory is on.
 * Every mutation writes through the wire; the page re-renders from the bound
 * scope's own invalidation or the post-save read.
 */

import type { ReactNode } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { MemorySettingsController, MemorySwitches } from './memory-store.ts'
import type { en } from './locales.ts'
import styles from './MemorySection.module.css'

/** Injected dependencies of {@link MemorySection} (slot `inject`). */
export interface MemorySectionInjected {
  /** The page store (loaded when the section mounts). */
  controller: MemorySettingsController
  hooks: {
    /** Page snapshot bound by the UI renderer as useSnapshot. */
    snapshot: MemorySettingsController['store']
  }
  /** Wire face the editor writes through. */
  api: Pick<IApiClient, 'agentMemory'>
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/** Props delivered by the slot outlet. */
export type MemorySectionProps = Partial<InjectFace<MemorySectionInjected>>

type MemorySectionFace = InjectFace<MemorySectionInjected>

/** One labelled switch cell: label above, toggle, then a one-line hint. */
function SwitchCell({
  label, hint, checked, disabled, disabledHint, onToggle,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  disabledHint?: string
  onToggle: (next: boolean) => void
}): ReactNode {
  // Inline styles on purpose: the CSS-module class pipeline did not surface in
  // this browser, leaving the <button> at its native look. Inline styles are
  // injected with the element, so the switch always renders as a pill+dot.
  const trackStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    width: 38,
    height: 22,
    padding: 3,
    boxSizing: 'border-box',
    border: 'none',
    borderRadius: 999,
    cursor: disabled === true ? 'not-allowed' : 'pointer',
    opacity: disabled === true ? 0.45 : 1,
    background: checked ? '#3a6dea' : '#c7cfd8',
    transition: 'background 140ms ease',
    flex: 'none',
  }
  const thumbStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: checked ? '#ffffff' : '#f0f2f5',
    transition: 'transform 140ms ease',
    transform: checked ? 'translateX(16px)' : 'translateX(0)',
  }
  return (
    <div className={styles.cell}>
      <label className={styles.cellLabel}>{label}</label>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        style={trackStyle}
        disabled={disabled === true}
        onClick={() => { onToggle(!checked) }}
      >
        <span style={thumbStyle} />
      </button>
      <p className={styles.hint}>{disabled === true && disabledHint !== undefined ? disabledHint : hint}</p>
    </div>
  )
}

/**
 * The section, or null while the shell has not injected yet.
 * @param props - slot-delivered injected dependencies.
 * @returns the section UI.
 */
export function MemorySection(props: MemorySectionProps): ReactNode {
  const { controller, useSnapshot, t } = props
  if (controller === undefined || useSnapshot === undefined || t === undefined) return null
  return <Loaded injected={{ controller, useSnapshot, t } as MemorySectionFace} />
}

function Loaded({ injected }: { injected: MemorySectionFace }): ReactNode {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot(snapshot => snapshot)
  const switches = state.switches

  const toggle = (field: keyof MemorySwitches, next: boolean): void => {
    void controller.toggle(field, next)
  }

  const saving = state.editor.saveState === 'saving'
  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <SwitchCell
          label={t('switch.global')}
          hint={t('switch.global.hint')}
          checked={switches.globalEnabled}
          onToggle={next => toggle('globalEnabled', next)}
        />
        <SwitchCell
          label={t('switch.agent')}
          hint={t('switch.agent.hint')}
          checked={switches.agentEnabled}
          onToggle={next => toggle('agentEnabled', next)}
        />
      </div>
      <div className={styles.row}>
        <SwitchCell
          label={t('switch.auto')}
          hint={t('switch.auto.hint')}
          checked={switches.autoMemory}
          onToggle={next => toggle('autoMemory', next)}
        />
        <SwitchCell
          label={t('switch.ask')}
          hint={t('switch.ask.hint')}
          disabledHint={t('switch.ask.disabledHint')}
          checked={switches.askMemory}
          disabled={!switches.autoMemory}
          onToggle={next => toggle('askMemory', next)}
        />
      </div>

      <div className={styles.editor}>
        <h3 className={styles.editorTitle}>{t('editor.global.title')}</h3>
        <p className={styles.hint}>{t('editor.global.hint')}</p>
        {state.editor.loadError !== null && (
          <p className={styles.error} role="alert">{state.editor.loadError}</p>
        )}
        <textarea
          className={styles.textarea}
          value={state.editor.globalText}
          disabled={saving}
          onChange={(event) => { controller.setDraft(event.target.value) }}
          spellCheck={false}
        />
        <div className={styles.footer}>
          <Button
            type="button"
            disabled={saving}
            onClick={() => { void controller.saveGlobal() }}
          >
            {saving ? t('action.loading') : t('action.save')}
          </Button>
          {state.editor.saveState === 'saved' && <span className={styles.saved}>{t('state.saved')}</span>}
          {state.editor.saveState === 'failed' && <span className={styles.error}>{t('state.saveFailed')}</span>}
        </div>
      </div>
    </div>
  )
}
