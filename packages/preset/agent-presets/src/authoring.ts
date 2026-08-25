/**
 * Copying, reading, and deleting locally authored presets.
 *
 * Authoring is confined to a `user` root: the shipped `.system` set is part of
 * the deployment, and letting a browser rewrite it would turn "reset to a known
 * preset" into something the same caller could have broken first.
 *
 * The only authoring write is a whole-directory copy of an existing preset.
 * No caller supplies composition text: the inputs are ids the host resolves
 * against its own roots plus an optional display name, so authoring grants no
 * capability the copied preset did not already carry.
 * @module @deepseek-ai/dsh-agent-presets/authoring
 */

import { chmod, cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { expandHomePath } from '@deepseek-ai/dsh-home-paths'
import { COMPOSITION_FILE } from './discovery.ts'
import { METADATA_FILE, renderPresetMetadata } from './metadata.ts'
import { MODES_DIR, PRESET_ID, combinedPartsOf, type AgentPreset, type PresetRoot } from './preset.ts'

/** The `persona` row id inside a composition, per the dsh-persona contract. */
const PERSONA_ROW_ID = 'persona'

/** Composition rows are a top-level YAML list; a row begins at a `- id:` line. */
const ROW_START = /^- id: /m

/**
 * Match one composition row by its id: from its `- id:` line through the line
 * before the next row start (or the end of the document).
 * @param id - the row id to locate.
 * @returns a matcher over the whole composition text.
 */
function rowBlock(id: string): RegExp {
  return new RegExp(`^- id: ${escapeRegExp(id)}\\n[\\s\\S]*?(?=${ROW_START.source}|\\z)`, 'm')
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Render a YAML literal block scalar (`|-`) from plain text: every line is
 * indented six spaces (the persona row's `config.text` column depth), trailing
 * whitespace is trimmed, and blank lines stay blank.
 * @param text - the plain multi-line persona text.
 * @returns the block scalar body (lines only, the `|-` marker is the caller's).
 */
function blockScalarLines(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    const trimmed = line.replace(/[ \t]+$/, '')
    return trimmed === '' ? '' : `      ${trimmed}`
  }).join('\n')
}

/**
 * What a locally authored agent's persona contributes: two fixed opening
 * lines — the language directive (the form's language value is substituted in
 * place of the literal `{{语言}}`, since the runtime resolves only its own
 * placeholders) and the working-directory line — followed by the user's own
 * persona text verbatim. The `{{cwd}}` placeholder is kept for the runtime to
 * resolve at mount.
 * @param input - the agent's editable fields.
 * @returns the persona text to store in the composition's `persona` row.
 */
export function renderPersonaText(input: CreateAgentInput): string {
  const language = input.language.trim()
  const persona = input.persona.trim()
  const parts: string[] = [
    language === '' ? '' : `全程使用${language}思考与交流；`,
    '工作目录 {{cwd}}；',
    persona,
  ]
  return parts.filter(part => part !== '').join('\n')
}

/**
 * Rewrite the `persona` row of a composition so its `config.text` carries the
 * agent's language and persona. The row is located by id and replaced as text
 * (never re-parsed as YAML, because a composition may carry `!!js` tags); when
 * the composition has no persona row, one is prepended so the authored agent
 * still gets its identity.
 * @param composition - the composition text to rewrite.
 * @param input - the agent's editable fields.
 * @returns the rewritten composition text.
 */
export function rewritePersona(composition: string, input: CreateAgentInput): string {
  const body = blockScalarLines(renderPersonaText(input))
  const row = [
    `- id: ${PERSONA_ROW_ID}`,
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: |-',
    body,
    '',
  ].join('\n')
  const existing = rowBlock(PERSONA_ROW_ID)
  if (existing.test(composition)) {
    return composition.replace(existing, row)
  }
  return `${row}${composition}`
}

/** A preset id that cannot be used as a directory name under a root. */
export class InvalidPresetIdError extends Error {
  constructor(
    /** The rejected id. */
    readonly presetId: string,
  ) {
    super(
      `agent-presets: preset id ${JSON.stringify(presetId)} must match ${String(PRESET_ID)} — `
      + 'the id is a directory name, so anything else could escape the preset root',
    )
  }
}

/** A copy target that is already occupied — a copy never overwrites. */
export class PresetExistsError extends Error {
  constructor(
    /** The id that is already taken. */
    readonly presetId: string,
  ) {
    super(
      `agent-presets: preset "${presetId}" already exists — `
      + 'a copy never overwrites; delete the existing preset first or choose another id',
    )
  }
}

/** Authoring was attempted where the deployment allows none. */
export class PresetNotWritableError extends Error {
  constructor(
    /** What the caller tried to change, for the diagnostic. */
    readonly presetId: string,
    reason: string,
  ) {
    super(`agent-presets: preset "${presetId}" cannot be written: ${reason}`)
  }
}

/**
 * The root locally authored presets are written to.
 * @param roots - the configured roots in precedence order.
 * @returns the absolute path of the first `user` root.
 * @throws when the deployment configured no writable root.
 */
export function writableRoot(roots: readonly PresetRoot[]): string {
  const root = roots.find(candidate => candidate.trust === 'user')
  if (root === undefined) {
    throw new PresetNotWritableError('', 'this deployment configures no user-writable preset root')
  }
  return resolve(expandHomePath(root.path))
}

/**
 * The nested directory a combined preset id maps to, when its agent exists.
 *
 * A combined preset (`<agentId>-<modeId>`) lives inside its agent's own folder
 * at `<agentId>/modes/<modeId>/`, so one agent stays one directory with every
 * mode's composition nested below. The owning agent must already exist under
 * the writable root — combined presets are created for an existing agent's
 * chat, never as a standalone. A flat id, or a combined id whose agent is
 * absent, maps to nothing and the caller authors flat instead.
 * @param roots - the configured roots; the first `user` one is the target.
 * @param id - the preset id being authored.
 * @returns the nested directory, or undefined for a flat target.
 */
async function combinedDirectory(roots: readonly PresetRoot[], id: string): Promise<string | undefined> {
  const parts = combinedPartsOf(id)
  if (parts === undefined) return undefined
  const root = writableRoot(roots)
  const agentDir = join(root, parts.agentId)
  try {
    if (!(await stat(agentDir)).isDirectory()) return undefined
  } catch {
    return undefined
  }
  return join(agentDir, MODES_DIR, parts.modeId)
}

/**
 * Read one preset's composition text.
 * @param preset - the resolved preset.
 * @returns the file's contents.
 */
export async function readComposition(preset: AgentPreset): Promise<string> {
  return await readFile(preset.path, 'utf8')
}

/** Whether anything occupies the path (cp's own errorOnExist backstops races). */
async function occupied(path: string): Promise<boolean> {
  let present = true
  try {
    await stat(path)
  } catch {
    // Every stat failure means the same thing here: nothing usable occupies
    // the path, so the copy may claim it.
    present = false
  }
  return present
}

/**
 * Re-tighten a copied tree to owner-only. A shipped preset is world-readable
 * in its install and `cp` preserves that; the copy carries the same weight as
 * the settings document beside it, so group/other access is stripped. A
 * file's owner-execute bit survives — a preset may ship runnable helpers.
 */
async function tightenModes(dir: string): Promise<void> {
  await chmod(dir, 0o700)
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name)
    if (entry.isDirectory()) {
      await tightenModes(target)
    } else {
      /* v8 ignore next -- Windows exposes no POSIX owner-execute bit; the POSIX lane covers both file modes. */
      await chmod(target, ((await stat(target)).mode & 0o100) === 0 ? 0o600 : 0o700)
    }
  }
}

/**
 * Create a preset by copying an existing one's whole directory.
 *
 * The copy carries everything the source directory holds — composition,
 * metadata, skill directories, assets — because a preset is its directory,
 * not one file. Symlinks are dereferenced so the copy is self-contained
 * rather than a set of links back into the install it was copied from.
 *
 * The copied metadata is then rewritten: the source's description is kept
 * (the file is the author's to edit afterwards), but its name and roster
 * `order` are not — a copy presenting itself identically to its source, or
 * sorted into the shipped set's declared order, would make the roster stop
 * distinguishing them. With no name given and no description to keep, the
 * file is removed so the copy publishes nothing rather than a blank.
 * @param roots - the configured roots; the first `user` one receives the copy.
 * @param source - the resolved preset the copy starts from.
 * @param id - the new preset's id, which becomes its directory name.
 * @param name - display name for the copy; omitted falls back to the id.
 * @returns the absolute path of the new preset directory.
 * @throws when the id is unusable or already occupied on disk, or the
 * deployment configures no writable root.
 */
export async function copyComposition(
  roots: readonly PresetRoot[],
  source: AgentPreset,
  id: string,
  name?: string,
): Promise<string> {
  if (!PRESET_ID.test(id)) throw new InvalidPresetIdError(id)
  const dir = join(writableRoot(roots), id)
  // The roster check upstream only sees discovered presets; a directory with
  // no composition file still occupies the name and deserves a readable
  // refusal rather than a filesystem error code.
  if (await occupied(dir)) throw new PresetExistsError(id)
  try {
    await cp(dirname(source.path), dir, {
      recursive: true, dereference: true, force: false, errorOnExist: true,
    })
    await tightenModes(dir)
    const rendered = renderPresetMetadata({
      ...name === undefined ? {} : { name },
      ...source.description === undefined ? {} : { description: source.description },
    })
    const metadataPath = join(dir, METADATA_FILE)
    if (rendered === undefined) {
      await rm(metadataPath, { force: true })
    } else {
      await writeFileAtomic(metadataPath, rendered, { mode: 0o600, dirMode: 0o700 })
    }
  } catch (error) {
    // A half-copied directory would be invisible to discovery at best and a
    // mountable-but-incomplete preset at worst; a failed copy leaves nothing.
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  return dir
}

/**
 * Delete a locally authored preset.
 *
 * A shipped preset is refused: it belongs to the deployment. A preset a live
 * session mounted is NOT refused — the composition was read at creation and is
 * never re-read, so that session keeps running exactly as it was.
 * @param roots - the configured roots.
 * @param preset - the resolved preset to remove.
 * @throws when the preset ships with the deployment or lies outside the writable root.
 */
export async function deleteComposition(
  roots: readonly PresetRoot[],
  preset: AgentPreset,
): Promise<void> {
  if (preset.trust !== 'user') {
    throw new PresetNotWritableError(preset.id, 'it ships with the deployment')
  }
  // The directory to remove is the one the composition lives in — the agent's
  // own folder for a bare preset, `<agentId>/modes/<modeId>/` for a combined
  // one — and discovery is the only authority on where that is.
  const root = writableRoot(roots)
  const dir = dirname(preset.path)
  // Belt and braces over the id pattern: the resolved directory must still be
  // the one the writable root owns, whatever discovery reported.
  if (!isAbsolute(dir) || (dir !== root && !dir.startsWith(`${root}${sep}`))) {
    throw new PresetNotWritableError(preset.id, 'it does not live under the writable preset root')
  }
  await rm(dir, { recursive: true, force: true })
}

/**
 * The editable identity of a locally authored agent: what the creation and
 * profile forms collect. `name` is the display name, `language` the language
 * the agent should reply in, `persona` the user's own instructions, and
 * `description` the user's own one-line description. All are folded into the
 * preset's display metadata; language and persona also feed the persona row.
 */
export interface CreateAgentInput {
  /** Display name shown in the roster and session header. */
  readonly name: string
  /** The language the agent should use when talking to the user. */
  readonly language: string
  /** The user's own persona instructions. */
  readonly persona: string
  /** The user's own one-line description, when provided. */
  readonly description?: string
}

/** Require a non-empty trimmed value for the form fields that carry identity. */
function requireText(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new Error(`agent-presets: ${field} must not be empty`)
  return trimmed
}

/** The display description a created agent publishes about itself. */
function renderDescription(input: CreateAgentInput): string {
  return (input.description ?? '').trim()
}

/**
 * Create a locally authored agent preset from a form: copy a base preset's
 * whole directory, then rewrite the display metadata (name/description) and
 * the composition's `persona` row with the user's language and persona.
 *
 * Only the identity fields are rewritten — every other row of the base
 * composition is carried over untouched, so the new agent is exactly as
 * capable as the mode it was created from. The copy is NOT mounted to
 * validate: a base that mounts today yields an agent that mounts today.
 * @param roots - the configured roots; the first `user` one receives the agent.
 * @param source - the resolved base preset the agent starts from.
 * @param id - the new preset id, which becomes its directory name.
 * @param input - the creation form fields.
 * @returns the absolute path of the new preset directory.
 * @throws when the id is unusable or already occupied, the deployment
 * configures no writable root, or the base composition cannot be rewritten.
 */
export async function createComposition(
  roots: readonly PresetRoot[],
  source: AgentPreset,
  id: string,
  input: CreateAgentInput,
): Promise<string> {
  if (!PRESET_ID.test(id)) throw new InvalidPresetIdError(id)
  const name = requireText(input.name, 'name')
  const nested = await combinedDirectory(roots, id)
  const dir = nested ?? join(writableRoot(roots), id)
  if (nested !== undefined) {
    // cp creates the target itself but not its parents; the agent folder and
    // its `modes/` container must exist before the mode directory is copied in.
    await mkdir(dirname(nested), { recursive: true })
  }
  if (await occupied(dir)) throw new PresetExistsError(id)
  try {
    await cp(dirname(source.path), dir, {
      recursive: true, dereference: true, force: false, errorOnExist: true,
    })
    await tightenModes(dir)
    await writePresetIdentity(dir, { ...input, name })
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  return dir
}

/**
 * Rewrite an existing locally authored agent's identity: display metadata and
 * the composition's `persona` row. The composition keeps every other row
 * untouched, so a profile edit cannot change the agent's capabilities — only
 * who it presents as.
 * @param preset - the resolved user preset to rewrite.
 * @param input - the profile form fields.
 * @throws when the preset ships with the deployment or lies outside the
 * writable root, or the composition cannot be rewritten.
 */
export async function updateComposition(
  preset: AgentPreset,
  input: CreateAgentInput,
): Promise<void> {
  if (preset.trust !== 'user') {
    throw new PresetNotWritableError(preset.id, 'it ships with the deployment')
  }
  const name = requireText(input.name, 'name')
  await writePresetIdentity(dirname(preset.path), { ...input, name })
}

/**
 * Write the identity files (preset.yml + the persona row of agent.cordis.yml)
 * of a preset directory.
 * @param dir - the preset directory.
 * @param input - the agent's editable fields.
 */
async function writePresetIdentity(dir: string, input: CreateAgentInput): Promise<void> {
  const language = input.language.trim()
  const persona = input.persona.trim()
  const rendered = renderPresetMetadata({
    name: input.name,
    description: renderDescription(input),
    ...language === '' ? {} : { language },
    ...persona === '' ? {} : { persona },
  })
  await writeFileAtomic(join(dir, METADATA_FILE), rendered ?? `${input.name}\n`, {
    mode: 0o600, dirMode: 0o700,
  })
  const compositionPath = join(dir, COMPOSITION_FILE)
  const composition = await readFile(compositionPath, 'utf8')
  await writeFileAtomic(compositionPath, rewritePersona(composition, input), {
    mode: 0o600, dirMode: 0o700,
  })
}
