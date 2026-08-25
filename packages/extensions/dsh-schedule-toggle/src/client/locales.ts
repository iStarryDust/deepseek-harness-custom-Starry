/** Dictionary for the Schedule toggle settings row. */
export const zh = {
  title: '定时计划',
} as const

export const en = {
  title: 'Schedule reminders',
} as const

export type ScheduleToggleKey = keyof typeof zh
export type ScheduleToggleEnKey = keyof typeof en
