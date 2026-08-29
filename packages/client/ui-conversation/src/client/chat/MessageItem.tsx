// MessageItem: simple chat nodes — user and consumed-steering bubbles
// (right-aligned, with clock + copy IconActions; branch lives only under
// assistant answers), pending steering (copy only), context injection,
// compaction marker, retry disclosure, and unknown-surface JSON rows.

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from 'react'
import type {
  ModelRetryNode, TurnErrorNode, UserMessageNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  IconCloseOutline16, IconPlusOutline16, IconSendOutline16, JsonBlock, MessageText, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ChatEditImageTools, ChatNodeOwnerProps, ChatNodeViewProps, ChatViewSlotProps, ComposerAttachment,
} from '../contract/slots.ts'
import { ReferenceIcon } from '../reference/ReferenceIcon.tsx'
import { CompactionItem } from './CompactionItem.tsx'
import { ContextInjectionRow } from './ContextInjectionRow.tsx'
import { MessageIconActions } from './MessageIconActions.tsx'
import css from './MessageItem.module.css'

type UserImage = Extract<UserMessageNode['content'][number], { type: 'image' }>

function contentParts(content: readonly unknown[]): {
  text: string
  images: { attachment: UserImage['attachment'] }[]
  rest: unknown[]
} {
  const texts: string[] = []
  const images: { attachment: UserImage['attachment'] }[] = []
  const rest: unknown[] = []
  for (const block of content) {
    const b = block as { type?: string; text?: string; attachment?: unknown }
    if (b.type === 'text' && typeof b.text === 'string') texts.push(b.text)
    else if (b.type === 'image' && b.attachment !== undefined) {
      images.push({ attachment: (b as UserImage).attachment })
    }
    else rest.push(block)
  }
  return { text: texts.join(''), images, rest }
}

function retrySeconds(milliseconds: number): number {
  return Math.max(1, Math.ceil(milliseconds / 1_000))
}

interface RetryCountdown {
  deadline: number
  seconds: number
}

function ModelRetryItem({ node, active, t }: {
  node: ModelRetryNode
  active: boolean
  t: ChatViewSlotProps['t']
}) {
  // Anchor the host-scheduled delay to this browser's first render of the
  // retry node. Host event time and Date.now() may belong to different clocks.
  const deadline = useMemo(() => Date.now() + node.delayMs, [node.delayMs, node.seq])
  const scheduledSeconds = retrySeconds(node.delayMs)
  const maximum = node.mode === 'normal' ? node.maxRetries : '∞'
  const [countdown, setCountdown] = useState<RetryCountdown>(() => ({
    deadline,
    seconds: retrySeconds(deadline - Date.now()),
  }))
  const remainingSeconds = countdown.deadline === deadline
    ? countdown.seconds
    : retrySeconds(deadline - Date.now())

  useEffect(() => {
    if (!active) return
    const updateCountdown = (): number => {
      const next = retrySeconds(deadline - Date.now())
      setCountdown(current => (
        current.deadline === deadline && current.seconds === next
          ? current
          : { deadline, seconds: next }
      ))
      return next
    }
    if (updateCountdown() === 1) return
    const timer = window.setInterval(() => {
      if (updateCountdown() === 1) window.clearInterval(timer)
    }, 250)
    return () => { window.clearInterval(timer) }
  }, [active, deadline])

  const label = active
    ? t('message.retry.active')
    : node.retryState === 'cancelled'
      ? t('message.retry.cancelled')
      : node.retryState === 'started'
        ? t('message.retry.started')
        : t('message.retry.scheduled')
  const seconds = active ? remainingSeconds : scheduledSeconds

  return (
    <details className={css.retryRow} data-active={active || undefined}>
      <summary className={css.retrySummary}>
        <span className={css.retryText} role="status">
          {t('message.retry.status', { label, retry: node.retry, maximum, seconds })}
        </span>
      </summary>
      <div className={css.retryDetails}>
        <div>
          <span className={css.retryDetailLabel}>{t('message.retry.delay')}</span>
          {Math.round(node.delayMs)}ms
        </div>
        <div>
          <span className={css.retryDetailLabel}>{t('message.retry.failure')}</span>
          {node.failure.message}
        </div>
      </div>
    </details>
  )
}

/** Persistent, turn-positioned feedback for a terminal failure. */
function TurnErrorItem({ node, t }: {
  node: TurnErrorNode
  t: ChatViewSlotProps['t']
}) {
  return (
    <div className={css.turnErrorRow} role="status">
      <StateDot state="error" className={css.turnErrorDot} />
      <div className={css.turnErrorCopy}>
        <span className={css.turnErrorTitle}>{t('message.turnError')}</span>
        <span className={css.turnErrorMessage}>{node.message}</span>
      </div>
      {node.code !== undefined && <code className={css.turnErrorCode}>{node.code}</code>}
    </div>
  )
}

/** Persistent, turn-positioned notice for a turn ended at the output-token cap. */
function TurnMaxTokensItem({ t }: {
  t: ChatViewSlotProps['t']
}) {
  return (
    <div className={css.turnErrorRow} role="status">
      <StateDot state="warning" className={css.turnErrorDot} />
      <div className={css.turnErrorCopy}>
        <span className={css.maxTokensTitle}>{t('message.maxTokens')}</span>
        <span className={css.turnErrorMessage}>{t('message.maxTokens.hint')}</span>
      </div>
    </div>
  )
}

/**
 * Display projection of reference forms in a user bubble (free geometry — no
 * textarea alignment constraint here); everything else stays plain text. The
 * logged model text remains the single truth; this is presentation only.
 * Plain-text `/name` / `@name` word-boundary tokens decorate (the sent text
 * IS the reference — the bubble uses the same plainest token
 * scan as the composer, minus the lexicon: sent tokens were validated at
 * compose time, so shape alone decorates).
 */
function projectUserText(text: string, sessionLabels: readonly string[]): ReactNode {
  const ranges: { start: number; end: number; label: string; kind: 'session' | 'plain' }[] = []
  for (const rawLabel of [...new Set(sessionLabels)].sort((a, b) => b.length - a.length)) {
    const label = `@${rawLabel}`
    let start = text.indexOf(label)
    while (start >= 0) {
      ranges.push({ start, end: start + label.length, label, kind: 'session' })
      start = text.indexOf(label, start + label.length)
    }
  }
  const re = /(^|\s)(\/[\w-]+|@"[^"\n]+"|@[^\s]+)/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const tokenStart = m.index + (m[1]?.length ?? 0)
    const rawLabel = m[2] ?? ''
    const label = rawLabel.startsWith('@"')
      ? rawLabel
      : rawLabel.replace(/[.,;:!?，。；：！？]+$/gu, '')
    if (label.length <= 1) continue
    ranges.push({ start: tokenStart, end: tokenStart + label.length, label, kind: 'plain' })
  }
  ranges.sort((a, b) => a.start - b.start
    || (a.kind === b.kind ? b.end - a.end : a.kind === 'session' ? -1 : 1))
  const parts: ReactNode[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start < cursor) continue
    const { start: tokenStart, end, label, kind } = range
    if (tokenStart > cursor) parts.push(<MessageText key={cursor} text={text.slice(cursor, tokenStart)} />)
    const referenceKind = kind === 'session'
      ? 'session'
      : label.startsWith('@')
        ? label.endsWith('/') ? 'folder' : 'file'
        : undefined
    const displayLabel = referenceKind === undefined
      ? label
      : referenceKind === 'session'
        ? label.slice(1)
        : label.slice(1).replace(/^"|"$/gu, '').split(/[\\/]/u).filter(Boolean).at(-1) ?? label.slice(1)
    parts.push(
      <span
        key={tokenStart}
        className={css.refChip}
        data-ref-chip={referenceKind ?? 'skill'}
        title={label}
      >
        {referenceKind !== undefined && (
          <ReferenceIcon kind={referenceKind} size={16} className={css.refIcon} />
        )}
        {displayLabel}
      </span>,
    )
    cursor = end
  }
  if (parts.length === 0) return <MessageText text={text} />
  if (cursor < text.length) parts.push(<MessageText key={cursor} text={text.slice(cursor)} />)
  return <>{parts}</>
}

/** Right-aligned bubble shared by user and steering rows. */
function UserStyleBubble({
  content, renderMessageImages, actions, pending = false, referenceLabels = [], t,
}: {
  content: readonly unknown[]
  renderMessageImages: ChatNodeOwnerProps['renderMessageImages']
  /** Optional IconActions (or similar) below the bubble; receives the joined text. */
  actions?: (text: string) => ReactNode
  /** Whether this is the Host-authoritative pre-admission steering projection. */
  pending?: boolean
  /** Exact session mention labels associated by the adjacent recall node. */
  referenceLabels?: readonly string[]
  t: ChatViewSlotProps['t']
}): ReactNode {
  const { text, images, rest } = contentParts(content)
  const truncated = (total: number): string => t('json.truncated', { total })
  const showBubble = text !== '' || rest.length > 0
  return (
    <div className={css.userRow} data-pending-steering={pending || undefined} data-time-hover-root>
      <div className={css.userStack}>
        {renderMessageImages({ images, align: 'end' })}
        {showBubble && <div className={css.bubble}>
          {projectUserText(text, referenceLabels)}
          {rest.map((block, i) => <JsonBlock key={i} label={t('message.extraBlock')} payload={block} truncatedLabel={truncated} />)}
        </div>}
        {referenceLabels.length > 0 && (
          <div className={css.referenceSummary}>
            {t('message.referenceSummary', { labels: referenceLabels.join(t('message.referenceSeparator')) })}
          </div>
        )}
      </div>
      {actions?.(text)}
    </div>
  )
}

/**
 * Render one Host-authoritative pending steering item with the same visual
 * language as its eventual durable transcript node.
 * @param props - Pending message content and conversation translator.
 * @returns the pending steering bubble.
 */
export function PendingSteeringBubble({ content, renderMessageImages, t }: {
  content: readonly unknown[]
  renderMessageImages: ChatNodeOwnerProps['renderMessageImages']
  t: ChatViewSlotProps['t']
}): ReactNode {
  return (
    <UserStyleBubble
      content={content}
      renderMessageImages={renderMessageImages}
      pending
      t={t}
      actions={text => (
        <MessageIconActions
          text={text}
          clock="start"
          className={css.actions}
          t={t}
        />
      )}
    />
  )
}

/** One image row in the inline editor's managed strip. */
type EditImage =
  | { readonly key: string; readonly kind: 'kept'; readonly attachment: UserImage['attachment'] }
  | { readonly key: string; readonly kind: 'draft'; readonly attachment: ComposerAttachment }

/**
 * Inline edit-and-regenerate editor for one durable user message: the bubble
 * swaps for an auto-sized textarea above a managed image strip — every
 * original image stays removable, picked or dropped files append as drafts
 * (the composer's pipeline), and confirm hands the surviving set to the
 * owner-provided {@link ChatNodeOwnerProps.rewriteFrom}. Failure keeps the
 * editor open with the reason; success unmounts with the session switch.
 */
function UserMessageEditor({
  seq, content, keptImages, editImageTools, rewriteFrom, onCancel, t,
}: {
  /** The `user/message` event seq the rewrite anchors on. */
  seq: number
  /** Complete durable content blocks (text and everything else). */
  content: readonly unknown[]
  keptImages: readonly UserImage['attachment'][]
  editImageTools: ChatEditImageTools
  rewriteFrom: ChatNodeOwnerProps['rewriteFrom']
  onCancel: () => void
  t: ChatViewSlotProps['t']
}): ReactNode {
  const initial = useMemo(() => contentParts(content).text, [content])
  const [editImages, setEditImages] = useState<EditImage[]>(
    () => keptImages.map(image => ({ key: image.attachmentId, kind: 'kept' as const, attachment: image })),
  )
  const [keptUrls, setKeptUrls] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState(initial)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  // The inject layer rebuilds these callbacks every render; refs keep the
  // unmount cleanup and the URL loader stable without effect-dependency churn.
  const toolsRef = useRef(editImageTools)
  const draftsRef = useRef<ComposerAttachment[]>([])
  const requestedKeptRef = useRef(new Set<string>())
  useEffect(() => {
    toolsRef.current = editImageTools
    draftsRef.current = editImages.filter((item): item is Extract<EditImage, { kind: 'draft' }> => item.kind === 'draft')
      .map(item => item.attachment)
  })
  // Focus with the caret at the end on open: the common edit touches the tail.
  useEffect(() => {
    const el = editorRef.current
    if (el === null) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [])
  // Resolve each kept image's session-authorized URL exactly once.
  useEffect(() => {
    for (const item of editImages) {
      if (item.kind !== 'kept' || requestedKeptRef.current.has(item.key)) continue
      requestedKeptRef.current.add(item.key)
      void toolsRef.current.resolveKept(item.attachment).then(
        (url) => { setKeptUrls(current => ({ ...current, [item.key]: url })) },
        () => { setKeptUrls(current => ({ ...current, [item.key]: '' })) },
      )
    }
  }, [editImages])
  // Drafts the editor created die with the editor: release previews whether
  // the user cancels, the submit succeeds, or the tree unmounts underneath.
  useEffect(() => () => {
    toolsRef.current.releaseDrafts(draftsRef.current)
  }, [])
  const rows = Math.min(12, Math.max(2, draft.split('\n').length))
  const removeImage = (key: string): void => {
    setEditImages(current => current.filter(item => item.key !== key))
  }
  const addFiles = (files: readonly File[]): void => {
    if (files.length === 0) return
    const result = toolsRef.current.createDraft(files)
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    setNotice(null)
    setEditImages(current => [...current, ...result.attachments.map(attachment => ({
      key: attachment.id, kind: 'draft' as const, attachment,
    }))])
  }
  const onPickFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = [...event.target.files ?? []]
    event.target.value = ''
    addFiles(files)
  }
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const files = [...event.dataTransfer.files]
    if (files.length === 0) return
    event.preventDefault()
    addFiles(files)
  }
  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault()
  }
  const confirm = (): void => {
    if (pending) return
    if (draft.trim() === '' && editImages.length === 0) return
    setPending(true)
    setFailure(null)
    const keptRefs = editImages
      .filter((item): item is Extract<EditImage, { kind: 'kept' }> => item.kind === 'kept')
      .map(item => item.attachment)
    const drafts = editImages
      .filter((item): item is Extract<EditImage, { kind: 'draft' }> => item.kind === 'draft')
      .map(item => item.attachment)
    rewriteFrom(seq, draft, keptRefs, drafts).then(() => {
      // Success flips the view to the forked child; this subtree unmounts.
    }).catch((error: unknown) => {
      setPending(false)
      setFailure(error instanceof Error ? error.message : String(error))
    })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      confirm()
    }
  }
  const truncated = (total: number): string => t('json.truncated', { total })
  return (
    <div className={css.editStack} onDrop={onDrop} onDragOver={onDragOver}>
      {editImages.length > 0 && (
        <div className={css.editImageStrip}>
          {editImages.map((item) => {
            const src = item.kind === 'draft' ? item.attachment.previewUrl : keptUrls[item.key]
            return (
              <div key={item.key} className={css.editImageChip}>
                {src === undefined
                  ? <div className={css.editImageThumb} aria-hidden />
                  : <img className={css.editImageThumb} src={src} alt="" />}
                <button
                  type="button"
                  className={css.editImageRemove}
                  aria-label={t('message.edit.image.remove')}
                  disabled={pending}
                  onClick={() => { removeImage(item.key) }}
                >
                  <IconCloseOutline16 />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <textarea
        ref={editorRef}
        className={css.editArea}
        rows={rows}
        value={draft}
        aria-label={t('message.edit')}
        disabled={pending}
        onChange={(event) => { setDraft(event.target.value) }}
        onKeyDown={onKeyDown}
      />
      {contentParts(content).rest.map((block, i) => (
        <JsonBlock key={i} label={t('message.extraBlock')} payload={block} truncatedLabel={truncated} />
      ))}
      <div className={css.editHint}>{t('message.edit.hint')}</div>
      {notice !== null && <div className={css.editNotice} role="status">{notice}</div>}
      {failure !== null && <div className={css.editFailure} role="alert">{t('message.edit.failed', { reason: failure })}</div>}
      <div className={css.editActions}>
        <label className={css.editImageAdd} aria-label={t('message.edit.image.add')} title={t('message.edit.image.add')}>
          <IconPlusOutline16 />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className={css.editImageInput}
            disabled={pending}
            onChange={onPickFiles}
          />
        </label>
        <button type="button" className={css.editCancel} disabled={pending} onClick={onCancel}>
          {t('message.edit.cancel')}
        </button>
        <button
          type="button"
          className={css.editConfirm}
          disabled={pending || (draft.trim() === '' && editImages.length === 0)}
          onClick={confirm}
        >
          <IconSendOutline16 />
          {t('message.edit.save')}
        </button>
      </div>
    </div>
  )
}

/** User and admitted-steering keyed Chat renderer. */
export const UserMessageNodeView = memo(function UserMessageNodeView({
  node, renderMessageImages, rewriteFrom, editImageTools, useSession, t,
}: ChatNodeViewProps<'user' | 'steering'>) {
  const data = node.data
  const running = useSession(snapshot => snapshot.running)
  const timeline = useSession(snapshot => snapshot.chat.timeline)
  // Same anchoring rule as rewriteFrom: the message must sit inside a turn
  // the loaded window still carries. Compaction can drop a turn's start from
  // the window while the message itself stays visible, and editing such a
  // message can never find its fork boundary.
  const editEnclosed = useMemo(() => {
    const { turnOrder, turns } = timeline
    for (let index = 0; index < turnOrder.length; index++) {
      const turn = turnOrder[index]
      if (turn === undefined) break
      const start = turns.get(turn)?.start?.seq
      if (start === undefined || start > data.seq) break
      return true
    }
    return false
  }, [timeline, data.seq])
  const [editing, setEditing] = useState(false)
  const { images } = useMemo(() => contentParts(data.content), [data.content])
  if (editing) {
    return (
      <div className={css.userRow} data-time-hover-root>
        <UserMessageEditor
          seq={data.seq}
          content={data.content}
          keptImages={images.map(image => image.attachment)}
          editImageTools={editImageTools}
          rewriteFrom={rewriteFrom}
          onCancel={() => { setEditing(false) }}
          t={t}
        />
      </div>
    )
  }
  return (
    <UserStyleBubble
      content={data.content}
      renderMessageImages={renderMessageImages}
      {...data.referenceLabels === undefined ? {} : { referenceLabels: data.referenceLabels }}
      t={t}
      actions={text => (
        <MessageIconActions
          text={text}
          time={data.time}
          clock="start"
          className={css.actions}
          onEdit={data.kind === 'user' ? () => { setEditing(true) } : undefined}
          editUnavailable={running || !editEnclosed}
          editUnavailableReason={running ? undefined : t('message.edit.unavailable.window')}
          t={t}
        />
      )}
    />
  )
})

/** Injected-context keyed Chat renderer. */
export const ContextMessageNodeView = memo(function ContextMessageNodeView({ node, t }: ChatNodeViewProps<'context'>) {
  const data = node.data
  return (
    <ContextInjectionRow
      content={data.content}
      source={data.source}
      provenance={data.provenance}
      form={data.form}
      t={t}
    />
  )
})

/** Automatic compaction keyed Chat renderer. */
export const CompactionNodeView = memo(function CompactionNodeView({ node, t }: ChatNodeViewProps<'compaction'>) {
  return <CompactionItem node={node.data} t={t} />
})

/** Correlated retry-chain keyed Chat renderer. */
export const RetryNodeView = memo(function RetryNodeView({ node, t }: ChatNodeViewProps<'model-retry'>) {
  const data = node.data
  return <ModelRetryItem node={data.current} active={data.current.retryState === 'scheduled'} t={t} />
})

/** Terminal turn-error keyed Chat renderer. */
export const TurnErrorNodeView = memo(function TurnErrorNodeView({ node, t }: ChatNodeViewProps<'turn-error'>) {
  return <TurnErrorItem node={node.data} t={t} />
})

/** Max-tokens turn-end notice keyed Chat renderer. */
export const TurnMaxTokensNodeView = memo(function TurnMaxTokensNodeView({ t }: ChatNodeViewProps<'turn-max-tokens'>) {
  return <TurnMaxTokensItem t={t} />
})

/** Explicit unknown-surface keyed Chat renderer. */
export const UnknownNodeView = memo(function UnknownNodeView({ node, t }: ChatNodeViewProps<'unknown'>) {
  const data = node.data
  return (
    <div className={css.contextRow}>
      <JsonBlock
        label={t('message.unknownSurface', { type: data.type })}
        payload={data.data}
        truncatedLabel={total => t('json.truncated', { total })}
      />
    </div>
  )
})
