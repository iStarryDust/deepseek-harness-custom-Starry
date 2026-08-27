/** `compact` namespace dictionaries. */

/** Locale namespace owned by this plugin. */
export const NS = 'compact'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.compact': '压缩消息',
  'action.memory': '记忆',
  'state.compacting': '压缩中…',
  'state.compactFailed': '压缩失败',
  'memory.title': '选择消息写入记忆',
  'memory.subtitle': '勾选值得长期记住的对话，交给 AI 提炼后写入「吐司」的记忆。',
  'memory.empty': '暂无可选消息',
  'memory.user': '你',
  'memory.assistant': '助手',
  'memory.remember': '记忆',
  'memory.cancel': '取消',
  'memory.saving': '分析中…',
  'memory.saved': '已写入记忆',
  'memory.none': '没有值得记住的内容',
  'memory.failed': '记忆失败',
} satisfies Record<string, string>

/** The compact namespace key union. */
export type CompactKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The turn-tail compact/memory controls' copy. */
    compact: CompactKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.compact': 'Compact messages',
  'action.memory': 'Memory',
  'state.compacting': 'Compacting…',
  'state.compactFailed': 'Compaction failed',
  'memory.title': 'Select messages to remember',
  'memory.subtitle': 'Choose conversation worth keeping long-term; the model condenses it into the agent\'s memory.',
  'memory.empty': 'No selectable messages',
  'memory.user': 'You',
  'memory.assistant': 'Assistant',
  'memory.remember': 'Remember',
  'memory.cancel': 'Cancel',
  'memory.saving': 'Analyzing…',
  'memory.saved': 'Saved to memory',
  'memory.none': 'Nothing worth remembering',
  'memory.failed': 'Memory failed',
} satisfies Record<CompactKey, string>
