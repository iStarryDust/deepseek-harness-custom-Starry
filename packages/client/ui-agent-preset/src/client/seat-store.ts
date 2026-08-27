/**
 * Hero-chip controller: which preset the NEXT session gets.
 *
 * The new-session screen has no session, so a pick is staged rather than
 * applied. It reaches a session when one becomes current and is still blank —
 * whether the workspace connect created it or reused an existing blank one,
 * which is why staging cannot simply ride along on `sessions.create`.
 *
 * The stage is forgotten once applied: the next new session starts from the
 * deployment default again, matching the workspace picker beside it.
 *
 * The hero offers CHAT-TIME MODES only (the shipped system presets minus the
 * meta "cordis" mode); locally authored agents never appear here. When a chat
 * starts from an agent page, the agent context routes the pick through a
 * combined preset (mode composition + agent persona), so the session belongs
 * to the agent's chat history while the chip still reads as a plain mode.
 */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type SessionId, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { messageOf, presetOptions } from './settings-store.ts'
import type { AgentPresetOption } from './settings-store.ts'

/** The meta preset offered only to preset authors; excluded from mode choices. */
const META_PRESET_ID = 'cordis'

/** The mode a chat from an agent page starts with when the user does not pick. */
const DEFAULT_MODE_ID = 'standard'

/** The synthetic hero menu id for the "定义模式 / Define mode" entry. */
export const DEFINE_MODE_ID = '__define__'

/**
 * A combined preset id is `<agentId>-<modeId>`. Used to recover the owning
 * agent from the current session's preset, so the environment entry stays
 * available on an agent's blank session even after the initial stage was
 * applied and the pending-chat context was consumed.
 */
const COMBINED_PRESET_RE = /^(.+)-(standard|code|minimal|env-[a-z0-9-]+)$/

/** One toggleable capability group offered by the environment picker. */
export interface EnvironmentCapability {
  /** Stable group id; the picker localizes the label, the id addresses. */
  readonly id: string
  /** English display name, the fallback when a locale has no key. */
  readonly name: string
  /** English one-line description, the fallback when a locale has no key. */
  readonly description: string
  /** Whether a fresh environment pre-selects this group in the picker. */
  readonly defaultEnabled: boolean
}

/** The chat-time agent context published by ui-agents, when present. */
export interface AgentChatContext {
  /** The agent a pending chat-start belongs to, absent otherwise. */
  pendingAgent: () => string | undefined
  /** Ensure the combined preset for that agent + mode and stage it. */
  composeForPendingAgent: (modeId: string) => Promise<string | undefined>
  /** Map a combined preset id back to its mode id, when it is one. */
  modeIdFor: (combinedId: string) => string | undefined
  /** Clear the pending chat context once the session has bound its preset. */
  consumePendingAgent: () => void
}

/** Hero-chip snapshot. */
export interface AgentPresetSeatState {
  /** The mode choices the deployment supplies; empty means the chip renders nothing. */
  options: readonly AgentPresetOption[]
  /** The staged choice (display form), empty until the roster loads. */
  current: string
  /** A rejected apply's message, cleared by the next attempt. */
  error: string | null
  busy: boolean
  /**
   * One-shot cue that the chip should introduce itself (the creator-draft
   * entry staged the pick from another screen, so the user never touched the
   * chip); the renderer clears it via `introduced()` once played.
   */
  introduce: boolean
  /**
   * Whether the chip can offer a per-agent environment ("定义模式"). An
   * environment nests under its owning agent, so it is only offered while a
   * chat-start from an agent page still has its pending agent.
   */
  canDefine: boolean
}

const INITIAL: AgentPresetSeatState = {
  options: [], current: '', error: null, busy: false, introduce: false, canDefine: false,
}

/** One session's identity and whether it has started. */
export interface SeatSessionSummary {
  /** The session the chip would apply its staged choice to. */
  id: SessionId
  /** False once a turn has run — applying is refused from then on. */
  blank: boolean
  /** The preset the session already runs, when the summary reports one. */
  agentPreset?: string
}

/** Stages the next session's preset and applies it when one appears. */
export class AgentPresetSeatController {
  /** Chip snapshot the renderer subscribes to. */
  readonly store: SnapshotStore<AgentPresetSeatState> = createSnapshotStore(INITIAL)

  /**
   * The deployment default, so a consumed stage can fall back to it without
   * re-reading the roster.
   */
  private fallback = ''

  /** Set while a pick is waiting for a session; cleared once applied. */
  private staged: string | undefined

  constructor(
    private readonly api: Pick<IApiClient, 'agentPresets'>,
    /** The session the hero is about to hand over to, when there is one. */
    private readonly currentSession: () => SeatSessionSummary | undefined,
    /**
     * Publish an applied switch into the session list, so the header label
     * moves with the composition instead of waiting for the next full list
     * refresh. Optional: a harness that renders no list omits it.
     */
    private readonly onApplied?: (sessionId: string, agentPreset: string) => void,
    /**
     * The chat-time agent context (ui-agents), when a chat starts from an
     * agent page: the mode pick then composes a combined preset for that
     * agent instead of binding the bare mode.
     */
    private readonly agentContext?: AgentChatContext,
  ) {}

  private set(patch: Partial<AgentPresetSeatState>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch })
  }

  /** Show a preset id in its display form (combined ids read as their mode). */
  private displayId(actualId: string): string {
    const mode = this.agentContext?.modeIdFor(actualId)
    return mode ?? actualId
  }

  /**
   * The owning agent of the current session's preset, when it is a combined
   * preset belonging to an agent. Lets the environment entry serve an agent's
   * blank session even when the pending-chat context (ui-agents) has already
   * been consumed by an applied pick.
   * @returns the agent id, or undefined when the session runs no combined preset.
   */
  private agentIdOfCurrent(): string | undefined {
    const agentPreset = this.currentSession()?.agentPreset
    if (agentPreset === undefined) return undefined
    return COMBINED_PRESET_RE.exec(agentPreset)?.[1]
  }

  /**
   * Whether the hero can offer a per-agent environment. An environment nests
   * under its owning agent, so it needs an agent to own it: either the pending
   * chat-start agent, or the agent the current blank session already runs a
   * combined preset for.
   */
  private canDefine(): boolean {
    if (this.agentContext?.pendingAgent() !== undefined) return true
    const session = this.currentSession()
    return session !== undefined && session.blank && this.agentIdOfCurrent() !== undefined
  }

  /**
   * Read the mode roster and open the chip on the deployment default.
   * @returns once the snapshot reflects the host.
   */
  async load(): Promise<void> {
    try {
      const response = await this.api.agentPresets.list({})
      if (!response.result.ok) {
        this.set({ error: response.result.error.message })
        return
      }
      const modes = response.result.value.presets.filter(preset =>
        preset.trust === 'system' && preset.id !== META_PRESET_ID && preset.broken === undefined)
      this.fallback = modes.find(preset => preset.isDefault)?.id ?? modes[0]?.id ?? ''
      // A chat started from an agent page: stage the agent's default combined
      // preset so even a user who never touches the chip binds to the agent.
      if (this.agentContext !== undefined && this.agentContext.pendingAgent() !== undefined) {
        const composed = await this.agentContext.composeForPendingAgent(DEFAULT_MODE_ID)
        if (composed !== undefined) this.staged = composed
      }
      this.set({
        options: presetOptions(modes),
        // Staged pick first, then the composition the current session already
        // carries, then the deployment default. The middle term keeps a
        // late-landing load from regressing the display after an applied
        // stage was consumed.
        current: this.staged === undefined
          ? this.displayId(this.currentSession()?.agentPreset ?? this.fallback)
          : this.displayId(this.staged),
        // An environment nests under its owning agent, so offer "定义模式"
        // whenever there is an agent to own it — pending or already running a
        // combined preset on the current blank session.
        canDefine: this.canDefine(),
        error: null,
      })
    } catch (error) {
      this.set({ error: messageOf(error) })
    }
  }

  /**
   * Stage one mode for the next session, composing it into the pending
   * agent's combined preset when a chat starts from an agent page, and apply
   * it immediately when a blank session is already current.
   * @param id - the mode to stage.
   * @returns once the stage settled, and the apply too when one happened.
   */
  async select(id: string): Promise<void> {
    if (this.store.getSnapshot().busy) return
    let staged = id
    if (this.agentContext !== undefined && this.agentContext.pendingAgent() !== undefined) {
      const composed = await this.agentContext.composeForPendingAgent(id)
      if (composed !== undefined) staged = composed
    }
    this.stage(staged)
    await this.apply()
  }

  /**
   * Stage a pick WITHOUT the immediate apply, for a flow that starts the
   * receiving session after the pick (the settings section's creator entry).
   * `select()`'s immediate apply would meet the still-current running session
   * and drop the stage as unservable; staging alone leaves it for the
   * list-change applier, which fires when the started session becomes
   * current.
   * @param id - the preset to stage.
   * @param introduce - true when the stage came from another screen and the
   * chip should announce itself on the session it lands on.
   */
  stage(id: string, introduce = false): void {
    this.staged = id
    this.set({ current: this.displayId(id), error: null, introduce })
  }

  /** Acknowledge the introduction cue once the chip has played it. */
  introduced(): void {
    if (!this.store.getSnapshot().introduce) return
    this.set({ introduce: false })
  }

  /**
   * Hand the staged choice to the current session, if there is one to take it.
   *
   * Called both by `select()` and by whoever observes the current session
   * changing, because the session may appear either before or after the pick.
   * @returns once the switch settled, or immediately when there is nothing to do.
   */
  async apply(): Promise<void> {
    const staged = this.staged
    const session = this.currentSession()
    if (staged === undefined || session === undefined) return
    // A started session's history was produced under its own composition; the
    // host refuses the swap, so the stage is no longer meaningful.
    if (!session.blank || session.agentPreset === staged) {
      this.staged = undefined
      return
    }
    this.set({ busy: true, error: null })
    try {
      const response = await this.api.agentPresets.select({ sessionId: session.id, agentPreset: staged })
      this.staged = undefined
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message, current: this.fallback })
        return
      }
      // Consumed: the next new session opens on the deployment default again.
      this.set({ busy: false, current: this.displayId(response.result.value.agentPreset), canDefine: this.canDefine() })
      this.onApplied?.(session.id, response.result.value.agentPreset)
      // The chat bound; an agent-page start's pending context is spent.
      this.agentContext?.consumePendingAgent()
    } catch (error) {
      this.staged = undefined
      this.set({ busy: false, error: messageOf(error), current: this.fallback })
    }
  }

  /**
   * Read the toggleable capability palette the environment picker renders.
   * @returns one entry per group, or an empty list with an error on the chip.
   */
  async loadCapabilities(): Promise<EnvironmentCapability[]> {
    const response = await this.api.agentPresets.capabilities({})
    if (!response.result.ok) {
      this.set({ error: response.result.error.message })
      return []
    }
    return [...response.result.value.groups]
  }

  /**
   * Compose one per-agent environment and bind it to the current blank
   * session. The picked groups are authoritative the caller may only KEEP the
   * groups it checked — the Host builds the subset, so no plugin text crosses
   * the wire. On success the environment preset replaces the staged choice and
   * is applied immediately when a blank session is current.
   * @param name - the environment's display name.
   * @param description - a one-line note, when provided.
   * @param groups - the capability groups the environment keeps.
   * @returns the composed combined preset id, or undefined when there is no
   * pending agent, composition failed, or the apply was refused.
   */
  async defineEnvironment(
    name: string,
    description: string,
    groups: readonly string[],
  ): Promise<string | undefined> {
    const agentId = this.agentContext?.pendingAgent() ?? this.agentIdOfCurrent()
    if (agentId === undefined) return undefined
    const response = await this.api.agentPresets.composeEnvironment({
      agentId,
      name,
      ...description === '' ? {} : { description },
      groups,
    })
    if (!response.result.ok) {
      this.set({ error: response.result.error.message })
      return undefined
    }
    const combinedId = response.result.value.agentPreset
    this.stage(combinedId)
    await this.apply()
    return combinedId
  }

  /**
   * Analyze an environment description and return the capability group ids the
   * deployment recommends (a model-backed analysis on the Host, falling back to
   * a deterministic keyword analysis). The suggestion already merges the
   * deployment's default capability set.
   * @param description - the environment description (name or note).
   * @returns the recommended capability ids, or an empty list when no current
   * session could back the analysis or the Host answered an error.
   */
  async suggestEnvironment(description: string): Promise<string[]> {
    const session = this.currentSession()
    if (session === undefined) return []
    const response = await this.api.agentPresets.suggestEnvironment({
      sessionId: session.id,
      description,
    })
    if (!response.result.ok) {
      this.set({ error: response.result.error.message })
      return []
    }
    return [...response.result.value.groups]
  }
}
