/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-agents`.
 * @module @deepseek-ai/dsh-client-ui-agents/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-agents'

/** Cordis companion plugin name. */
export const name = 'client-ui-agents-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer plugin registering presentational
 * components into a host-declared slot plus its locale dictionaries — its
 * inject face is stateless RPC wrappers plus a stage-and-start call; it
 * emits a single cordis event it also listens for, and owns no cross-plugin
 * mutable state beyond its own store.
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
