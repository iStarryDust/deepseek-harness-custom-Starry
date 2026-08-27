/**
 * The "定义模式 / Define mode" dialog: given a per-agent chat about to start,
 * the human names a working environment and ticks the capability groups it
 * needs. The Host composes a strict subset of the `standard` preset — loading
 * only the tools that environment requires, rather than everything — and binds
 * it to the session.
 *
 * Rendering is intentionally simple (inline styles) so the hero chip works
 * before a richer chrome lands, mirroring the memory dialog. The capability
 * group names/descriptions are localized on the Web by group id, with the
 * Host palette's English text as the fallback.
 */

import { useEffect, useState } from 'react'
import { capabilityDisplayText } from './locales.ts'
import type { AgentPresetSettingsKey } from './locales.ts'
import type { EnvironmentCapability } from './seat-store.ts'

/** Dialog props: the environment verbs plus the active Web locale. */
export interface DefineEnvironmentDialogProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** Ask the dialog to close (a Cancel, or a successful compose). */
  onClose: () => void
  /** Read the toggleable capability palette. */
  loadCapabilities: () => Promise<EnvironmentCapability[]>
  /** Compose a per-agent environment and bind it to the blank session. */
  defineEnvironment: (name: string, description: string, groups: readonly string[]) => Promise<string | undefined>
  /** Model-backed capability suggestion for a written description. */
  suggestEnvironment: (description: string) => Promise<string[]>
  /** Active Web locale lookup. */
  t: (key: AgentPresetSettingsKey) => string
}

/**
 * A small, deterministic domain-keyword → capability suggestion, so typing a
 * natural-language description (e.g. "开发游戏环境 / game development")
 * pre-checks the groups that domain usually needs. The checkbox list stays the
 * final authority — a suggestion only pre-fills what the human can uncheck.
 */
const KEYWORD_GROUPS: Readonly<Record<string, readonly string[]>> = {
  // English
  game: ['shell', 'files', 'file-search', 'skills', 'web', 'browser'],
  web: ['web', 'browser', 'skills'],
  data: ['web', 'files', 'file-search', 'skills'],
  agent: ['goals', 'subagents', 'workflows', 'plan'],
  workflow: ['workflows', 'compaction'],
  research: ['web', 'skills'],
  // Simplified Chinese
  '游戏': ['shell', 'files', 'file-search', 'skills', 'web', 'browser'],
  '网页': ['web', 'browser'],
  '数据': ['web', 'files', 'file-search', 'skills'],
  '开发': ['shell', 'files'],
  '代理': ['goals', 'subagents', 'workflows', 'plan'],
  '工作流': ['workflows', 'compaction'],
  '研究': ['web', 'skills'],
  '检索': ['web', 'skills'],
}

/**
 * The capability group ids to suggest for a description.
 * @param text - the environment description (name or note).
 * @returns the group ids the description's keywords imply.
 */
function suggestGroups(text: string): string[] {
  const lower = text.toLowerCase()
  const ids = new Set<string>()
  for (const [keyword, groups] of Object.entries(KEYWORD_GROUPS)) {
    if (lower.includes(keyword.toLowerCase())) for (const id of groups) ids.add(id)
  }
  return [...ids]
}

/** Dialog chrome: a dim overlay, a centered card, a capability list. */
export function DefineEnvironmentDialog({
  open, onClose, loadCapabilities, defineEnvironment, suggestEnvironment, t,
}: DefineEnvironmentDialogProps) {
  const [groups, setGroups] = useState<EnvironmentCapability[]>([])
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(new Set())
  const [manual, setManual] = useState<ReadonlySet<string>>(new Set())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  // Re-open resets the draft from the palette: the mode pick is pre-session,
  // so nothing about the previous environment should leak into the next one.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setBusy(false)
    void loadCapabilities()
      .then((list) => {
        if (cancelled) return
        setGroups(list)
        setManual(new Set())
        setEnabled(new Set(list.filter(group => group.defaultEnabled).map(group => group.id)))
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => { cancelled = true }
  }, [open, loadCapabilities])

  /**
   * Reconcile the checked set with a suggestion: the defaults plus any group a
   * description keyword implies, except where the human has made a manual
   * choice (those keep their current state).
   */
  const reconcile = (desc: string, current: ReadonlySet<string>, chosen: ReadonlySet<string>): Set<string> => {
    const next = new Set(current)
    for (const id of suggestGroups(desc)) next.add(id)
    for (const id of chosen) {
      if (current.has(id)) next.add(id)
      else next.delete(id)
    }
    return next
  }

  const onDescriptionChange = (text: string): void => {
    setDescription(text)
    setEnabled(reconcile(text, enabled, manual))
  }

  const toggle = (id: string): void => {
    const next = new Set(enabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setEnabled(next)
    const nextManual = new Set(manual)
    nextManual.add(id)
    setManual(nextManual)
  }

  /** Ask the deployment to model-analyze the description and pre-check the
   *  capability groups it recommends. The result merges the default set, and
   *  the human still owns the final tick (adjust and re-tick as needed). */
  const analyze = async (): Promise<void> => {
    if (analyzing || busy) return
    const desc = description.trim()
    if (desc === '') {
      setError(t('defineAnalyzeEmpty'))
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const suggested = await suggestEnvironment(desc)
      if (suggested.length === 0) {
        setError(t('defineFailed'))
        return
      }
      setEnabled(new Set(suggested))
      setManual(new Set())
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setAnalyzing(false)
    }
  }

  const submit = async (): Promise<void> => {
    if (busy) return
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError(t('defineNameRequired'))
      return
    }
    if (enabled.size === 0) {
      setError(t('defineEmptyGroups'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const combinedId = await defineEnvironment(trimmedName, description.trim(), [...enabled])
      // undefined means the apply was refused or no pending agent; the chip
      // already surfaced the reason, so the dialog simply reports failure.
      if (combinedId === undefined) setError(t('defineFailed'))
      else onClose()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'var(--dsw-alias-bg-mask-1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const card: React.CSSProperties = {
    width: 'min(560px, 92vw)', maxHeight: 'min(640px, 86vh)',
    background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 16,
    boxShadow: 'var(--dsw-shadow-lv3)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const head: React.CSSProperties = { padding: '16px 20px 8px' }
  const title: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary)' }
  const subtitle: React.CSSProperties = { fontSize: 13, margin: '6px 0 0', color: 'var(--dsw-alias-label-secondary)' }
  const body: React.CSSProperties = {
    flex: 1, overflowY: 'auto', padding: '4px 20px',
    display: 'flex', flexDirection: 'column', gap: 12,
  }
  const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, margin: 0 }
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, fontSize: 14,
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l2)',
  }
  const list: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6,
  }
  const row: React.CSSProperties = {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    alignItems: 'flex-start', cursor: 'pointer',
  }
  const rowEnabled: React.CSSProperties = {
    ...row, background: 'var(--dsw-alias-interactive-bg-hover)',
  }
  const groupName: React.CSSProperties = { fontSize: 14, fontWeight: 600 }
  const groupDesc: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' }
  const footer: React.CSSProperties = {
    display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
    padding: '12px 20px', borderTop: '1px solid var(--dsw-alias-border-l2)',
  }
  const errorText: React.CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)', marginRight: 'auto' }
  const primary: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
    background: 'var(--dsw-alias-button-primary-fill)', color: 'var(--dsw-alias-label-primary-foreground)', fontSize: 14,
  }
  const secondary: React.CSSProperties = {
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '8px 18px',
    cursor: 'pointer', background: 'transparent', fontSize: 14, color: 'var(--dsw-alias-label-primary)',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(event) => { event.stopPropagation() }}>
        <div style={head}>
          <h2 style={title}>{t('defineModeName')}</h2>
          <p style={subtitle}>{t('defineModeDescription')}</p>
        </div>
        <div style={body}>
          <div>
            <p style={fieldLabel}>{t('defineNameLabel')}</p>
            <input
              style={input}
              value={name}
              placeholder={t('defineNamePlaceholder')}
              onChange={(event) => { setName(event.target.value) }}
            />
          </div>
          <div>
            <p style={fieldLabel}>{t('defineDescriptionLabel')}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...input, flex: 1, width: 'auto' }}
                value={description}
                placeholder={t('defineDescriptionPlaceholder')}
                onChange={(event) => { onDescriptionChange(event.target.value) }}
              />
              <button
                type="button"
                style={secondary}
                disabled={analyzing || busy}
                onClick={() => { void analyze() }}
              >
                {analyzing ? t('defineAnalyzing') : t('defineAnalyze')}
              </button>
            </div>
          </div>
          <div>
            <p style={fieldLabel}>{t('defineGroupIntro')}</p>
            <div style={list}>
              {groups.map((group) => {
                const active = enabled.has(group.id)
                const text = capabilityDisplayText(group, t)
                return (
                  <label key={group.id} style={active ? rowEnabled : row}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => { toggle(group.id) }}
                      style={{ accentColor: 'var(--dsw-alias-label-secondary)' }}
                    />
                    <span>
                      <span style={groupName}>{text.name}</span>
                      <span style={groupDesc}>{text.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        <div style={footer}>
          {error !== null && <span style={errorText}>{error}</span>}
          <button type="button" style={secondary} onClick={onClose}>{t('cancel')}</button>
          <button type="button" style={primary} disabled={busy} onClick={() => { void submit() }}>
            {busy ? t('defineCreating') : t('defineCreate')}
          </button>
        </div>
      </div>
    </div>
  )
}
