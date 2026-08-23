/**
 * Package-owned invariant companion for
 * `@deepseek-ai/dsh-client-ui-settings-agent-memory`.
 * @module @deepseek-ai/dsh-client-ui-settings-agent-memory/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-settings-agent-memory'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-agent-memory-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin owns one settings.section registration and
 * one page store, both released by the same effect disposer.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
