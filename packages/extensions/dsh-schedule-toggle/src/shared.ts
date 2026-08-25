/**
 * Shared constants between the Host half and the browser half.
 *
 * This file must stay free of cross-plugin VALUE imports: the browser half
 * imports it inside the client bundle, and the bundle-purity gate forbids
 * value imports across plugins (type-only imports are erased and never reach
 * the gate). Keep it to plain consts and interfaces.
 */

/** Settings namespace owned by this plugin. */
export const SCHEDULE_TOGGLE_NAMESPACE = 'schedule-toggle'

/** Settings field carrying the switch state. */
export const SCHEDULE_TOGGLE_ENABLED_FIELD = 'enabled'

/** Settings field carrying the target profile name. */
export const SCHEDULE_TOGGLE_PROFILE_FIELD = 'profile'

export interface ScheduleToggleConfig {
  /** Whether the Schedule reminder feature is enabled. */
  enabled: boolean
  /** Target profile name; resolved as `$DSH_HOME/profiles/<profile>`. */
  profile: string
}
