/**
 * An environment combined preset (`<agentId>-env-<slug>`) must deduce back to
 * its owning agent for memory lookups, like the shipped combined modes.
 */

import { describe, expect, it } from 'vitest'
import { agentIdOf } from '@deepseek-ai/dsh-agent-memory'

describe('agentIdOf', () => {
  it('deduces the owning agent from a shipped combined id', () => {
    expect(agentIdOf('agent-a-standard')).toBe('agent-a')
    expect(agentIdOf('agent-b-code')).toBe('agent-b')
    expect(agentIdOf('agent-c-minimal')).toBe('agent-c')
  })

  it('deduces the owning agent from an environment combined id', () => {
    expect(agentIdOf('agent-a-env-labcd123')).toBe('agent-a')
    expect(agentIdOf('my-agent-env-labc12-x9')).toBe('my-agent')
  })

  it('leaves a bare preset id as itself', () => {
    expect(agentIdOf('agent-a')).toBe('agent-a')
  })
})
