/**
 * Per-agent environment ("定义模式 / Define mode") vocabulary and composition
 * building: env combined ids are recognized, and building a composition drops
 * the rows of every disabled capability while keeping the identity rows and
 * filtering split group blocks (sub-agents / workflows / Ralph) to only their
 * enabled children.
 */

import { describe, expect, it } from 'vitest'
import {
  buildEnvironmentComposition, newEnvironmentModeId,
} from '@deepseek-ai/dsh-agent-presets'
import { ENVIRONMENT_MODE_PREFIX, combinedPartsOf } from '../src/preset.ts'

// A standard-like composition carrying one row per capability touched by the
// test, plus the always-on identity rows and the split `delegation` group.
const STANDARD_LIKE = [
  '- id: persona',
  "  name: '@deepseek-ai/dsh-persona'",
  '  config:',
  '    text: You are a coding agent.',
  '',
  '- id: agent-instructions',
  "  name: '@deepseek-ai/dsh-agent-instructions'",
  '',
  '- id: tool-bash',
  "  name: '@deepseek-ai/dsh-tool-bash'",
  '',
  '- id: tool-pwsh',
  "  name: '@deepseek-ai/dsh-tool-pwsh'",
  '',
  '- id: tool-fs',
  "  name: '@deepseek-ai/dsh-tool-fs'",
  '',
  '- id: tool-fs-search',
  "  name: '@deepseek-ai/dsh-tool-fs-search'",
  '',
  '- id: tool-web',
  "  name: '@deepseek-ai/dsh-tool-web'",
  '',
  '- id: planning',
  '  name: cordis:group',
  '  group: true',
  '  isolate:',
  '    planMode: true',
  '  config:',
  '    - id: plan-mode',
  "      name: '@deepseek-ai/dsh-plan-mode'",
  '',
  '- id: delegation',
  '  name: cordis:group',
  '  group: true',
  '  isolate:',
  '    workflowEngine: true',
  '  config:',
  '    - id: tool-subagent-control',
  "      name: '@deepseek-ai/dsh-tool-subagent-control'",
  '',
  '    - id: tool-subagent',
  "      name: '@deepseek-ai/dsh-tool-subagent'",
  '      config:',
  '        provider: spawn',
  '',
  '    - id: tool-subagent-fork',
  "      name: '@deepseek-ai/dsh-tool-subagent'",
  '      config:',
  '        provider: fork',
  '',
  '    - id: workflow-worker-thread',
  "      name: '@deepseek-ai/dsh-workflow-worker-thread'",
  '',
  '    - id: tool-workflow',
  "      name: '@deepseek-ai/dsh-tool-workflow'",
  '',
  '    - id: tool-ralph',
  "      name: '@deepseek-ai/dsh-tool-ralph'",
  '      config:',
  '        maxRounds: 64',
  '',
].join('\n')

describe('combinedPartsOf', () => {
  it('splits a shipped combined id into agent and mode', () => {
    expect(combinedPartsOf('agent-a-standard')).toEqual({ agentId: 'agent-a', modeId: 'standard' })
    expect(combinedPartsOf('agent-b-code')).toEqual({ agentId: 'agent-b', modeId: 'code' })
    expect(combinedPartsOf('agent-c-minimal')).toEqual({ agentId: 'agent-c', modeId: 'minimal' })
  })

  it('splits an environment combined id into agent and multi-segment env mode', () => {
    expect(combinedPartsOf('agent-a-env-labcd123')).toEqual({ agentId: 'agent-a', modeId: 'env-labcd123' })
    expect(combinedPartsOf('my-agent-env-labc12-x9')).toEqual({ agentId: 'my-agent', modeId: 'env-labc12-x9' })
  })

  it('does not read a bare, an uncombined, or a plain env-suffixed name as a combined id', () => {
    expect(combinedPartsOf('agent-a')).toBeUndefined()
    expect(combinedPartsOf('env-1')).toBeUndefined()
    expect(combinedPartsOf('agent-a-toolbox')).toBeUndefined()
  })
})

describe('newEnvironmentModeId', () => {
  it('mints a lowercase, dash-joined env mode id that PRESET_ID accepts', () => {
    const modeId = newEnvironmentModeId()
    expect(modeId.startsWith(ENVIRONMENT_MODE_PREFIX)).toBe(true)
    expect(/^[a-z0-9][a-z0-9-]*$/.test(modeId)).toBe(true)
    expect(combinedPartsOf(`agent-a-${modeId}`)).toEqual({ agentId: 'agent-a', modeId })
  })

  it('mints a fresh id each call', () => {
    expect(newEnvironmentModeId()).not.toBe(newEnvironmentModeId())
  })
})

describe('buildEnvironmentComposition', () => {
  it('keeps the identity rows and the enabled flat rows', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['shell', 'files'])
    expect(result).toContain('persona')
    expect(result).toContain('agent-instructions')
    expect(result).toContain('tool-bash')
    expect(result).toContain('tool-pwsh')
    expect(result).toContain('tool-fs')
  })

  it('drops the rows of every disabled group, a whole group block included', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['shell'])
    expect(result).not.toContain('tool-web')
    expect(result).not.toContain('tool-fs-search')
    expect(result).not.toContain('plan-mode')
    expect(result).not.toContain('cordis:group') // planning group dropped whole
    expect(result).not.toContain('tool-subagent-control') // delegation group dropped
  })

  it('keeps an atomic group row whole when its capability is enabled', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['plan'])
    expect(result).toContain('plan-mode')
  })

  it('filters the split delegation group to only the enabled sub-agents children', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['subagents'])
    expect(result).toContain('tool-subagent-control')
    expect(result).toContain('tool-subagent')
    expect(result).toContain('tool-subagent-fork')
    expect(result).not.toContain('workflow-worker-thread')
    expect(result).not.toContain('tool-workflow')
    expect(result).not.toContain('tool-ralph')
    expect(result).not.toContain('tool-web')
  })

  it('keeps only the workflows children when workflows is enabled', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['workflows'])
    expect(result).toContain('workflow-worker-thread')
    expect(result).toContain('tool-workflow')
    expect(result).not.toContain('tool-subagent-control')
    expect(result).not.toContain('tool-ralph')
  })

  it('keeps only the ralph child when ralph is enabled', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['ralph'])
    expect(result).toContain('tool-ralph')
    expect(result).not.toContain('tool-subagent-control')
    expect(result).not.toContain('workflow-worker-thread')
  })

  it('uncouples subagents and workflows (each toggles independently)', () => {
    const both = buildEnvironmentComposition(STANDARD_LIKE, ['subagents', 'workflows'])
    expect(both).toContain('tool-subagent-control')
    expect(both).toContain('tool-workflow')
    expect(both).not.toContain('tool-ralph')
    const subOnly = buildEnvironmentComposition(STANDARD_LIKE, ['subagents'])
    expect(subOnly).not.toContain('tool-workflow')
  })

  it('keeps only the identity rows when every group is disabled', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, [])
    expect(result).toContain('persona')
    expect(result).toContain('agent-instructions')
    expect(result).not.toContain('tool-bash')
    expect(result).not.toContain('tool-fs')
    expect(result).not.toContain('plan-mode')
    expect(result).not.toContain('tool-ralph')
  })

  it('is a subset: it never adds a row id the base lacked', () => {
    const result = buildEnvironmentComposition(STANDARD_LIKE, ['subagents', 'files'])
    for (const rowId of ['persona', 'agent-instructions', 'tool-bash', 'tool-pwsh', 'tool-fs', 'tool-fs-search', 'tool-web', 'planning', 'tool-ralph', 'tool-subagent-control', 'tool-subagent', 'tool-subagent-fork', 'workflow-worker-thread', 'tool-workflow']) {
      if (result.includes(rowId)) expect(STANDARD_LIKE.includes(rowId)).toBe(true)
    }
  })
})
