/**
 * Agent-browser controller: the sidebar's agent roster, the current selection
 * and view (roster / agent page / create / edit), the wire calls behind them,
 * and the conversation-region gate (blank while browsing the roster, the real
 * conversation once inside an agent).
 *
 * An agent is identity only — name / language / persona — with no base mode
 * attached at creation. Capabilities come at chat time: starting a chat
 * stages a COMBINED preset (`<agentId>-<modeId>`, e.g. `agent-xxx-standard`)
 * that copies the chosen mode's composition and folds the agent's persona in.
 * Combined presets are deterministic (created once, reused), so the same
 * (agent, mode) pair always resolves to the same session composition; a
 * session bound to a combined preset belongs to its agent's chat history
 * (matched by the id prefix).
 *
 * The conversation gate registers a shadow occupant for the `conversation`
 * slot (lower priority than ui-conversation's own) only while the browser
 * shows the roster/create surfaces, so the right side reads as a clean start
 * page until an agent is entered; inside an agent the shadow is retired and
 * the real conversation takes over.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  createSnapshotStore, type SessionId, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/** The editable identity fields of one agent. */
export interface AgentFormInput {
  /** Display name. */
  name: string
  /** Language the agent should reply in. */
  language: string
  /** One-line description the author writes about the agent. */
  description: string
  /** The user's own persona instructions. */
  persona: string
}

/** One selectable agent / base-mode entry in the roster. */
export interface AgentViewEntry {
  /** Preset id (the agent's directory name). */
  id: string
  /** Display name, falling back to the id. */
  name: string
  /** One sentence on what the agent is for, when published. */
  description?: string
}

/** One session row inside an agent's chat history. */
export interface AgentSessionEntry {
  /** Session id, for `sessions.open`. */
  id: string
  /** The session's title. */
  title: string
  /** Whether the session is the currently open one. */
  current: boolean
  /** Last-activity time, for newest-first ordering. */
  updatedAt: number
}

/** The browser's view. */
export type AgentBrowserView = 'roster' | 'agent' | 'create' | 'edit'

/** Browser snapshot. */
export interface AgentBrowserState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  /** The user's own agents (combined presets excluded). */
  agents: readonly AgentViewEntry[]
  /** Chat-time mode options: the shipped system presets minus the meta mode. */
  bases: readonly AgentViewEntry[]
  /** The selected agent id, empty until one is chosen. */
  selected: string
  /** Which surface the browser is showing. */
  view: AgentBrowserView
  /** Prefill for the edit form, loaded when a profile is opened. */
  profile: AgentFormInput | null
  /** A wire call is in flight (buttons disabled). */
  busy: boolean
  /** Whether the roster list is collapsed (title-only). */
  collapsed: boolean
}

const INITIAL: AgentBrowserState = {
  status: 'idle', error: null, agents: [], bases: [], selected: '', view: 'roster',
  profile: null, busy: false, collapsed: false,
}

/** The meta preset offered only to preset authors; excluded from mode choices. */
const META_PRESET_ID = 'cordis'

/** A combined preset id ends with the mode id: `<agentId>-<modeId>`. */
function isCombinedPreset(id: string): boolean {
  return /-(standard|code|minimal)$/.test(id)
}

/** A failure message from a wire call, or undefined on success. */
export type WireFailure = string | undefined

/** Reads one error message off an RPC envelope, whatever its shape. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Present one roster row as a view entry. */
function entryOf(preset: { id: string; name?: string; description?: string }): AgentViewEntry {
  return {
    id: preset.id,
    name: preset.name ?? preset.id,
    ...preset.description === undefined ? {} : { description: preset.description },
  }
}

/** The agent-preset wire face this controller needs. */
export type AgentPresetWire = Pick<
  ConnectionHandle['api'],
  'agentPresets'
>

/**
 * Owns the agent browser's state and its wire calls.
 */
export class AgentBrowserController {
  /** Snapshot the renderer subscribes to. */
  readonly store: SnapshotStore<AgentBrowserState> = createSnapshotStore(INITIAL)

  /** The agent a chat-start is about to open for (the hero's mode pick maps to it). */
  private pending: string | undefined

  /** Dispose the session-list subscription. */
  private stopApplying: (() => void) | undefined

  /** Disposer of the active conversation shadow, absent while not shadowing. */
  private shadowDisposer: (() => void) | undefined

  /** The conversation shadow factory, bound once the slot declaration is up. */
  private shadowFactory: (() => () => void) | undefined

  /** View change listeners (the sidebar shell's primary-control shape). */
  private readonly viewListeners = new Set<(view: AgentBrowserView) => void>()

  constructor(
    private readonly api: AgentPresetWire,
    private readonly ctx: ClientContext,
  ) {
    // Nothing to subscribe here: the hero chip (ui-agent-preset) owns staging
    // and applying the combined preset once the session appears.
    this.stopApplying = undefined
  }

  /** Tear down the session-list subscription and the conversation gate. */
  dispose(): void {
    this.stopApplying?.()
    this.stopApplying = undefined
    this.shadowDisposer?.()
    this.shadowDisposer = undefined
    this.shadowFactory = undefined
    this.viewListeners.clear()
  }

  private set(patch: Partial<AgentBrowserState>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch })
    this.updateConversationShadow()
    for (const listener of this.viewListeners) listener(this.store.getSnapshot().view)
  }

  /** Subscribe to view changes; returns the disposer. */
  subscribeView(listener: (view: AgentBrowserView) => void): () => void {
    this.viewListeners.add(listener)
    return () => { this.viewListeners.delete(listener) }
  }

  /**
   * Bind the conversation-region gate: `factory` creates one shadow occupant
   * for the `conversation` slot and returns its disposer. Called once the slot
   * declaration is on the ledger; the gate then tracks the view.
   * @param factory - creates one shadow occupant for the conversation slot.
   */
  bindConversationShadow(factory: () => () => void): void {
    this.shadowFactory = factory
    this.updateConversationShadow()
  }

  /** Detach the gate (slot declaration went away); retire any shadow. */
  unbindConversationShadow(): void {
    this.shadowFactory = undefined
    this.shadowDisposer?.()
    this.shadowDisposer = undefined
  }

  /** Reconcile the conversation shadow with the current view. */
  private updateConversationShadow(): void {
    const factory = this.shadowFactory
    if (factory === undefined) return
    const view = this.store.getSnapshot().view
    const want = view === 'roster' || view === 'create'
    if (want && this.shadowDisposer === undefined) {
      this.shadowDisposer = factory()
    } else if (!want && this.shadowDisposer !== undefined) {
      this.shadowDisposer()
      this.shadowDisposer = undefined
    }
  }

  /** The agent a pending chat-start belongs to, for the hero's mode pick. */
  pendingAgent(): string | undefined {
    return this.pending
  }

  /** Clear the pending chat context once the session has bound its preset. */
  consumePendingAgent(): void {
    this.pending = undefined
  }

  /** Map a combined preset id back to its mode id, when it is one. */
  modeIdFor(combinedId: string): string | undefined {
    const mode = combinedId.split('-').pop()
    return mode !== undefined && isCombinedPreset(combinedId) ? mode : undefined
  }

  /**
   * Load the roster: the user's agents (combined presets hidden) plus the
   * chat-time mode options.
   * @returns once the snapshot reflects the host.
   */
  async load(): Promise<void> {
    const before = this.store.getSnapshot()
    if (before.status === 'loading') return
    this.set({ status: 'loading', error: null })
    try {
      const response = await this.api.agentPresets.list({})
      if (!response.result.ok) {
        this.set({ status: 'error', error: response.result.error.message })
        return
      }
      const { presets } = response.result.value
      const agents = presets
        .filter(preset => preset.trust === 'user' && preset.broken === undefined && !isCombinedPreset(preset.id))
        .map(entryOf)
      const bases = presets
        .filter(preset => preset.trust === 'system' && preset.broken === undefined && preset.id !== META_PRESET_ID)
        .map(entryOf)
      const snapshot = this.store.getSnapshot()
      const selectionGone = snapshot.selected !== '' && !agents.some(agent => agent.id === snapshot.selected)
      this.set({
        status: 'ready',
        error: null,
        agents,
        bases,
        selected: selectionGone ? '' : snapshot.selected,
        view: selectionGone && snapshot.view === 'agent' ? 'roster' : snapshot.view,
      })
    } catch (error) {
      this.set({ status: 'error', error: messageOf(error) })
    }
  }

  /** Toggle the roster list's collapsed state. */
  toggleCollapsed(): void {
    this.set({ collapsed: !this.store.getSnapshot().collapsed })
  }

  /** Return to the default roster page (the shell's back control). */
  backToRoster(): void {
    this.set({ view: 'roster' })
  }

  /** Leave a form surface: edit returns to the agent page, create to the roster. */
  back(): void {
    const view = this.store.getSnapshot().view
    this.set({ view: view === 'edit' ? 'agent' : 'roster' })
  }

  /**
   * Open one agent's page: chat history on the left, the agent's most recent
   * chat (when one exists) on the right.
   * @param id - the agent to enter.
   */
  async selectAgent(id: string): Promise<void> {
    this.set({ view: 'agent', selected: id, profile: null, error: null })
    const session = this.agentSessions()[0]
    if (session !== undefined) this.ctx.sessions.open(session.id as SessionId)
  }

  /** The selected agent's chat history (its combined chats included), newest first. */
  agentSessions(): AgentSessionEntry[] {
    const selected = this.store.getSnapshot().selected
    if (selected === '') return []
    const state = this.ctx.sessions.list.getSnapshot()
    const rows: AgentSessionEntry[] = []
    for (const [id, summary] of Object.entries(state.byId)) {
      if (summary.agentPreset !== selected && !(summary.agentPreset?.startsWith(`${selected}-`) ?? false)) continue
      rows.push({
        id,
        title: summary.title ?? id,
        current: id === state.current,
        updatedAt: summary.updatedAt ?? 0,
      })
    }
    return rows.sort((left, right) => right.updatedAt - left.updatedAt)
  }

  /** Open one chat from the agent's history. */
  openSession(sessionId: string): void {
    this.ctx.sessions.open(sessionId as SessionId)
  }

  /** Open the create form (only reachable from the roster page). */
  openCreate(): void {
    this.set({ view: 'create', profile: null, error: null })
  }

  /**
   * Open one agent's profile for editing, prefilled from the host.
   * @param id - the agent to edit.
   */
  async openProfile(id: string): Promise<void> {
    this.set({ view: 'edit', selected: id, profile: null, error: null })
    try {
      const response = await this.api.agentPresets.read({ agentPreset: id })
      if (!response.result.ok) {
        this.set({ error: response.result.error.message, view: 'agent' })
        return
      }
      const { name, language, persona, description } = response.result.value
      this.set({
        profile: {
          name: name ?? id,
          language: language ?? '',
          description: description ?? '',
          persona: persona ?? '',
        },
      })
    } catch (error) {
      this.set({ error: messageOf(error), view: 'agent' })
    }
  }

  /**
   * Create an agent (identity only — no base mode) and open its page.
   * @param input - the form fields.
   * @returns the failure message, or undefined on success.
   */
  async create(input: AgentFormInput): Promise<WireFailure> {
    const name = input.name.trim()
    if (name === '') return 'empty-name'
    const id = deriveId(name)
    this.set({ busy: true, error: null })
    try {
      const response = await this.api.agentPresets.create({
        // The agent preset itself is identity-only; capabilities come from the
        // combined presets a chat start builds on the minimal base.
        from: 'minimal', agentPreset: id, ...input,
      })
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message })
        return response.result.error.message
      }
      await this.load()
      this.set({ busy: false, view: 'agent', selected: id })
      // The agent exists even when the first chat could not be composed; the
      // failure is reported on the agent page instead of rolling back the create.
      const chatFailure = await this.startChat(id)
      if (chatFailure !== undefined) return chatFailure
      return undefined
    } catch (error) {
      const message = messageOf(error)
      this.set({ busy: false, error: message })
      return message
    }
  }

  /**
   * Save a profile edit, propagating the identity to the agent's combined
   * presets, and return to the agent page.
   * @param id - the agent to update.
   * @param input - the form fields.
   * @returns the failure message, or undefined on success.
   */
  async saveEdit(id: string, input: AgentFormInput): Promise<WireFailure> {
    this.set({ busy: true, error: null })
    try {
      const response = await this.api.agentPresets.update({ agentPreset: id, ...input })
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message })
        return response.result.error.message
      }
      // Propagate the identity to every existing combined preset.
      const roster = await this.api.agentPresets.list({})
      if (roster.result.ok) {
        for (const preset of roster.result.value.presets) {
          if (preset.id === id || !preset.id.startsWith(`${id}-`)) continue
          await this.api.agentPresets.update({ agentPreset: preset.id, ...input })
        }
      }
      await this.load()
      this.set({ busy: false, view: 'agent', selected: id, error: null })
      return undefined
    } catch (error) {
      const message = messageOf(error)
      this.set({ busy: false, error: message })
      return message
    }
  }

  /**
   * Delete an agent, its combined presets included, and return to the roster.
   * @param id - the agent to remove.
   * @returns the failure message, or undefined on success.
   */
  async remove(id: string): Promise<WireFailure> {
    this.set({ busy: true, error: null })
    try {
      const roster = await this.api.agentPresets.list({})
      if (roster.result.ok) {
        for (const preset of roster.result.value.presets) {
          if (preset.id === id || !preset.id.startsWith(`${id}-`)) continue
          await this.api.agentPresets.remove({ agentPreset: preset.id })
        }
      }
      const response = await this.api.agentPresets.remove({ agentPreset: id })
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message })
        return response.result.error.message
      }
      await this.load()
      this.set({ busy: false, view: 'roster', selected: '', error: null })
      return undefined
    } catch (error) {
      const message = messageOf(error)
      this.set({ busy: false, error: message })
      return message
    }
  }

  /**
   * Start a new chat with one agent: compose the agent's default combined
   * preset FIRST so the created session binds to it directly — the hero's
   * staging runs on roster load and misses a chat started right after a
   * create, which would otherwise leave the session on the deployment
   * default. The hero's mode pick can still swap the composition while the
   * session is blank. The agent is also recorded as the pending chat context.
   *
   * A composition failure is surfaced, never swallowed: starting the session
   * anyway would silently bind it to the deployment default and hide it from
   * this agent's chat history.
   * @param id - the agent to chat with.
   * @returns a failure message when the combined preset could not be
   * composed (the chat was NOT started), or undefined on success.
   */
  async startChat(id: string): Promise<WireFailure> {
    this.pending = id
    const composed = await this.ensureCombined(id, 'standard')
    if (composed === undefined) {
      this.pending = undefined
      const message = 'chat.startFailed'
      this.set({ error: message, busy: false })
      return message
    }
    void this.ctx.workspaces.startSession(undefined, composed)
    return undefined
  }

  /**
   * Ensure the combined preset for the pending agent + mode exists.
   * The hero chip stages and applies it; this only makes it available.
   * @param modeId - the mode the user picked.
   * @returns the combined preset id, or undefined when composition fails.
   */
  async composeForPendingAgent(modeId: string): Promise<string | undefined> {
    const agentId = this.pending
    if (agentId === undefined) return undefined
    return await this.ensureCombined(agentId, modeId)
  }

  /**
   * Ensure the combined preset `<agentId>-<modeId>` exists: a deterministic
   * copy of the mode's composition with the agent's persona folded in.
   * @param agentId - the agent preset id.
   * @param modeId - the mode preset id (standard / code / minimal).
   * @returns the combined preset id, or undefined when it cannot be composed.
   */
  private async ensureCombined(agentId: string, modeId: string): Promise<string | undefined> {
    const comboId = `${agentId}-${modeId}`
    try {
      const roster = await this.api.agentPresets.list({})
      if (roster.result.ok && roster.result.value.presets.some(preset => preset.id === comboId)) {
        return comboId
      }
      const read = await this.api.agentPresets.read({ agentPreset: agentId })
      if (!read.result.ok) return undefined
      const { name, language, persona } = read.result.value
      const modeName = this.store.getSnapshot().bases.find(base => base.id === modeId)?.name ?? modeId
      const created = await this.api.agentPresets.create({
        from: modeId,
        agentPreset: comboId,
        name: `${name ?? agentId}（${modeName}）`,
        language: language ?? '',
        persona: persona ?? '',
      })
      return created.result.ok ? comboId : undefined
    } catch {
      return undefined
    }
  }
}

/**
 * Derive a stable preset id from a display name: lowercased, spaces and
 * punctuation to dashes, non-id characters dropped, with a timestamp suffix so
 * recreating a same-named agent never collides with its predecessor.
 * @param name - the display name.
 * @returns an id matching PRESET_ID (`^[a-z0-9][a-z0-9-]*$`).
 */
export function deriveId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const core = base.length > 0 ? base : 'agent'
  return `${core.slice(0, 32)}-${Date.now().toString(36)}`
}
