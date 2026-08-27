/**
 * Per-agent environment ("定义模式 / Define mode") vocabulary.
 *
 * An environment is a strict subset of the `standard` agent preset's
 * capability set. This module owns the capability palette — the toggleable
 * groups and the `agent.cordis.yml` rows each group owns — and the pure-text
 * function that produces a composition from the `standard` composition by
 * dropping the rows of every disabled group.
 *
 * A capability owns either whole top-level rows (a bare row id, e.g. `tool-fs`)
 * or a subset of a top-level group row's nested children (a `group.child` ref,
 * e.g. `delegation.tool-subagent`). The builder keeps the enabled rows and,
 * for a group row, keeps only the enabled children — so one group block can be
 * split into independently toggleable capabilities.
 *
 * Deliberately a subset, never a superset: authoring grants no capability the
 * base did not already carry, so removing rows is the only safe way to turn
 * "what `standard` can do" into "what this environment needs."
 * @module @deepseek-ai/dsh-agent-presets/environment
 */

import { ENVIRONMENT_MODE_PREFIX } from './preset.ts'

/** One toggleable capability group of the `standard` preset. */
export interface EnvironmentGroup {
  /** Stable group id; the browser localizes the label, the id addresses. */
  readonly id: string
  /** English display name, the fallback when a locale has no key. */
  readonly name: string
  /** English one-line description, the fallback when a locale has no key. */
  readonly description: string
  /** Whether a fresh environment pre-selects this group in the picker. */
  readonly defaultEnabled: boolean
  /**
   * The composition rows this capability owns. A bare row id (e.g. `tool-fs`)
   * is a top-level row kept whole; `group.child` (e.g. `delegation.tool-ralph`)
   * is a child inside a top-level group row — the group is filtered to only
   * the enabled children. The identity rows (`persona`, `agent-instructions`)
   * belong to none of these and stay unconditionally.
   */
  readonly rows: readonly string[]
}

/** The capability palette, in picker display order. */
export const ENVIRONMENT_GROUPS: readonly EnvironmentGroup[] = [
  {
    id: 'shell',
    name: 'Shell',
    description: 'Run commands in bash / PowerShell (including a persistent shell).',
    defaultEnabled: true,
    rows: ['tool-bash', 'tool-pwsh'],
  },
  {
    id: 'files',
    name: 'File editing',
    description: 'Read and write files and directories in the workspace.',
    defaultEnabled: true,
    rows: ['tool-fs'],
  },
  {
    id: 'file-search',
    name: 'File search',
    description: 'Search for files and content across the workspace.',
    defaultEnabled: true,
    rows: ['tool-fs-search'],
  },
  {
    id: 'ask-user',
    name: 'Ask the user',
    description: 'Ask the human a question to resolve a choice or ambiguity.',
    defaultEnabled: true,
    rows: ['tool-ask-user'],
  },
  {
    id: 'todo',
    name: 'To-do list',
    description: 'Keep a structured task list and track progress across a turn.',
    defaultEnabled: true,
    rows: ['tool-todo'],
  },
  {
    id: 'jobs',
    name: 'Background jobs',
    description: 'Collect, inspect, and stop long-running background commands.',
    defaultEnabled: false,
    rows: ['tool-jobs'],
  },
  {
    id: 'skills',
    name: 'Skills',
    description: 'Load and run repository and global instruction skills.',
    defaultEnabled: false,
    rows: ['skill-filesystem', 'tool-skill'],
  },
  {
    id: 'goals',
    name: 'Goals',
    description: 'Track a long-running completion objective across autonomous rounds.',
    defaultEnabled: false,
    rows: ['tool-goal'],
  },
  {
    id: 'web',
    name: 'Web search',
    description: 'Search the web for current information and cite sources.',
    defaultEnabled: false,
    rows: ['tool-web'],
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Open, render, and interact with web pages in a built-in browser.',
    defaultEnabled: false,
    rows: ['browser'],
  },
  {
    id: 'plan',
    name: 'Plan mode',
    description: 'Plan before implementing, in a plan-only mode the model must exit.',
    defaultEnabled: false,
    rows: ['planning'],
  },
  {
    id: 'compaction',
    name: 'Context compaction',
    description: 'Compact a long conversation so the model keeps a working memory.',
    defaultEnabled: false,
    rows: ['compaction'],
  },
  {
    id: 'subagents',
    name: 'Sub-agents',
    description: 'Spawn and fork child sub-agents for parallel or delegated work.',
    defaultEnabled: false,
    rows: [
      'delegation.tool-subagent-control',
      'delegation.tool-subagent-list-agents',
      'delegation.tool-subagent',
      'delegation.tool-subagent-fork',
      'delegation.tool-subagent-codex',
      'delegation.tool-subagent-claude-code',
    ],
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Run multi-step coordinated workflows across the delegation engine.',
    defaultEnabled: false,
    rows: ['delegation.workflow-worker-thread', 'delegation.tool-workflow'],
  },
  {
    id: 'ralph',
    name: 'Ralph loop',
    description: 'Run a fresh-agent iterative loop toward one immutable objective.',
    defaultEnabled: false,
    rows: ['delegation.tool-ralph'],
  },
]

/** The ids of every toggleable group, in picker order. */
export function environmentGroupIds(): readonly string[] {
  return ENVIRONMENT_GROUPS.map(group => group.id)
}

/** The groups a fresh environment pre-selects, by id. */
export function defaultEnvironmentGroups(): readonly string[] {
  return ENVIRONMENT_GROUPS.filter(group => group.defaultEnabled).map(group => group.id)
}

/** Domain keywords → capability ids, for a deterministic suggestion fallback. */
const KEYWORD_CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  game: ['shell', 'files', 'file-search', 'skills', 'web', 'browser'],
  web: ['web', 'browser', 'skills'],
  data: ['web', 'files', 'file-search', 'skills'],
  agent: ['goals', 'subagents', 'workflows', 'plan'],
  workflow: ['workflows', 'compaction'],
  research: ['web', 'skills'],
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
 * Deterministically suggest capability ids for a description by keyword, as a
 * fallback when the model-backed analysis is unavailable.
 * @param description - the environment description (name or note).
 * @returns the keyword-implied capability ids.
 */
export function suggestCapabilityGroups(description: string): readonly string[] {
  const lower = description.toLowerCase()
  const ids = new Set<string>()
  for (const [keyword, groups] of Object.entries(KEYWORD_CAPABILITIES)) {
    if (lower.includes(keyword.toLowerCase())) for (const id of groups) ids.add(id)
  }
  return [...ids]
}

/**
 * Generate a unique, non-reusable environment mode id (`env-<slug>`).
 *
 * One-off by design: each chat-start that composes a "定义模式" environment
 * gets its own combined preset rather than rejoining a named template, so the
 * session's history was produced under exactly the composition the user chose
 * this time. The slug carries a timestamp plus randomness, so recreating the
 * same environment never collides.
 * @returns a mode id such as `env-labcd12xyz`.
 */
export function newEnvironmentModeId(): string {
  const stamp = Date.now().toString(36)
  const chaos = Math.random().toString(36).slice(2, 8)
  return `${ENVIRONMENT_MODE_PREFIX}${stamp}${chaos}`
}

/** The always-on identity rows no environment may strip. */
const IDENTITY_ROWS = new Set(['persona', 'agent-instructions'])

/** The top-level start of a `cordis.yml` row. */
const ROW_ID_RE = /^- id: ([a-z0-9][a-z0-9-]*)\n/

/** Whether a top-level row block is a `cordis:group` (its `group: true` line). */
function isGroupRow(block: string): boolean {
  return /^ {2}group: true$/m.test(block)
}

/**
 * Keep only the enabled children of a top-level group row block. The header
 * (up to and including `config:`) is kept; each child block (a `    - id:`
 * line plus its indented content) is dropped unless its id is enabled. A
 * child that no capability owns is preserved (mapping only strips what a
 * disabled capability would have removed).
 * @param block - the whole group row block text.
 * @param keep - the child ids to keep.
 * @param ownedChildIds - every child id any capability references for this group.
 * @returns the group row with only the kept children.
 */
function filterGroupChildren(
  block: string,
  keep: ReadonlySet<string>,
  ownedChildIds: ReadonlySet<string>,
): string {
  const firstChild = block.indexOf('    - id:')
  if (firstChild === -1) return block
  const header = block.slice(0, firstChild)
  // The end anchor is `(?![\s\S])` ("nothing after here"), not `\z` — `\z` is
  // a literal `z` in JavaScript, which would never end-match a trailing child.
  const childRe = /^ {4}- id: ([a-z0-9][a-z0-9-]*)\n[\s\S]*?(?=^ {4}- id: |(?![\s\S]))/gm
  const kept: string[] = []
  for (const match of block.slice(firstChild).matchAll(childRe)) {
    const childId = match[1]
    // Keep enabled children and children no capability owns.
    if (childId !== undefined && (keep.has(childId) || !ownedChildIds.has(childId))) {
      kept.push(match[0])
    }
  }
  return header + kept.join('')
}

/**
 * Produce a composition from the `standard` composition by dropping the rows
 * of every disabled capability. Identity rows stay. A row belongs to at most
 * one capability; a row that no capability owns is preserved untouched, so a
 * deployment's own extra rows are never stripped. Group rows are discarded
 * whole when the capability that owns them (atomically, e.g. plan/compaction)
 * is disabled, and rebuilt with only the enabled children when they are split
 * (sub-agents / workflows / Ralph).
 * @param composition - the `standard` composition text, verbatim.
 * @param enabledGroupIds - the capabilities the environment keeps.
 * @returns the composition text with disabled groups' rows removed.
 */
export function buildEnvironmentComposition(
  composition: string,
  enabledGroupIds: readonly string[],
): string {
  const enabled = new Set(enabledGroupIds)
  // Flat rows kept whole and, separately, every flat row any capability owns.
  const keptPlain = new Set<string>()
  const ownedPlain = new Set<string>()
  // Group row id → the children kept inside it and every child any cap owns.
  const keptChildren = new Map<string, Set<string>>()
  const ownedChildren = new Map<string, Set<string>>()
  for (const group of ENVIRONMENT_GROUPS) {
    for (const ref of group.rows) {
      const dot = ref.indexOf('.')
      if (dot === -1) {
        ownedPlain.add(ref)
        if (enabled.has(group.id)) keptPlain.add(ref)
      } else {
        const groupId = ref.slice(0, dot)
        const childId = ref.slice(dot + 1)
        let ownedSet = ownedChildren.get(groupId)
        if (ownedSet === undefined) { ownedSet = new Set(); ownedChildren.set(groupId, ownedSet) }
        ownedSet.add(childId)
        if (enabled.has(group.id)) {
          let keepSet = keptChildren.get(groupId)
          if (keepSet === undefined) { keepSet = new Set(); keptChildren.set(groupId, keepSet) }
          keepSet.add(childId)
        }
      }
    }
  }

  const [preamble, ...rows] = composition.split(/(?=^- id: )/m)
  let out = preamble ?? ''
  for (const block of rows) {
    const id = ROW_ID_RE.exec(block)?.[1]
    if (id === undefined || IDENTITY_ROWS.has(id)) { out += block; continue }
    if (isGroupRow(block)) {
      // An atomic group kept whole when its capability is enabled.
      if (keptPlain.has(id)) { out += block; continue }
      const own = ownedChildren.get(id)
      if (own !== undefined) {
        // A split group (sub-agents/workflows/Ralph): keep enabled children,
        // drop the whole group when none are enabled.
        const keep = keptChildren.get(id)
        if (keep === undefined || keep.size === 0) continue
        out += filterGroupChildren(block, keep, own)
        continue
      }
      if (ownedPlain.has(id)) continue // owned atomically but its capability is disabled
      out += block // a group no capability owns is preserved
    } else if (keptPlain.has(id) || !ownedPlain.has(id)) {
      // Keep flat rows that are enabled, or that no capability owns.
      out += block
    }
    // Owned flat rows whose capability is disabled fall through and are dropped.
  }
  return out
}
