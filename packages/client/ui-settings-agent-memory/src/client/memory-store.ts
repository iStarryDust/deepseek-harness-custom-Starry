/**
 * Agent-memory settings page store: the four switches over the `agent-memory`
 * settings namespace and the global memory document over the agentMemory RPC.
 * The settings scope is the switch transport (loopback follows the durable
 * Host section; a remote browser's memory mode stays process-local, exactly
 * like the welcome notice), while the document rides the wire domain.
 */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** The four memory switches, default all off (mirrors the host schema). */
export interface MemorySwitches {
  globalEnabled: boolean
  agentEnabled: boolean
  autoMemory: boolean
  askMemory: boolean
}

/** Accept any object section verbatim; malformed durable values read as off. */
export function decodeMemorySection(section: unknown): MemorySwitches {
  const source = typeof section === 'object' && section !== null && !Array.isArray(section)
    ? section as Record<string, unknown>
    : {}
  return {
    globalEnabled: source.globalEnabled === true,
    agentEnabled: source.agentEnabled === true,
    autoMemory: source.autoMemory === true,
    askMemory: source.askMemory === true,
  }
}

/** Editor transient state (the draft and its save outcome). */
export interface MemoryEditorState {
  /** The global document draft in the editor. */
  globalText: string
  /** Save lifecycle of the global editor. */
  saveState: 'idle' | 'saving' | 'saved' | 'failed'
  /** Editor load failure text, when the document could not be loaded. */
  loadError: string | null
}

/** Page snapshot rendered by the section. */
export interface MemorySectionState {
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'
  switches: MemorySwitches
  editor: MemoryEditorState
}

/** One settings-page controller (one per settings surface). */
export class MemorySettingsController {
  /** uSES-safe state source shared by the registered section. */
  readonly store: SnapshotStore<MemorySectionState> = createSnapshotStore<MemorySectionState>({
    status: 'idle',
    switches: { globalEnabled: false, agentEnabled: false, autoMemory: false, askMemory: false },
    editor: { globalText: '', saveState: 'idle', loadError: null },
  })

  private following: (() => void) | undefined

  /**
   * @param scope - the `agent-memory` settings namespace scope (switch state).
   * @param api - the wire face for the memory domain.
   */
  constructor(
    private readonly scope: SettingsScope<MemorySwitches>,
    private readonly api: Pick<IApiClient, 'agentMemory'>,
  ) {}

  /** Begin following the switch scope (idempotent) and load the global document. */
  async load(): Promise<void> {
    this.following ??= this.scope.subscribe(() => { this.deriveSwitches() })
    this.deriveSwitches()
    await this.loadGlobal()
  }

  /** Toggle one switch through the settings scope. */
  async toggle(field: keyof MemorySwitches, next: boolean): Promise<void> {
    await this.scope.set(field, next)
  }

  /** Update the global-memory editor draft (client-side only until save). */
  setDraft(text: string): void {
    this.store.update((state) => {
      state.editor.globalText = text
      state.editor.saveState = 'idle'
    })
  }

  /** Save the global document through the wire. */
  async saveGlobal(): Promise<void> {
    const { globalText } = this.store.getSnapshot().editor
    this.store.update((state) => {
      state.editor.saveState = 'saving'
      state.editor.loadError = null
    })
    try {
      const response = await this.api.agentMemory.writeGlobal({ text: globalText })
      if (!response.result.ok) throw new Error(response.result.error.message)
      this.store.update((state) => { state.editor.saveState = 'saved' })
    } catch (error) {
      this.store.update((state) => {
        state.editor.saveState = 'failed'
        state.editor.loadError = error instanceof Error ? error.message : String(error)
      })
    }
  }

  /** Stop following the scope. */
  dispose(): void {
    this.following?.()
    this.following = undefined
  }

  private deriveSwitches(): void {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status === 'loading') {
      this.store.update((state) => { state.status = 'loading' })
      return
    }
    if (snapshot.status === 'unavailable' || snapshot.value === undefined) {
      this.store.update((state) => {
        state.status = 'error'
        state.switches = { globalEnabled: false, agentEnabled: false, autoMemory: false, askMemory: false }
      })
      return
    }
    this.store.update((state) => {
      state.status = 'ready'
      state.switches = snapshot.value as MemorySwitches
    })
  }

  private async loadGlobal(): Promise<void> {
    try {
      const response = await this.api.agentMemory.readGlobal({})
      const result = response.result
      if (!result.ok) throw new Error(result.error.message)
      this.store.update((state) => {
        state.editor.globalText = result.value.text
        state.editor.loadError = null
      })
    } catch (error) {
      this.store.update((state) => {
        state.editor.loadError = error instanceof Error ? error.message : String(error)
      })
    }
  }
}
