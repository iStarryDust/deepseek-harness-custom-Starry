/**
 * Schedule toggle plugin, browser half: registers the Schedule switch row
 * into the General settings section item slot (`settings.general.item`) and
 * reads/writes the `schedule-toggle` settings namespace through the bound
 * settings scope. The Host half mirrors the value onto the profile patch.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SCHEDULE_TOGGLE_NAMESPACE, type ScheduleToggleConfig } from '../shared.ts'
import { ScheduleToggleRow } from './ScheduleToggleRow.tsx'
import type { ScheduleToggleRowInjected } from './ScheduleToggleRow.tsx'
import { en, zh } from './locales.ts'

export type { ScheduleToggleRowInjected, ScheduleToggleRowProps } from './ScheduleToggleRow.tsx'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.scheduleToggle'

/**
 * Required services: settings transport plus slots/locale for the row.
 * `remote` carries the forwarded settings invalidation that
 * `ctx.settingsScope.bind(spec)` subscribes to on this context.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Client plugin body: register the feature-owned Schedule switch row into the
 * General section's item slot.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-schedule-toggle: settings row dictionaries')

  const scope = ctx.settingsScope.bind<ScheduleToggleConfig>({ namespace: SCHEDULE_TOGGLE_NAMESPACE })
  const injected = (): ScheduleToggleRowInjected => ({ scope })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'schedule-toggle',
    order: 20,
    locale: NS,
    inject: injected,
  }, ScheduleToggleRow))
}
