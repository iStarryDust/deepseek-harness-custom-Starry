/**
 * Profile patch file management for the Schedule toggle.
 *
 * The toggle owns the profile `cordis.patch.yml` under the harness home
 * (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`, derived through
 * `dshHomePath` so no machine-specific absolute path is ever hard-coded).
 *
 * This USER layer holds ONLY the schedule-controlled entries
 * (`time-context` and `schedule`). The toggle plugin's own entry is mounted by
 * its bundle patch (via the profile manifest `dsh.profile.bundles`), so it is
 * NEVER written into this file — writing it here would collide with the bundle
 * layer's insert of the same entry id and fail launch with a duplicate id.
 *
 * The switch writes an insert list of the controlled entries when enabled, or
 * a bare empty array `[]` when disabled. `watchUserPatches` hot-reloads the
 * change, so no service restart is needed.
 *
 * A file that does not look toggle-managed (someone added unrelated entries by
 * hand) is never overwritten: the sync reports the current state instead.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { parse } from 'yaml'

/** Entry id of the Schedule reminder plugin. */
export const SCHEDULE_PLUGIN_ID = 'schedule'
/** Entry id of the time-context plugin. */
export const TIME_CONTEXT_PLUGIN_ID = 'time-context'

/** Entries the switch controls (id -> package name). */
const CONTROLLED_ENTRIES: readonly { id: string; name: string }[] = [
  { id: TIME_CONTEXT_PLUGIN_ID, name: '@deepseek-ai/dsh-time-context' },
  { id: SCHEDULE_PLUGIN_ID, name: '@deepseek-ai/dsh-schedule' },
]

/** File header written on every managed rewrite. */
const FILE_HEADER = `# Managed by the Schedule switch in Settings -> General.
# DO NOT edit by hand: the dsh-schedule-toggle plugin rewrites this file when
# the switch changes. 本文件由 设置-通用设置 里的"定时提醒"开关管理，请勿手改。
`

/** The controlled entries YAML (the whole file body when enabled). */
const SCHEDULE_ENTRIES_YAML = `- insert:
${CONTROLLED_ENTRIES
  .map(entry => `    - id: ${entry.id}\n      name: '${entry.name}'`)
  .join('\n')}
`

/** Current state of the profile patch file. */
export interface ProfilePatchState {
  /** Whether the file exists on disk. */
  exists: boolean
  /** Whether the file is toggle-managed (bare empty array or only schedule entries). */
  managed: boolean
  /** Whether the schedule entries are present (feature enabled). */
  enabled: boolean
}

/**
 * Profile patch path under the harness home.
 * @param profile - profile directory name (default `web`).
 * @returns the absolute path, portable across machines via `$DSH_HOME`.
 */
export function profilePatchPath(profile = 'web'): string {
  return dshHomePath('profiles', profile, 'cordis.patch.yml')
}

/** Whether a parsed document is a bare empty array. */
function isEmptyList(doc: unknown): boolean {
  return Array.isArray(doc) && doc.length === 0
}

/** The set of controlled entry ids present in a parsed document's inserts. */
function controlledIdsOf(doc: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(doc)) return ids
  for (const entry of doc) {
    if (entry === null || typeof entry !== 'object') continue
    const insert = (entry as { insert?: unknown }).insert
    if (!Array.isArray(insert)) continue
    for (const item of insert) {
      if (item !== null && typeof item === 'object') {
        const id = (item as { id?: unknown }).id
        if (typeof id === 'string') ids.add(id)
      }
    }
  }
  return ids
}

/** Whether a parsed document is toggle-managed: bare empty, or controlled-only. */
function isToggleManaged(doc: unknown): boolean {
  if (isEmptyList(doc)) return true
  const ids = controlledIdsOf(doc)
  if (ids.size === 0) return false
  const controlled = new Set(CONTROLLED_ENTRIES.map(entry => entry.id))
  for (const id of ids) if (!controlled.has(id)) return false
  return true
}

/** Whether a parsed document carries every controlled schedule entry. */
function hasControlledEntries(doc: unknown): boolean {
  const ids = controlledIdsOf(doc)
  return CONTROLLED_ENTRIES.every(entry => ids.has(entry.id))
}

/**
 * Read and evaluate the current profile patch state without modifying it.
 * @param profile - profile directory name (default `web`).
 * @returns the file's existence, managed-ness, and enabled-ness.
 */
export async function readProfilePatchState(profile = 'web'): Promise<ProfilePatchState> {
  const file = profilePatchPath(profile)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, managed: true, enabled: false }
    }
    throw error
  }
  let doc: unknown
  try {
    doc = parse(raw)
  } catch {
    // Unparsable: not managed; leave the file alone.
    return { exists: true, managed: false, enabled: false }
  }
  const managed = isToggleManaged(doc)
  return { exists: true, managed, enabled: managed && hasControlledEntries(doc) }
}

/**
 * Synchronize the profile patch file to the requested switch state.
 *
 * A missing file is created; an empty `[]` file is adopted and rewritten; an
 * existing toggle-managed file is rewritten; an existing file that is NOT
 * toggle-managed (someone added unrelated entries by hand) is left untouched
 * and the current state is reported instead.
 * @param enabled - whether the schedule entries should be present.
 * @param profile - profile directory name (default `web`).
 * @returns the resulting state after the sync attempt.
 */
export async function syncProfilePatch(enabled: boolean, profile = 'web'): Promise<ProfilePatchState> {
  const file = profilePatchPath(profile)
  const before = await readProfilePatchState(profile)
  if (before.exists && !before.managed) return before
  const body = enabled ? SCHEDULE_ENTRIES_YAML : '[]\n'
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${FILE_HEADER}${body}`, 'utf8')
  return { exists: true, managed: true, enabled }
}
