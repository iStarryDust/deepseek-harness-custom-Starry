/** `settings.agentMemory` namespace dictionaries. */

/** Locale namespace owned by this plugin. */
export const NS = 'settings.agentMemory'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': 'Agent记忆',
  'switch.global': '全局记忆',
  'switch.global.hint': '开启后，所有 Agent 共享的全局记忆会注入到系统提示中',
  'switch.agent': 'Agent记忆',
  'switch.agent.hint': '开启后，当前 Agent 独有的记忆会注入到系统提示中',
  'switch.auto': '自动记忆',
  'switch.auto.hint': '开启后，Agent 会自行判断重要信息，自动添加到 Agent 记忆中',
  'switch.ask': '询问记忆',
  'switch.ask.hint': '开启后，Agent 添加记忆前会先询问你确认',
  'switch.ask.disabledHint': '需先开启自动记忆',
  'editor.global.title': '全局记忆',
  'editor.global.hint': '所有 Agent 共享的记忆，直接编辑后保存；格式：- [时间] 内容',
  'action.save': '保存',
  'action.loading': '加载中…',
  'state.saved': '已保存',
  'state.saveFailed': '保存失败',
  'state.loadFailed': '记忆加载失败',
} satisfies Record<string, string>

/** The namespace key union. */
export type AgentMemoryKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The agent-memory settings page copy. */
    'settings.agentMemory': AgentMemoryKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Agent Memory',
  'switch.global': 'Global memory',
  'switch.global.hint': 'When on, the global memory shared by every agent is injected into the system prompt',
  'switch.agent': 'Agent memory',
  'switch.agent.hint': 'When on, this agent\'s own memory is injected into the system prompt',
  'switch.auto': 'Auto memory',
  'switch.auto.hint': 'When on, the agent judges important facts on its own and writes them to its memory',
  'switch.ask': 'Ask before remembering',
  'switch.ask.hint': 'When on, the agent asks you before writing a fact to memory',
  'switch.ask.disabledHint': 'Turn on auto memory first',
  'editor.global.title': 'Global memory',
  'editor.global.hint': 'Memory shared by every agent; edit freely. Format: - [time] content',
  'action.save': 'Save',
  'action.loading': 'Loading…',
  'state.saved': 'Saved',
  'state.saveFailed': 'Save failed',
  'state.loadFailed': 'Failed to load memory',
} satisfies Record<AgentMemoryKey, string>
