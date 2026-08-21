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
}

const INITIAL: AgentPresetSeatState = {
  options: [], current: '', error: null, busy: false, introduce: false,
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
      this.set({ busy: false, current: this.displayId(response.result.value.agentPreset) })
      this.onApplied?.(session.id, response.result.value.agentPreset)
      // The chat bound; an agent-page start's pending context is spent.
      this.agentContext?.consumePendingAgent()
    } catch (error) {
      this.staged = undefined
      this.set({ busy: false, error: messageOf(error), current: this.fallback })
    }
  }
}
