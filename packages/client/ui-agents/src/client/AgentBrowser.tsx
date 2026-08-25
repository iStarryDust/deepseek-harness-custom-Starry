/**
 * The sidebar's agent browsing region, three surfaces:
 *
 * - roster — the default page: a collapsible "My Agents" list (no add
 *   button; creation lives on the shell's primary control), with the blank
 *   conversation gate on the right.
 * - agent — inside one agent: its name and actions (new chat / profile)
 *   above its chat history (sessions composed onto that agent), with the real
 *   conversation on the right.
 * - create / edit — the identity forms.
 *
 * Registered into the shell's `sidebar.workspaces` hole at a lower priority
 * than the workspace browser, so the agent surface shadows it.
 */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button, Menu, Modal, IconArchiveOutline20, IconEditOutline16, IconEllipsisOutline16, IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-sidebar SlotMap merge (the 'sidebar.workspaces'
// entry and its owner props) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { AgentForm } from './AgentForm.tsx'
import type { AgentFormInput } from './stores.ts'
import type { AgentBrowserState, AgentSessionEntry } from './stores.ts'
import type { AgentsKey } from './locales.ts'
import css from './AgentBrowser.module.css'

/** Registration-side business face for the agent browser. */
export interface AgentBrowserInjected {
  hooks: {
    /** Browser snapshot bound by the renderer as useAgents. */
    agents: SnapshotStore<AgentBrowserState>
    /** Registry-global archive set: archived sessions hide from every agent's history. */
    archived: SnapshotStore<readonly SessionId[]>
  }
  /** Read the roster. */
  load: () => Promise<void>
  /** Enter one agent's page. */
  selectAgent: (id: string) => void
  /** Return to the roster page. */
  back: () => void
  /** Start a new chat with one agent; resolves to a failure message when the chat could not start. */
  startChat: (id: string) => Promise<string | undefined>
  /** Open one chat from the agent's history. */
  openSession: (sessionId: string) => void
  /** Open one agent's profile for editing. */
  openProfile: (id: string) => Promise<void>
  /** Open one agent's memory editor. */
  openMemory: (id: string) => Promise<void>
  /** Update the memory editor draft. */
  setMemoryText: (text: string) => void
  /** Save the memory editor draft; resolves to a failure message. */
  saveMemory: () => Promise<string | undefined>
  /** Return from the memory editor to the agent page. */
  backFromMemory: () => void
  /** Toggle the roster list's collapsed state. */
  toggleCollapsed: () => void
  /** Create an agent from the form; resolves to a failure message. */
  create: (input: AgentFormInput) => Promise<string | undefined>
  /** Save a profile edit; resolves to a failure message. */
  saveEdit: (id: string, input: AgentFormInput) => Promise<string | undefined>
  /** Delete an agent; resolves to a failure message. */
  remove: (id: string) => Promise<string | undefined>
  /** Rename one chat's durable title. */
  renameSession: (sessionId: string, title: string) => Promise<void>
  /** Archive one chat (hide from every list; the log stays). */
  archiveSession: (sessionId: string) => Promise<void>
  /** Delete one chat for good (durable artifacts removed). */
  removeSession: (sessionId: string) => Promise<void>
}

/** Full component props. */
export type AgentBrowserProps =
  PropsRuntime<'sidebar.workspaces'>
  & PropsLocale<'agents'>
  & InjectFace<AgentBrowserInjected>

/** One list row's class pair, so the row can stay a single element. */
function rowClass(active: boolean): string {
  return clsx(css.row, active && css.active)
}

/**
 * Render the agent browsing region.
 * @param props - composed slot props.
 * @returns the agent surface for the current view.
 */
export function AgentBrowser({
  useAgents, useSessions, useArchived, load, selectAgent, back, startChat, openSession,
  openProfile, openMemory, setMemoryText, saveMemory, backFromMemory, toggleCollapsed, create,
  saveEdit, remove, renameSession, archiveSession,
  removeSession, t,
}: AgentBrowserProps) {
  const state = useAgents(snapshot => snapshot)
  // The full session snapshot, not a filtered selector: a uSES selector is
  // re-run only when its source changes, so a selector closing over the
  // current selection would keep showing the previous agent's chats when the
  // selection moves but the session list does not. Reading the whole snapshot
  // and filtering in-render keeps the list keyed to the live selection.
  const sessionSnapshot = useSessions(snapshot => snapshot)
  const archivedSet = new Set(useArchived(snapshot => snapshot))
  const sessions = agentChats(sessionSnapshot, state.selected, archivedSet) as AgentSessionEntry[]

  useEffect(() => {
    void load()
  }, [load])

  // Chat row actions: the three-dot menu, plus the rename / delete dialogs.
  // Hooks run unconditionally above every view branch (React rules); the
  // dialogs themselves render only on the agent page, where rows exist.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ sessionId: string; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const composingRef = useRef(false)
  const renameTrimmed = renameDraft.trim()
  const renameBlocked = renaming || renameTrimmed === '' || renameTarget === null
  const closeRename = () => {
    if (renaming) return
    setRenameTarget(null)
    setRenameError(null)
  }
  const confirmRename = () => {
    if (renameBlocked || renameTarget === null) return
    setRenaming(true)
    setRenameError(null)
    renameSession(renameTarget.sessionId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onRename = (sessionId: string, currentTitle: string) => {
    setRenameTarget({ sessionId, currentTitle })
    setRenameDraft(currentTitle)
    setRenameError(null)
  }

  const [deleteTarget, setDeleteTarget] = useState<{ sessionId: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }
  const confirmDelete = () => {
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteError(null)
    removeSession(deleteTarget.sessionId).then(() => {
      setDeleting(false)
      setDeleteTarget(null)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return <div className={css.centered}>{t('agents.loading')}</div>
  }
  if (state.status === 'error') {
    return (
      <div className={css.centered}>
        <div className={css.error}>{state.error ?? t('error.loadFailed')}</div>
        <button type="button" className={css.retry} onClick={() => { void load() }}>
          {t('agents.back')}
        </button>
      </div>
    )
  }

  if (state.view === 'create') {
    return (
      <AgentForm
        mode="create"
        initial={null}
        busy={state.busy}
        error={state.error}
        t={t}
        onSubmit={(input) => { void create(input) }}
        onCancel={back}
        onDelete={undefined}
      />
    )
  }

  if (state.view === 'edit' && state.selected !== '') {
    return (
      <AgentForm
        mode="edit"
        initial={state.profile}
        busy={state.busy}
        error={state.error}
        t={t}
        onSubmit={(input) => { void saveEdit(state.selected, input) }}
        onCancel={back}
        onDelete={() => { void remove(state.selected) }}
      />
    )
  }

  // The agent-memory editor: a plain document edit over the agent's own store.
  if (state.view === 'memory' && state.selected !== '') {
    const saving = state.memoryState === 'saving'
    return (
      <div className={css.memoryView}>
        <div className={css.memoryHeader}>
          <button
            type="button"
            className={css.backLink}
            onClick={backFromMemory}
          >
            {t('agents.back')}
          </button>
          <span className={css.memoryTitle}>{t('agents.memory')}</span>
        </div>
        {state.error !== null && <div className={css.error} role="alert">{state.error}</div>}
        <p className={css.memoryHint}>{t('agents.memory.hint')}</p>
        <textarea
          className={css.memoryTextarea}
          value={state.memoryText}
          disabled={saving}
          onChange={(event) => { setMemoryText(event.target.value) }}
          spellCheck={false}
        />
        <div className={css.memoryFooter}>
          <button
            type="button"
            className={css.action}
            disabled={saving}
            onClick={() => { void saveMemory() }}
          >
            {saving ? t('agents.memory.saving') : t('agents.memory.save')}
          </button>
          {state.memoryState === 'saved' && <span className={css.memorySaved}>{t('agents.memory.saved')}</span>}
          {state.memoryState === 'failed' && <span className={css.error}>{t('agents.memory.saveFailed')}</span>}
        </div>
      </div>
    )
  }

  // The agent page: the selected agent's actions over its chat history.
  if (state.view === 'agent' && state.selected !== '') {
    const selected = state.selected
    const name = state.agents.find(agent => agent.id === selected)?.name ?? selected
    return (
      <div className={css.root}>
        <div className={css.selectedArea}>
          <div className={css.selectedName} title={name}>{name}</div>
          <div className={css.selectedActions}>
            <button
              type="button"
              className={css.action}
              onClick={() => { void startChat(selected) }}
            >
              {t('agents.newChat')}
            </button>
            <button
              type="button"
              className={css.action}
              onClick={() => { void openProfile(selected) }}
            >
              {t('agents.profile')}
            </button>
          </div>
          <div className={css.selectedActions}>
            <button
              type="button"
              className={css.action}
              onClick={() => { void openMemory(selected) }}
            >
              {t('agents.memory')}
            </button>
          </div>
          {/* A local key translates; a raw wire message (not a key) falls back to itself. */}
          {state.error !== null && <div className={css.error} role="alert">{t(state.error as AgentsKey)}</div>}
        </div>

        <div className={css.sectionHeader}>
          <span className={css.sectionLabel}>{t('agents.chatHistory')}</span>
        </div>

        {sessions.length === 0 && (
          <div className={css.empty}>{t('agents.chatHistory.empty')}</div>
        )}

        <ul className={css.list}>
          {sessions.map(session => (
            <li key={session.id}>
              <div className={clsx(css.chatRow, session.current && css.active)}>
                <button
                  type="button"
                  className={css.chatRowOpen}
                  onClick={() => { openSession(session.id) }}
                >
                  <span className={css.rowName}>{session.title}</span>
                </button>
                <Menu
                  open={menuOpenId === session.id}
                  onClose={() => { setMenuOpenId(null) }}
                  items={[
                    { id: 'rename', label: t('chat.menu.rename'), icon: <IconEditOutline16 /> },
                    { id: 'archive', label: t('chat.menu.archive'), icon: <IconArchiveOutline20 size={16} /> },
                    { id: 'delete', label: t('chat.menu.delete'), icon: <IconTrashOutline16 /> },
                  ]}
                  onSelect={(id) => {
                    setMenuOpenId(null)
                    if (id === 'rename') onRename(session.id, session.title)
                    if (id === 'archive') {
                      archiveSession(session.id).catch((reason: unknown) => {
                        console.warn('session archive rejected:', reason)
                      })
                    }
                    if (id === 'delete') {
                      setDeleteTarget({ sessionId: session.id, title: session.title })
                      setDeleteError(null)
                    }
                  }}
                  portal
                  closeOnPointerLeave
                  anchor={(
                    <button
                      type="button"
                      className={css.chatRowMenu}
                      aria-label={t('chat.menu.rename')}
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(v => v === session.id ? null : session.id) }}
                    >
                      <IconEllipsisOutline16 />
                    </button>
                  )}
                />
              </div>
            </li>
          ))}
        </ul>

        <Modal
          open={renameTarget !== null}
          onClose={closeRename}
          closeLabel={t('close')}
          title={t('chat.rename.title')}
          footer={(
            <>
              <Button variant="outline" disabled={renaming} onClick={closeRename}>{t('cancel')}</Button>
              <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('chat.menu.rename')}</Button>
            </>
          )}
        >
          <input
            className={css.renameInput}
            value={renameDraft}
            aria-label={t('chat.rename.field')}
            autoFocus
            disabled={renaming}
            onFocus={(e) => { e.target.select() }}
            onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null) }}
            onCompositionStart={() => { composingRef.current = true }}
            onCompositionEnd={() => { composingRef.current = false }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !composingRef.current) {
                e.preventDefault()
                confirmRename()
              }
            }}
          />
          {renameError !== null && <div className={css.dialogError} role="alert">{renameError}</div>}
        </Modal>
        <Modal
          open={deleteTarget !== null}
          onClose={closeDelete}
          closeLabel={t('close')}
          title={t('chat.delete.title')}
          {...deleteTarget === null
            ? {}
            : { description: t('chat.delete.desc') }}
          footer={(
            <>
              <Button variant="outline" disabled={deleting} onClick={closeDelete}>{t('cancel')}</Button>
              <Button
                variant="outline"
                className={css.deleteAction}
                disabled={deleting}
                onClick={confirmDelete}
              >
                {t('chat.delete.confirm')}
              </Button>
            </>
          )}
        >
          {deleteError !== null && <div className={css.dialogError} role="alert">{deleteError}</div>}
        </Modal>
      </div>
    )
  }

  // The roster page: collapsible list (creation is the shell's primary control).
  return (
    <div className={css.root}>
      <div className={css.sectionHeader}>
        <button
          type="button"
          className={css.collapsibleTitle}
          onClick={toggleCollapsed}
          aria-expanded={!state.collapsed}
        >
          <span className={clsx(css.chevron, state.collapsed && css.chevronClosed)}>▸</span>
          <span className={css.sectionLabel}>{t('agents.title')}</span>
        </button>
      </div>

      {state.agents.length === 0 && (
        <div className={css.empty}>{t('agents.empty')}</div>
      )}

      {!state.collapsed && (
        <ul className={css.list}>
          {state.agents.map(agent => (
            <li key={agent.id}>
              <button
                type="button"
                className={rowClass(agent.id === state.selected)}
                onClick={() => { selectAgent(agent.id) }}
              >
                <span className={css.rowName}>{agent.name}</span>
                {agent.description !== undefined && (
                  <span className={css.rowDescription}>{agent.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One agent's own chats from a session-list snapshot: sessions whose recorded
 * preset is the agent's (its combined presets included) — nothing else — so
 * every agent's history is exclusive to it. Archived sessions are excluded:
 * the archive set is registry-global, and a session belongs to its agent
 * through its bound preset, so archiving one chat hides it from exactly the
 * agent it belongs to. Newest first, by the session's last-activity time.
 * Subagent children are hidden, matching the workspace tree.
 * @param state - the sessions snapshot.
 * @param selected - the agent id.
 * @param archived - the registry-global archive set.
 * @returns the agent's session rows, newest first.
 */
function agentChats(
  state: {
    byId: Record<string, { agentPreset?: string; title?: string; origin?: string; updatedAt?: number }>
    current?: unknown
  },
  selected: string,
  archived: Set<string>,
): AgentSessionEntry[] {
  const rows: AgentSessionEntry[] = []
  for (const [id, summary] of Object.entries(state.byId)) {
    if (summary.origin === 'subagent') continue
    if (archived.has(id)) continue
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
