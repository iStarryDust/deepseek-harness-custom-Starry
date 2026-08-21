/** `sidebar` namespace dictionaries: shell controls (brand row, New Session, fold toggle). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'session.new': '创建 Agent',
  'session.new.label': '创建 Agent',
  'session.start': '新会话',
  'session.start.label': '新建会话',
  'session.back': '返回',
  'session.back.label': '返回',
  'toggle.open': '打开侧边栏',
  'toggle.collapse': '收起侧边栏',
} satisfies Record<string, string>

/** The sidebar namespace key union. */
export type SidebarKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'session.new': 'Create Agent',
  'session.new.label': 'Create Agent',
  'session.start': 'New Session',
  'session.start.label': 'New session',
  'session.back': 'Back',
  'session.back.label': 'Back',
  'toggle.open': 'Open sidebar',
  'toggle.collapse': 'Collapse sidebar',
} satisfies Record<SidebarKey, string>
