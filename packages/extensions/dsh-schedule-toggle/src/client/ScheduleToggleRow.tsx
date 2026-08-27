/**
 * Schedule toggle row registered into the General settings item slot
 * (`settings.general.item`): a switch that enables or disables the Schedule
 * reminder plugin by rewriting the profile `cordis.patch.yml`, which
 * `watchUserPatches` hot-reloads without a service restart.
 */
import { useSyncExternalStore } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SCHEDULE_TOGGLE_ENABLED_FIELD, type ScheduleToggleConfig } from '../shared.ts'
import type { ScheduleToggleKey } from './locales.ts'
import css from './ScheduleToggleRow.module.css'

/** Injected business face: the bound settings scope the row reads and writes. */
export interface ScheduleToggleRowInjected {
  scope: SettingsScope<ScheduleToggleConfig>
}

/** Full component props. */
export type ScheduleToggleRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.scheduleToggle'>
  & ScheduleToggleRowInjected

/**
 * Render the Schedule switch row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function ScheduleToggleRow({ t, scope }: ScheduleToggleRowProps) {
  // Bind the class-method references so React's callback use loses no `this`
  // (scope.getSnapshot / scope.subscribe are methods; passing them raw would
  // read `this.store` as undefined inside the controller).
  const snapshot = useSyncExternalStore(
    listener => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const enabled = snapshot.value?.enabled ?? false
  const writable = snapshot.writable && snapshot.status === 'ready'
  const toggle = () => { void scope.set(SCHEDULE_TOGGLE_ENABLED_FIELD, !enabled) }

  return (
    <div className={css.row}>
      <div className={css.text}>
        <div className={css.title}>{t('title')}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('title')}
        className={enabled ? css.switchOn : css.switch}
        disabled={!writable}
        onClick={toggle}
      >
        <span className={css.knob} />
      </button>
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Schedule toggle row copy. */
    'settings.scheduleToggle': ScheduleToggleKey
  }
}
