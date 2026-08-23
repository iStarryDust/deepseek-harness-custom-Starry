/**
 * The built-in browser card's staged form over the `browser` settings
 * namespace, plus the install/detect actions it exposes through the host
 * remote surface.
 *
 * The card stages the agent-use switch and the request headers like every
 * other plugin card (save is the single point a draft becomes a document
 * mutation), while the install area is an action, not a setting: it probes
 * whether a Chromium is already under `~/.dsh/browser` and can start an
 * install.
 */

import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { CardForm, booleanField, textField, type CardActions, type CardFieldState, type CardShell } from './card-form.ts'

/**
 * Namespace of the built-in browser's user-owned settings. Spelled here rather
 * than imported: a client package must not depend on a Host package.
 */
export const BROWSER_NS = 'browser'

/** The browser fields this card edits. */
export interface BrowserSettings {
  /** Whether the agent tool may drive the built-in browser. */
  agentUseBrowser?: boolean
  /** JSON object text applied as extra request headers. */
  requestHeaders?: string
}

/**
 * Minimal remote face for the install/probe actions. Sized to the two methods
 * this card calls rather than the whole `IApiClient`, so the card does not
 * depend on a Host type whose built output may lag this feature.
 */
export interface BrowserHostApi {
  host: {
    browserProbe(payload: {}): Promise<{
      result:
        | { ok: true; value: { installed: boolean; path?: string } }
        | { ok: false; error?: { message?: string } }
    }>
    browserInstall(payload: {}): Promise<{
      result:
        | { ok: true; value: { ok: boolean; output?: string; error?: string } }
        | { ok: false; error?: { message?: string } }
    }>
  }
}

/** What the browser card renders. */
export interface BrowserCardState extends CardShell {
  /** Agent-use switch. */
  agentUseBrowser: CardFieldState
  /** Request headers. */
  requestHeaders: CardFieldState
  /** Whether a Chromium is installed under `~/.dsh/browser`. */
  browserInstalled: boolean
  /** Whether a probe is in flight. */
  probing: boolean
  /** Whether an install is in flight. */
  installing: boolean
  /** Last install/probe message, if any. */
  installMessage: string | undefined
}

/** The registration-side face the browser card's slot entry injects. */
export interface BrowserCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useBrowserCard. */
    browserCard: SnapshotStore<BrowserCardState>
  }
  /** Probe whether the built-in browser is installed. */
  probe: () => void
  /** Start the built-in browser install. */
  install: () => void
}

/** Bridges the `browser` scope, the host remote, and the card's staged form. */
export class BrowserCardController {
  private readonly form: CardForm<BrowserSettings>
  private readonly store: SnapshotStore<BrowserCardState>
  private browserInstalled = false
  private probing = false
  private installing = false
  private installMessage: string | undefined
  private pollTimer: ReturnType<typeof setInterval> | undefined

  /**
   * @param scope - the bound settings scope for the `browser` namespace.
   * @param api - wire face used for the install/probe actions.
   */
  constructor(scope: SettingsScope<BrowserSettings>, private readonly api: BrowserHostApi) {
    this.form = new CardForm(scope, [booleanField('agentUseBrowser'), textField('requestHeaders')])
    this.store = this.form.bind(() => this.projection())
    // Re-probe whenever the section changes so the install badge reflects the
    // current filesystem state after an install.
    scope.subscribe(() => { void this.probe() })
    void this.probe()
  }

  private projection(): BrowserCardState {
    return {
      ...this.form.shell(),
      agentUseBrowser: this.form.field('agentUseBrowser'),
      requestHeaders: this.form.field('requestHeaders'),
      browserInstalled: this.browserInstalled,
      probing: this.probing,
      installing: this.installing,
      installMessage: this.installMessage,
    }
  }

  /** Ask the host whether the built-in browser is installed. */
  async probe(): Promise<void> {
    if (this.probing) return
    this.probing = true
    this.store.set(this.projection())
    try {
      const response = await this.api.host.browserProbe({})
      if (response.result.ok) this.browserInstalled = response.result.value.installed
    } catch (_probeFailure) {
      // Keep the last known state; a later probe re-judges it.
    }
    this.probing = false
    this.store.set(this.projection())
  }

  /** Start the built-in browser install, then poll until it actually lands. */
  async install(): Promise<void> {
    if (this.installing) return
    this.installing = true
    this.installMessage = '正在安装内置浏览器，请稍候…'
    this.store.set(this.projection())
    try {
      const response = await this.api.host.browserInstall({})
      if (response.result.ok) {
        // The install is fire-and-forget (the host returns immediately), so
        // poll detection until the browser really lands rather than trusting
        // the immediate-but-possibly-not-yet-true "ok".
        if (this.pollTimer === undefined) {
          this.pollTimer = setInterval(() => { void this.pollUntilInstalled() }, 3000)
        }
        void this.pollUntilInstalled()
        return
      }
      this.installMessage = response.result.error?.message ?? '安装失败。'
    } catch (error) {
      this.installMessage = `安装异常：${error instanceof Error ? error.message : String(error)}`
    }
    this.installing = false
    this.store.set(this.projection())
  }

  /** Poll detection until the browser is installed, then stop and report. */
  private async pollUntilInstalled(): Promise<void> {
    await this.probe()
    if (this.browserInstalled) {
      this.installing = false
      this.installMessage = '内置浏览器已安装。'
      if (this.pollTimer !== undefined) {
        clearInterval(this.pollTimer)
        this.pollTimer = undefined
      }
      this.store.set(this.projection())
    }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot, its form actions, and the install actions.
   */
  inject(): BrowserCardFace {
    return {
      hooks: { browserCard: this.store },
      ...this.form.actions(),
      probe: () => { void this.probe() },
      install: () => { void this.install() },
    }
  }
}
