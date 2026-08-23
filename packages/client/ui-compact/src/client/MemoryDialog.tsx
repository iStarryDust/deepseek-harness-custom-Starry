/**
 * The memory-selection dialog. It lists the current session's selectable
 * messages (a condensed preview per row), lets the human check the ones worth
 * keeping, and hands the checked text to the host remember path. Rendering is
 * intentionally simple (inline styles) so the seat works before a richer
 * chrome lands; the message list comes from the injected session snapshot.
 */

import { useMemo, useState } from 'react'
import type { SessionId, ConversationSnapshot, UseConversationSession } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'

/** One selectable row: a stable key, the side, a preview, and the raw text. */
export interface MemoryCandidate {
  key: string
  side: 'user' | 'assistant'
  preview: string
  text: string
}

/** Minimal extractor over a settled assistant node's blocks. */
function assistantText(blocks: readonly AssistantBlock[]): string {
  return blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join('')
}

/** Pull the text blocks out of a user/context node's content array. */
function contentText(content: readonly { type: string; text?: string }[]): string {
  return content.flatMap(block => block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('')
}

/** Condense a long message to a short preview line. */
function preview(text: string, limit = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit)}…`
}

/** Chat node kinds that carry durable user/assistant text. */
const USER_KINDS = new Set(['user', 'steering'])
const ASSISTANT_KINDS = new Set(['assistant-step'])

/**
 * Build the selectable candidate list from the session chat snapshot. User and
 * assistant nodes carry durable text; everything else is skipped. Assistant
 * nodes render under the `assistant-step` kind (ui-conversation's renderer
 * registry), not `assistant`.
 */
function candidatesOf(snapshot: ConversationSnapshot | undefined): MemoryCandidate[] {
  if (snapshot === undefined) return []
  const nodes = snapshot.chat.nodes.values()
  const list: MemoryCandidate[] = []
  for (const node of nodes) {
    if (USER_KINDS.has(node.kind)) {
      const data = node.data as { content?: readonly { type: string; text?: string }[]; seq?: number }
      const text = contentText(data.content ?? [])
      if (text.trim() === '') continue
      list.push({ key: node.id, side: 'user', preview: preview(text), text })
    } else if (ASSISTANT_KINDS.has(node.kind)) {
      const data = node.data as { blocks?: readonly AssistantBlock[]; seq?: number; turn?: number; step?: number }
      const text = assistantText(data.blocks ?? [])
      if (text.trim() === '') continue
      list.push({ key: node.id, side: 'assistant', preview: preview(text), text })
    }
  }
  return list
}

/** Memory-dialog props: the runtime session kit plus the remember/close verbs. */
export interface MemoryDialogProps {
  sessionId: SessionId
  useSession: UseConversationSession
  onRemember: (text: string) => Promise<void>
  onClose: () => void
  t: TranslateNS<typeof NS>
}

/** Dialog chrome: a dim overlay, a centered card, and a scrollable message list. */
export function MemoryDialog({
  useSession, onRemember, onClose, t,
}: MemoryDialogProps) {
  const snapshot = useSession(s => s)
  const candidates = useMemo(() => candidatesOf(snapshot), [snapshot])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (key: string): void => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setChecked(next)
  }

  const selectedText = (): string => {
    const rows = candidates.filter(item => checked.has(item.key))
    return rows.map(item => (item.side === 'user' ? t('memory.user') : t('memory.assistant')) + '：' + item.text).join('\n\n')
  }

  const submit = async (): Promise<void> => {
    const text = selectedText()
    if (text.trim() === '' || busy) return
    setBusy(true); setError(null)
    try {
      await onRemember(text)
      onClose()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'var(--dsw-alias-bg-mask-1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const card: React.CSSProperties = {
    width: 'min(560px, 92vw)', maxHeight: 'min(600px, 84vh)',
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-inverted)',
    borderRadius: 16, boxShadow: 'var(--dsw-shadow-lv3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const head: React.CSSProperties = { padding: '16px 20px 8px' }
  const title: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary)' }
  const subtitle: React.CSSProperties = { fontSize: 13, margin: '6px 0 0', color: 'var(--dsw-alias-label-secondary)' }
  const list: React.CSSProperties = {
    flex: 1, overflowY: 'auto', padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: 6,
  }
  const row: React.CSSProperties = {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-primary)',
    alignItems: 'flex-start', cursor: 'pointer',
  }
  const rowChecked: React.CSSProperties = {
    ...row, background: 'var(--dsw-alias-interactive-bg-hover)',
  }
  const sideTag: React.CSSProperties = {
    flexShrink: 0, fontSize: 12, padding: '2px 8px', borderRadius: 6,
    background: 'var(--dsw-alias-label-tertiary)',
    color: 'var(--dsw-alias-label-primary-foreground)',
  }
  const previewText: React.CSSProperties = {
    fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
    color: 'var(--dsw-alias-label-primary)',
  }
  const footer: React.CSSProperties = {
    display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
    padding: '12px 20px', borderTop: '1px solid var(--dsw-alias-border-l2)',
  }
  const errorText: React.CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)', marginRight: 'auto' }
  const primary: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
    fontSize: 14,
  }
  const secondary: React.CSSProperties = {
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '8px 18px',
    cursor: 'pointer', background: 'transparent', fontSize: 14,
    color: 'var(--dsw-alias-label-primary)',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(event) => { event.stopPropagation() }}>
        <div style={head}>
          <h2 style={title}>{t('memory.title')}</h2>
          <p style={subtitle}>{t('memory.subtitle')}</p>
        </div>
        <div style={list}>
          {candidates.length === 0 && <div style={{ ...previewText, opacity: 0.6 }}>{t('memory.empty')}</div>}
          {candidates.map((item) => {
            const active = checked.has(item.key)
            return (
              <label key={item.key} style={active ? rowChecked : row}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => { toggle(item.key) }}
                  style={{ accentColor: 'var(--dsw-alias-label-secondary)' }}
                />
                <span style={sideTag}>{t(item.side === 'user' ? 'memory.user' : 'memory.assistant')}</span>
                <span style={previewText}>{item.preview}</span>
              </label>
            )
          })}
        </div>
        <div style={footer}>
          {error !== null && <span style={errorText}>{error}</span>}
          <button type="button" style={secondary} onClick={onClose}>{t('memory.cancel')}</button>
          <button type="button" style={primary} disabled={busy || checked.size === 0} onClick={() => { void submit() }}>
            {busy ? t('memory.saving') : t('memory.remember')}
          </button>
        </div>
      </div>
    </div>
  )
}
