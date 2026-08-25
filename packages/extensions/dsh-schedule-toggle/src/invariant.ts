/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-schedule-toggle`.
 * @module @deepseek-ai/dsh-schedule-toggle/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-schedule-toggle'

/** Cordis companion plugin name. */
export const name = 'schedule-toggle-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the settings scope validates and publishes the
 * durable switch value, while the profile patch sync is covered by the Host
 * behavior specs.
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
