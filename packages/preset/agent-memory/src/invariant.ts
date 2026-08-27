/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-agent-memory`.
 * @module @deepseek-ai/dsh-agent-memory/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { agentIdOf, GLOBAL_DIR, memoryDir, memoryRoot } from '@deepseek-ai/dsh-agent-memory'

/** Cordis companion plugin name. */
export const name = 'agent-memory-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Audit the storage layout's pure invariants at install time. These functions
 * are the ones that decide where a memory write lands, so a broken split or a
 * colliding directory would silently scatter or clobber stores.
 */
const install: InvariantInstaller = (_ctx: Context, fail: (message: string) => void) => {
  // The default (no agent named) store is the global one, and the global store
  // is a real subdirectory: the root must never be a store directory itself.
  if (memoryRoot() === memoryDir()) {
    fail('the memory root must not be itself a store directory')
  }
  if (memoryDir() !== memoryDir(GLOBAL_DIR)) {
    fail('the default store must resolve to the global memory directory')
  }
  // Combined preset ids `<agentId>-<modeId>` must recover the owning agent.
  for (const [combined, expected] of [
    ['agent-a-standard', 'agent-a'],
    ['agent-b-code', 'agent-b'],
    ['agent-c-minimal', 'agent-c'],
  ] as const) {
    if (agentIdOf(combined) !== expected) {
      fail(`combined preset id "${combined}" must split to agent id "${expected}"`)
    }
  }
  // A plain preset id passes through unchanged.
  if (agentIdOf('agent-a') !== 'agent-a') {
    fail('a plain preset id must pass through unchanged')
  }
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-agent-memory', install))
