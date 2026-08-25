/**
 * Storage-layer behavior: round-trips, the dedupe/refresh rule, header
 * preservation, layout ownership, and the combined-preset split.
 *
 * `$DSH_HOME` is repointed per test (resolved per call), so the suite never
 * touches the developer's real home.
 */

import { mkdtemp, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GLOBAL_DIR, MEMORY_DIR, MEMORY_FILE, agentIdOf, appendMemory,
  memoryDir, memoryPath, memoryRoot, parseEntries, readMemory, readMemoryText,
  stampNow, writeMemory,
} from '@deepseek-ai/dsh-agent-memory'
import { agentIdOf as exportedAgentIdOf, GLOBAL_MEMORY_ORDER, AGENT_MEMORY_ORDER, isVacuousEntry, stripInvisible } from '../src/index.ts'

let home: string
let previousHome: string | undefined

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'dsh-memory-home-'))
  previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

describe('storage layout', () => {
  it('owns <dshHome>/agent-memory with global/ and <agentId>/ subdirectories', () => {
    expect(memoryRoot()).toBe(join(home, MEMORY_DIR))
    expect(memoryDir()).toBe(join(home, MEMORY_DIR, GLOBAL_DIR))
    expect(memoryDir(undefined)).toBe(join(home, MEMORY_DIR, GLOBAL_DIR))
    expect(memoryDir('agent-a')).toBe(join(home, MEMORY_DIR, 'agent-a'))
    expect(memoryPath('agent-a')).toBe(join(home, MEMORY_DIR, 'agent-a', MEMORY_FILE))
    // Sibling of the preset root segment, per the design contract.
    expect(memoryRoot()).toBe(join(home, '.agent-presets').replace('.agent-presets', MEMORY_DIR))
  })

  it('refuses an agent named like the reserved global segment', () => {
    expect(() => writeMemory('x', GLOBAL_DIR)).toThrow(/reserved memory store name/)
    expect(() => appendMemory('x', GLOBAL_DIR)).toThrow(/reserved memory store name/)
    expect(() => appendMemory('x', '')).toThrow(/reserved memory store name/)
  })
})

describe('read/write round-trip', () => {
  it('reads an absent store as empty and writes one back', async () => {
    expect(readMemoryText('agent-a')).toBe('')
    const text = '# 记忆\n- [2026-08-23 21:40] 哥哥偏好中文\n'
    writeMemory(text, 'agent-a')
    expect(readMemoryText('agent-a')).toBe(text)
    expect(await readFile(memoryPath('agent-a'), 'utf8')).toBe(text)
  })

  it('round-trips the global store at its own path', async () => {
    writeMemory('# 全局\n- [2026-08-23 21:41] 所有 agent 共享\n')
    expect(existsSync(memoryPath())).toBe(true)
    const doc = readMemory()
    expect(doc.entries).toHaveLength(1)
    expect(doc.entries[0]?.content).toBe('所有 agent 共享')
  })
})

describe('append and dedupe', () => {
  it('appends a timestamped entry and preserves header lines', () => {
    writeMemory('# 记忆\n\n已有说明\n', 'agent-a')
    const at = new Date(2026, 7, 23, 22, 5)
    const result = appendMemory('用户偏好：中文', 'agent-a', at)
    expect(result.appended).toBe(true)
    expect(result.refreshed).toBe(false)
    const doc = readMemory('agent-a')
    expect(doc.entries).toHaveLength(1)
    expect(doc.entries[0]).toEqual({ stamp: '2026-08-23 22:05', content: '用户偏好：中文' })
    expect(doc.text).toContain('已有说明')
    expect(doc.text).toContain('- [2026-08-23 22:05] 用户偏好：中文')
  })

  it('refreshes an existing same-fact entry instead of duplicating', () => {
    appendMemory('用户偏好：中文', 'agent-a', new Date(2026, 7, 23, 22, 5))
    const later = appendMemory('用户偏好：中文', 'agent-a', new Date(2026, 7, 24, 9, 0))
    expect(later.appended).toBe(false)
    expect(later.refreshed).toBe(true)
    const doc = readMemory('agent-a')
    expect(doc.entries).toHaveLength(1)
    expect(doc.entries[0]?.stamp).toBe('2026-08-24 09:00')
  })

  it('treats whitespace/case variants as the same fact', () => {
    appendMemory('记住 DSH 路径', 'agent-a', new Date(2026, 7, 23, 22, 5))
    const result = appendMemory(' 记住   dsh 路径 ', 'agent-a', new Date(2026, 7, 24, 9, 0))
    expect(result.refreshed).toBe(true)
    expect(readMemory('agent-a').entries).toHaveLength(1)
  })

  it('rejects an empty fact without writing', () => {
    const result = appendMemory('   ', 'agent-a')
    expect(result.appended).toBe(false)
    expect(result.refreshed).toBe(false)
    expect(readMemory('agent-a').entries).toHaveLength(0)
  })

  it('does not accumulate blank lines across appends', () => {
    writeMemory('\n\n# 记忆\n\n', 'agent-a')
    appendMemory('第一条', 'agent-a', new Date(2026, 7, 24, 9, 0))
    appendMemory('第二条', 'agent-a', new Date(2026, 7, 24, 9, 1))
    const text = readMemoryText('agent-a')
    // The document starts on the header, with no leading blank block: a blank
    // line that precedes the header is a leftover we trimmed, and a document
    // that re-accumulates it would regress.
    expect(text.startsWith('# 记忆') && !text.startsWith('\n')).toBe(true)
    // Header/entry lines all begin with a non-blank token (title or "- [").
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe('# 记忆')
    expect(lines[1]).toBe('- [2026-08-24 09:00] 第一条')
    expect(lines[2]).toBe('- [2026-08-24 09:01] 第二条')
  })

  it('parses only stamped entry lines', () => {
    const entries = parseEntries('# 标题\n- [2026-01-02 03:04] 带戳\n- 无戳说明\n\n- [2026-01-02 03:05]  另一条  \n')
    expect(entries).toHaveLength(2)
    expect(entries[1]).toEqual({ stamp: '2026-01-02 03:05', content: '另一条' })
  })
})

describe('stamp format', () => {
  it('renders zero-padded local YYYY-MM-DD HH:mm', () => {
    expect(stampNow(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04')
  })
})

describe('agent id derivation', () => {
  it('splits combined presets and passes plain ids through', () => {
    expect(agentIdOf('agent-a-standard')).toBe('agent-a')
    expect(agentIdOf('agent-b-code')).toBe('agent-b')
    expect(agentIdOf('agent-c-minimal')).toBe('agent-c')
    expect(agentIdOf('agent-a')).toBe('agent-a')
    expect(exportedAgentIdOf('agent-x-standard')).toBe('agent-x')
  })

  it('keeps the memory sections ordered right after the persona', () => {
    expect(GLOBAL_MEMORY_ORDER).toBeLessThan(AGENT_MEMORY_ORDER)
  })
})

describe('remember entry sanitization', () => {
  it('flags vacuous "no content" placeholders a model may emit', () => {
    expect(isVacuousEntry('（空行）')).toBe(true)
    expect(isVacuousEntry('空行')).toBe(true)
    expect(isVacuousEntry('无')).toBe(true)
    expect(isVacuousEntry('没有')).toBe(true)
    expect(isVacuousEntry('none')).toBe(true)
    expect(isVacuousEntry('n/a')).toBe(true)
    expect(isVacuousEntry('-')).toBe(true)
    expect(isVacuousEntry('')).toBe(true)
    expect(isVacuousEntry('   ')).toBe(true)
  })

  it('passes real content through as a memory entry', () => {
    expect(isVacuousEntry('哥哥叫 phone，今年22岁')).toBe(false)
    expect(isVacuousEntry('用户偏好：中文交流')).toBe(false)
  })

  it('strips invisible/zero-width whitespace that String.trim misses', () => {
    // Zero-width space (U+200B), non-breaking space (U+00A0), BOM (U+FEFF),
    // and full-width space (U+3000) are all invisible but bytewise non-empty.
    expect(isVacuousEntry('\u200B\u200B\u200B')).toBe(true)
    expect(isVacuousEntry('\u00A0\u00A0')).toBe(true)
    expect(isVacuousEntry('\uFEFF')).toBe(true)
    expect(isVacuousEntry('\u3000\u3000')).toBe(true)
    // Around real prose they are removed but the text survives.
    expect(isVacuousEntry(`\u200B${'用户叫 Starry'}\u200B`)).toBe(false)
    expect(stripInvisible(`\u200B${'用户叫 Starry'}\u200B`)).toBe('用户叫 Starry')
    expect(stripInvisible('\u200B\u200B\u3000')).toBe('')
  })
})
