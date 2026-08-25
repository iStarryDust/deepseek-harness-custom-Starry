/**
 * Schedule toggle Host half: registers the `schedule-toggle` settings
 * namespace and mirrors the switch value onto the profile `cordis.patch.yml`
 * (which `watchUserPatches` hot-reloads, so toggling never needs a restart).
 */
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { syncProfilePatch } from './profile-patch.ts'
import {
  SCHEDULE_TOGGLE_ENABLED_FIELD, SCHEDULE_TOGGLE_NAMESPACE, SCHEDULE_TOGGLE_PROFILE_FIELD,
  type ScheduleToggleConfig,
} from './shared.ts'

export { profilePatchPath, readProfilePatchState } from './profile-patch.ts'
export type { ProfilePatchState } from './profile-patch.ts'
export {
  SCHEDULE_TOGGLE_ENABLED_FIELD, SCHEDULE_TOGGLE_NAMESPACE, SCHEDULE_TOGGLE_PROFILE_FIELD,
  type ScheduleToggleConfig,
} from './shared.ts'

const NS = settingsNamespace(SCHEDULE_TOGGLE_NAMESPACE)

export const ScheduleToggleConfigSchema: z<ScheduleToggleConfig> = z.object({
  [SCHEDULE_TOGGLE_ENABLED_FIELD]: z.boolean().default(false),
  [SCHEDULE_TOGGLE_PROFILE_FIELD]: z.string().default('web'),
})

const DEFAULT_CONFIG: ScheduleToggleConfig = { enabled: false, profile: 'web' }

/** @returns a stable error text for log lines. */
function renderThrown(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Mount the settings section and keep the profile patch in sync with the
 * switch. The registration runs `onChange` once immediately, so loading this
 * plugin also reconciles the file with the stored preference.
 * @param ctx - Host context.
 * @param config - composition entry config (partial; defaults applied).
 */
export function apply(ctx: Context, config: Partial<ScheduleToggleConfig> = {}): void {
  const entry: ScheduleToggleConfig = { ...DEFAULT_CONFIG, ...config }
  let source = (): ScheduleToggleConfig => entry
  installSettingsSection(ctx, NS, ScheduleToggleConfigSchema, entry, {
    setSource: (current) => { source = current },
    onChange: () => {
      const { enabled, profile } = source()
      void syncProfilePatch(enabled, profile).catch((error) => {
        ctx.logger.warn(`schedule-toggle: profile patch sync failed: ${renderThrown(error)}`)
      })
    },
  })
}
