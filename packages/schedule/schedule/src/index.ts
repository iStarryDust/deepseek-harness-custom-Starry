/**
 * Agent-scoped durable one-shot and fixed-rate reminders over the session event log.
 * @module @deepseek-ai/dsh-schedule
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { ScheduleRuntime } from './runtime.ts'
import { registerScheduleTools } from './tools.ts'

export type * from './types.ts'
export {
  SCHEDULE_CHANGE_VERSION,
  MIN_EVERY_INTERVAL_SECONDS,
  ScheduleId,
  ScheduleInputError,
  ScheduleLogError,
  allocateScheduleId,
  createAfterScheduleRecord,
  createAtScheduleRecord,
  createEveryScheduleRecord,
  decodeScheduleChange,
  foldScheduleEvents,
  renderReminderFraming,
  renderEveryReminderBatchFraming,
  resolveEveryOccurrence,
  scheduleView,
} from './domain.ts'
export { registerScheduleTools } from './tools.ts'

/** Cordis function-plugin name. */
export const name = 'schedule'
/** Services required before future root agents can receive Schedule. */
export const inject = ['agents', 'sessions', 'tools', 'sessionPersistence']

type OwnerCleanup = () => void | Promise<void>

/** Install Schedule for every root agent, including those already live when the plugin loads. */
export function apply(ctx: Context): void {
  const runtimes = new Map<Agent, OwnerCleanup>()
  let stopping = false

  /**
   * Register Schedule for one root agent: its model-facing tools plus the live
   * timer projection. Idempotent per agent so a later `agent/created` echo or a
   * re-armed load cannot double-register the same owner.
   */
  const attach = (agent: Agent): void => {
    if (stopping || runtimes.has(agent) || !ctx.agents.roots().includes(agent)) return
    const runtime = new ScheduleRuntime(ctx, agent)
    const cleanup: OwnerCleanup = agent.ctx.effect(() => {
      const disposeTools = registerScheduleTools(ctx, agent.ctx, agent, () => { runtime.requestDrive() })
      const stopStatus = agent.ctx.on('agent/status', ({ status }) => {
        if (status === 'idle' && agent.session.events.some(event => event.type === 'schedule/change')) {
          runtime.requestDrive()
        }
      })
      runtime.start()
      return async () => {
        stopStatus()
        disposeTools()
        try {
          await runtime.dispose()
        } finally {
          if (runtimes.get(agent) === cleanup) runtimes.delete(agent)
        }
      }
    }, 'schedule.runtime()')
    runtimes.set(agent, cleanup)
  }

  ctx.effect(() => {
    // A plugin hot reload (e.g. the settings switch enabling Schedule at runtime)
    // must reach root agents created before this load, not only those published
    // afterwards. Registering the already-live roots keeps them able to use the
    // schedule_* tools without requiring a new session.
    for (const agent of ctx.agents.roots()) attach(agent)

    const stopCreated = ctx.on('agent/created', ({ agent }) => { attach(agent) })

    return async () => {
      stopping = true
      stopCreated()
      const cleanups = [...runtimes.values()]
      runtimes.clear()
      await Promise.allSettled(cleanups.map(cleanup => Promise.resolve(cleanup())))
    }
  }, 'schedule.lifecycle()')
}
