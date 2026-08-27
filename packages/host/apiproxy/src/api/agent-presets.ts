/**
 * agent-presets domain contract: the roster a browser offers when starting a
 * session, plus the authoring calls behind it.
 *
 * `list` is ordinary: it carries ids and trust, and every preset picker needs
 * it. The authoring calls are privileged and loopback-pinned — a composition
 * names the plugins a session runs, so reading one is reconnaissance, and
 * although authoring is copy-only (no caller supplies composition text or a
 * path), copying and deleting still rearrange what the deployment offers.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One preset the deployment can compose a session's agent from. */
export interface AgentPresetEntry {
  /** Stable identifier, also the display name until presets carry metadata. */
  readonly id: string
  /**
   * Whether the preset ships with the deployment or was authored locally.
   * A `user` preset is exactly as privileged as the plugins it names, so a
   * surface offering one should say so rather than present it as vetted.
   */
  readonly trust: 'system' | 'user'
  /** Whether a session that names no preset gets this one. */
  readonly isDefault: boolean
  /**
   * Display name the preset published, absent when it published none. A
   * surface falls back to {@link id}; it is never a second identity, and it
   * never decides trust — a locally authored preset cannot name itself into
   * the shipped set.
   */
  readonly name?: string
  /** One sentence on what the preset is for, when it published one. */
  readonly description?: string
  /**
   * Why this preset cannot compose a session, absent when it can. A broken
   * preset stays listed — its directory still occupies the id, so a surface
   * must be able to show and delete it — but offering it for selection would
   * only defer this reason to a failed session start.
   */
  readonly broken?: string
}

/** One toggleable capability group a "定义模式 / Define mode" environment offers. */
export interface EnvironmentGroupEntry {
  /** Stable group id; the browser localizes the label, the id addresses. */
  readonly id: string
  /** English display name, the fallback when a locale has no key. */
  readonly name: string
  /** English one-line description, the fallback when a locale has no key. */
  readonly description: string
  /** Whether a fresh environment pre-selects this group in the picker. */
  readonly defaultEnabled: boolean
}

/** agent-preset-domain unary methods (the map key agentPreset.* of RpcMethodMap). */
export interface AgentPresetsApi {
  /**
   * Lists every preset the deployment currently supplies, in root-precedence
   * order — the roots as configured, each root's own presets sorted by id,
   * and the first root to supply an id wins. The order is not globally
   * sorted: a user root's preset sits in that root's block, not among the
   * shipped ids.
   * An empty roster means the deployment composes no presets at all, and
   * every session shares the host composition. `authorable` reports whether
   * the deployment configures a root new presets can be written to, and
   * `hasDocument` whether `openDocument` can hand a preset directory to a
   * native opener — both deployment facts rather than per-preset ones, and
   * neither exposes a Host path.
   */
  list(request: RpcRequest<{}>):
  Promise<RpcResponse<{ presets: readonly AgentPresetEntry[]; authorable: boolean; hasDocument: boolean }>>

  /**
   * Recompose one session's agent from a different preset.
   *
   * Allowed only while the session is blank — no turn has run. Once a
   * conversation starts, its history was produced under that preset's tools,
   * and swapping them would leave logged tool calls the new composition cannot
   * make; the attempt answers `agent-preset-locked`.
   */
  select(request: RpcRequest<{ sessionId: SessionId; agentPreset: string }>):
  Promise<RpcResponse<{ agentPreset: string }>>

  /**
   * The toggleable capability palette a "定义模式 / Define mode" environment
   * is built from. This is the browser's source for the toggles; composing an
   * environment sends back the chosen group ids through `composeEnvironment`.
   */
  capabilities(request: RpcRequest<{}>):
  Promise<RpcResponse<{ groups: readonly EnvironmentGroupEntry[] }>>

  /**
   * Compose a one-off per-agent environment combined preset (`<agentId>-env-…`).
   *
   * The composition is a strict subset of the `standard` capability set — the
   * rows of every disabled group are dropped — so the caller still cannot name
   * plugins: it only says which of `standard`'s capability groups to KEEP. The
   * agent's own persona is folded in by the Host. Returns the combined preset
   * id, which the caller then binds to a blank session through `select`.
   */
  composeEnvironment(request: RpcRequest<{
    agentId: string
    name: string
    description?: string
    groups: readonly string[]
  }>): Promise<RpcResponse<{ agentPreset: string }>>

  /**
   * Analyze an environment description and recommend which capability groups
   * it needs. The Host runs a model-backed one-shot analysis using the
   * session's own model route; if that is unavailable it falls back to a
   * deterministic keyword analysis. The result merges the deployment's default
   * capability set, so a fresh environment keeps its usual baseline.
   */
  suggestEnvironment(request: RpcRequest<{ sessionId: SessionId; description: string }>, signal?: AbortSignal):
  Promise<RpcResponse<{ groups: readonly string[] }>>

  /**
   * Read one preset's composition text, for the read-only viewer.
   *
   * Privileged: a composition names the plugins a session runs, so reading
   * one is reconnaissance.
   */
  read(request: RpcRequest<{ agentPreset: string }>):
  Promise<RpcResponse<{
    agentPreset: string
    trust: 'system' | 'user'
    content: string
    name?: string
    description?: string
    language?: string
    persona?: string
  }>>

  /**
   * Create a locally authored preset by copying an existing one whole.
   *
   * The only authoring write. No composition text and no path crosses the
   * wire: `from` and `agentPreset` are ids the Host resolves against its own
   * roots, so a copy is exactly as loadable as its source and grants nothing
   * the roster did not already carry. The copy keeps the source's description
   * (the file is the author's to edit afterwards) but not its name — `name`
   * here or the id fallback is what distinguishes the rows.
   */
  copy(request: RpcRequest<{ from: string; agentPreset: string; name?: string }>):
  Promise<RpcResponse<{ agentPreset: string }>>

  /**
   * Create a locally authored agent from a form: copy a base preset and fold
   * the agent's identity (name/language/persona) into the copy.
   *
   * The persona fold is scoped to the composition's `persona` row only, so
   * authoring still grants no plugin capability the base did not carry — it
   * only names who the agent presents as. `from` is the base preset id.
   */
  create(request: RpcRequest<{
    from: string
    agentPreset: string
    name: string
    language: string
    persona: string
    description?: string
  }>):
  Promise<RpcResponse<{ agentPreset: string }>>

  /**
   * Rewrite a locally authored agent's identity (name/language/persona).
   *
   * The composition keeps every row except the `persona` row, so a profile
   * edit changes who the agent presents as, never what it can do. Shipped
   * presets are refused.
   */
  update(request: RpcRequest<{
    agentPreset: string
    name: string
    language: string
    persona: string
    description?: string
  }>):
  Promise<RpcResponse<{ agentPreset: string }>>

  /**
   * Hand one locally authored preset's DIRECTORY to the platform opener, for
   * editing the files that are now the only composition editor. The request
   * carries an id, never a path — the Host resolves it — so no browser
   * payload can select an arbitrary filesystem target. Where the deployment
   * has no native opener (`hasDocument: false` on `list`), the reply carries
   * the resolved directory for the surface to show as text instead. Shipped
   * presets are refused: their install is not the user's to manage.
   */
  openDocument(request: RpcRequest<{ agentPreset: string }>, signal: AbortSignal):
  Promise<RpcResponse<{ opened: true } | { opened: false; path: string }>>

  /** Delete a locally authored preset. Shipped presets are refused. */
  remove(request: RpcRequest<{ agentPreset: string }>): Promise<RpcResponse<{}>>
}
