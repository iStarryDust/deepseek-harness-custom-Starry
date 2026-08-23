/** `compact` namespace dictionaries. */

/** Locale namespace owned by this plugin. */
export const NS = 'compact'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.compact': '压缩消息',
  'action.memory': '记忆',
  'state.compacting': '压缩中…',
  'state.memorySoon': '记忆功能即将上线',
  'state.compactFailed': '压缩失败',
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
  'state.memorySoon': 'Memory is coming soon',
  'state.compactFailed': 'Compaction failed',
} satisfies Record<CompactKey, string>
