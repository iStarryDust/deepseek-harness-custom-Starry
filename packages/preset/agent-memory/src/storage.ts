/**
 * Markdown memory stores under the harness home.
 *
 * Layout mirrors `dsh-agent-presets`' ownership pattern: the root is the
 * package's own segment under the harness home (`<dshHome>/agent-memory`),
 * resolved through `dshHomePath` so `$DSH_HOME` overrides and cross-platform
 * homes both land correctly. Global memory lives in `global/`, one agent's
 * memory in `<agentId>/` — all agents share the global file, each agent owns
 * its own directory.
 *
 * File shape: `# <title>` header lines are free text (the user edits them),
 * and every memory entry is one `- [YYYY-MM-DD HH:mm] content` line. The
 * timestamp is the entry's primary metadata: a re-saved entry refreshes its
 * stamp, a re-remembered identical fact refreshes instead of duplicating.
 * Reads and writes are synchronous on purpose: prompt assembly calls the
 * section thunk with no await point, and the files are tiny.
 * @module @deepseek-ai/dsh-agent-memory/storage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

/** Harness-home segment this package owns (sibling of `.agent-presets`). */
export const MEMORY_DIR = 'agent-memory'

/** Directory name for the shared global memory store. */
export const GLOBAL_DIR = 'global'

/** File name of one memory document. */
export const MEMORY_FILE = 'memory.md'

/** One parsed memory entry: its stamp and its content. */
export interface MemoryEntry {
  /** Local `YYYY-MM-DD HH:mm` stamp written when the fact was remembered. */
  readonly stamp: string
  /** The remembered fact, single line by convention but unrestricted in practice. */
  readonly content: string
}

/** Result of one append: what the store now holds. */
export interface MemoryAppendResult {
  /** Whether a payload was appended as a new entry. */
  readonly appended: boolean
  /** Whether an existing entry was refreshed (same fact, new stamp). */
  readonly refreshed: boolean
  /** The entry content the write landed as (deduped form). */
  readonly content: string
}

const ENTRY_RE = /^-?\s*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*(.*)$/

/** Whole-document read of one memory store. */
export interface MemoryDoc {
  /** Raw file text (header lines + entries), empty when the file is absent. */
  readonly text: string
  /** Parsed entries in document order. */
  readonly entries: readonly MemoryEntry[]
}

/** Format the current local time as an entry stamp. */
export function stampNow(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Absolute root of every memory store (`<dshHome>/agent-memory`). */
export function memoryRoot(): string {
  return dshHomePath(MEMORY_DIR)
}

/** Absolute directory of one memory store (global when no agent is named). */
export function memoryDir(agentId?: string): string {
  return join(memoryRoot(), agentId ?? GLOBAL_DIR)
}

/** Guard one write target: an agent named like the global segment would collide. */
function guardAgentId(agentId: string): void {
  if (agentId === GLOBAL_DIR || agentId === '') {
    throw new Error(`agent-memory: ${JSON.stringify(agentId)} is a reserved memory store name`)
  }
}

/** Absolute path of a memory document. */
export function memoryPath(agentId?: string): string {
  return join(memoryDir(agentId), MEMORY_FILE)
}

/** Parse memory entries out of a document body. */
export function parseEntries(text: string): MemoryEntry[] {
  const entries: MemoryEntry[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = ENTRY_RE.exec(line)
    if (match === null) continue
    entries.push({ stamp: match[1] ?? '', content: (match[2] ?? '').trim() })
  }
  return entries
}

/**
 * Read one memory store.
 * @param agentId - the agent id, or `undefined` for the global store.
 * @returns the parsed document (empty on a missing file).
 */
export function readMemory(agentId?: string): MemoryDoc {
  const path = memoryPath(agentId)
  if (!existsSync(path)) return { text: '', entries: [] }
  const text = readFileSync(path, 'utf8')
  return { text, entries: parseEntries(text) }
}

/** Raw full text of one memory store (for the editor save flow). */
export function readMemoryText(agentId?: string): string {
  return readMemory(agentId).text
}

/**
 * Replace one memory store wholesale (the user's editor save).
 * @param text - the complete next document text.
 * @param agentId - the agent id, or `undefined` for the global store.
 */
export function writeMemory(text: string, agentId?: string): void {
  if (agentId !== undefined) guardAgentId(agentId)
  const dir = memoryDir(agentId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(memoryPath(agentId), text, 'utf8')
}

/**
 * Canonical comparison key for dedupe: content case-folded with every
 * whitespace run collapsed, so "记得 DSH 路径" and "记得DSH路径" are one fact.
 * @param content - the raw entry content.
 * @returns the normalized comparison key.
 */
export function dedupeKey(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Append one remembered fact, deduping against the store: a fact whose
 * normalized key already exists refreshes that entry's stamp instead of
 * duplicating; anything else is appended as a new timestamped line. Non-entry
 * lines (headers, blanks) survive untouched.
 * @param content - the fact to remember (single-line prose).
 * @param agentId - the agent id, or `undefined` for the global store.
 * @param at - stamp source, injectable for tests.
 * @returns what the write did.
 */
export function appendMemory(content: string, agentId?: string, at: Date = new Date()): MemoryAppendResult {
  if (agentId !== undefined) guardAgentId(agentId)
  const doc = readMemory(agentId)
  const stamp = stampNow(at)
  const trimmed = content.trim()
  if (trimmed === '') return { appended: false, refreshed: false, content: trimmed }
  const key = dedupeKey(trimmed)
  const headerLines: string[] = []
  const entryLines: string[] = []
  for (const line of doc.text.split(/\r?\n/)) {
    if (ENTRY_RE.test(line)) entryLines.push(line)
    else headerLines.push(line)
  }
  // Refresh an existing same-fact entry in place (keep its position, new stamp).
  for (let index = 0; index < entryLines.length; index += 1) {
    const match = ENTRY_RE.exec(entryLines[index] as string)
    if (match === null) continue
    if (dedupeKey((match[2] ?? '').trim()) === key) {
      entryLines[index] = `- [${stamp}] ${trimmed}`
      writeChunked(headerLines, entryLines, agentId)
      return { appended: false, refreshed: true, content: trimmed }
    }
  }
  entryLines.push(`- [${stamp}] ${trimmed}`)
  writeChunked(headerLines, entryLines, agentId)
  return { appended: true, refreshed: false, content: trimmed }
}

/** Compose the header + entries back into one document and write it. */
function writeChunked(headerLines: readonly string[], entryLines: readonly string[], agentId?: string): void {
  // Trim blank lines from the ends of the header block. Blank lines carry no
  // memory content, and keeping them means every later append re-reads and
  // re-preserves them, so a document that ever picks up leading/trailing
  // blanks accumulates them across writes. Interior blanks the user authored
  // stay untouched.
  const meaningfulHeader = [...headerLines]
  while (meaningfulHeader.length > 0 && /^\s*$/.test(meaningfulHeader[0] as string)) meaningfulHeader.shift()
  while (meaningfulHeader.length > 0 && /^\s*$/.test(meaningfulHeader[meaningfulHeader.length - 1] as string)) meaningfulHeader.pop()
  const body = [...meaningfulHeader, ...entryLines].join('\n')
  writeMemory(body.endsWith('\n') ? body : `${body}\n`, agentId)
}
