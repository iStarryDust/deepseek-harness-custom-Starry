/**
 * Composing an environment (`composeEnvironment`) authors a per-agent combined
 * preset under `<agentId>/modes/env-<slug>/`, discoverable by `list()` and
 * usable as the session's preset. The composition is a strict subset of the
 * `standard` base, so authoring still grants no new capability.
 */

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { describe, beforeEach, expect, it } from 'vitest'
import AgentPresets, { COMPOSITION_FILE } from '@deepseek-ai/dsh-agent-presets'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const VALID = '- id: alpha\n  name: ../../plugins/contribute.js\n  config:\n    tool: alpha\n'

let ctx: Context
let userRoot: string

beforeEach(async () => {
  userRoot = await mkdtemp(join(tmpdir(), 'dsh-preset-env-'))
  ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.plugin(AgentPresets, {
    default: 'standard',
    roots: [
      { path: join(FIXTURES, 'system'), trust: 'system' as const },
      { path: userRoot, trust: 'user' as const },
    ],
    includeUserRoot: false,
  })
})

describe('composeEnvironment', () => {
  it('authors a discoverable combined env preset under the agent modes dir', async () => {
    // The owning agent must already exist under the writable root (a real
    // agent, so chaining an environment onto it reads as one folder).
    await mkdir(join(userRoot, 'agent-a'))
    await writeFile(join(userRoot, 'agent-a', COMPOSITION_FILE), VALID)

    const combinedId = await ctx.agentPresets.composeEnvironment(
      'agent-a',
      { name: '游戏环境', language: '中文', persona: '保持专业。' },
      ['shell'],
    )

    expect(combinedId).toMatch(/^agent-a-env-[a-z0-9-]+$/)

    // The combined id resolves through the roster as a user preset.
    const listed = await ctx.agentPresets.list()
    const combined = listed.find(preset => preset.id === combinedId)
    expect(combined).toBeDefined()
    expect(combined?.trust).toBe('user')

    // It lives in the agent's own modes directory, and reads as a subset: the
    // base `standard` rows carry over, the persona row folds the agent in.
    const modeDir = join(userRoot, 'agent-a', 'modes', combinedId.slice('agent-a-'.length))
    expect(existsSync(join(modeDir, COMPOSITION_FILE))).toBe(true)
    const composition = await readFile(join(modeDir, COMPOSITION_FILE), 'utf8')
    expect(composition).toContain('alpha')
    expect(composition).toContain('保持专业。')
  })

  it('refuses to compose an environment for an agent that does not exist', async () => {
    await expect(ctx.agentPresets.composeEnvironment(
      'ghost',
      { name: 'X', language: '', persona: '' },
      ['shell'],
    )).rejects.toThrow(/must match|refusing/)
  })
})
