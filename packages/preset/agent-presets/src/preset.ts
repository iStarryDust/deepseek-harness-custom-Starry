/** Agent-preset vocabulary shared by discovery, mounting, and consumers. */

/**
 * Where a preset's composition came from. A `system` preset ships with the
 * deployment; a `user` preset was authored locally, by a person or by an
 * agent, and therefore carries the same trust as shell access.
 */
export type PresetTrust = 'system' | 'user'

/**
 * Ids a preset directory may use.
 *
 * The id becomes a path segment, so this is a containment boundary rather than
 * a style rule: `..`, a separator, or an absolute-looking name would place the
 * composition outside the root the deployment authorised. Discovery shares it:
 * a directory whose name no copy could ever claim is not a preset slot.
 */
export const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/

/**
 * Subdirectory name under an agent's directory holding its per-mode combined
 * presets. A combined preset lives at `<agentId>/<MODES_DIR>/<modeId>/`, so one
 * agent is one folder: the identity files at the top, each mode's composition
 * nested below. The name is a reserved slot: a top-level directory called
 * `modes` is skipped by discovery rather than read as an agent.
 */
export const MODES_DIR = 'modes'

/**
 * The shipped mode ids a combined preset may be built from. Combined ids are
 * `<agentId>-<modeId>`, matching the Web browser's combined-preset filter
 * (`-(standard|code|minimal)$`); a same-named directory is shadowed by the
 * nested layout, so the set is fixed here rather than derived from the roster.
 */
export const COMBINED_MODES = ['standard', 'code', 'minimal'] as const

/** One combined preset's identity, split from its flattened id. */
export interface CombinedParts {
  /** The owning agent's preset id (its directory name). */
  readonly agentId: string
  /** The mode id the combined preset composes (`standard` / `code` / `minimal`). */
  readonly modeId: string
}

/**
 * Split a flattened combined-preset id (`<agentId>-<modeId>`) into its parts,
 * when it is one.
 * @param id - a preset id.
 * @returns the agent and mode parts, or undefined for a bare preset id.
 */
export function combinedPartsOf(id: string): CombinedParts | undefined {
  const match = /^(.+)-((?:standard|code|minimal))$/.exec(id)
  if (match === null) return undefined
  const agentId = match[1]
  const modeId = match[2]
  if (agentId === undefined || modeId === undefined) return undefined
  return { agentId, modeId }
}

/** One preset directory that carries a mountable agent composition. */
export interface AgentPreset {
  /** Stable identifier; the preset directory's name. */
  readonly id: string
  /** Trust recorded from the root this preset was discovered under. */
  readonly trust: PresetTrust
  /** Absolute path of the preset's agent composition file. */
  readonly path: string
  /** Display name from the preset's own metadata; absent falls back to {@link id}. */
  readonly name?: string
  /** One sentence on what this preset is for, when it published one. */
  readonly description?: string
  /** Declared position within its group; absent sorts after those that declare one. */
  readonly order?: number
  /** Language a locally authored agent replies in, per its authoring form. */
  readonly language?: string
  /** Persona instructions a locally authored agent's author wrote, per its form. */
  readonly persona?: string
  /**
   * Why this preset cannot compose a session, absent when it can. A broken
   * preset stays on the roster — hiding it would leave its directory blocking
   * the id with nothing to see or delete — but every mounting path refuses it
   * up front with this reason instead of failing deep inside the loader.
   */
  readonly broken?: string
}

/** One directory scanned for preset subdirectories. */
export interface PresetRoot {
  /** Directory holding one subdirectory per preset; a leading `~` expands. */
  path: string
  /** Trust recorded on every preset discovered under this root. */
  trust: PresetTrust
}

/** Plugin config: which preset is the default, and where presets live. */
export interface Config {
  /** Preset id mounted when a caller names none. Missing at mount time fails loud. */
  default: string
  /** Scanned roots in precedence order; an earlier root wins a duplicate id. */
  roots: PresetRoot[]
  /**
   * Append the harness home's `USER_PRESET_DIR` as a `user` root, after every
   * configured root. False mounts a roster over `roots` alone.
   */
  includeUserRoot: boolean
}

/**
 * No configured root supplies the requested preset.
 *
 * Separate from a mount failure because the two mean different things to a
 * caller: an unknown id is a bad request, while an unusable composition is a
 * broken preset the deployment must fix.
 */
export class UnknownPresetError extends Error {
  constructor(
    /** The id that was requested. */
    readonly presetId: string,
    /** Ids the roster does supply, for the caller to offer instead. */
    readonly available: readonly string[],
  ) {
    super(`agent-presets: preset "${presetId}" not found (available: ${available.join(', ') || 'none'})`)
  }
}

/** A preset exists but its composition cannot be installed. */
export class PresetMountError extends Error {
  constructor(
    /** The preset whose composition failed. */
    readonly presetId: string,
    /** Why it failed, without this package's own message prefix. */
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(`agent-presets: preset "${presetId}" failed to mount: ${reason}`, options)
  }
}
