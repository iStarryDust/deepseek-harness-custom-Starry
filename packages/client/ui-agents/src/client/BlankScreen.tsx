/**
 * The conversation-region blank: rendered into the `conversation` slot while
 * the agent browser shows the roster / create surfaces, so the right side of
 * a fresh page reads as empty instead of the workspace hero. Pure presentation.
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-layout SlotMap merge ('conversation').
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import css from './AgentBrowser.module.css'

/** Full component props (the conversation slot's runtime share plus locale). */
export type BlankScreenProps =
  PropsRuntime<'conversation'>
  & PropsLocale<'agents'>

/**
 * Render the blank right side.
 * @returns an empty region.
 */
export function BlankScreen(_props: BlankScreenProps) {
  return <div className={css.blankScreen} />
}
