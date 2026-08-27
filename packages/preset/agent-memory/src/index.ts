/**
 * Global and per-agent long-term memory for the DeepSeek Harness.
 *
 * Two memory tiers, both plain markdown stores under `<dshHome>/agent-memory`
 * (sibling of `.agent-presets`, resolved through `dshHomePath` so `$DSH_HOME`
 * and cross-platform homes land correctly):
 *
 * - **global**: `global/memory.md`, shared by every agent;
 * - **agent**: `<agentId>/memory.md`, one store per agent (the agent id is the
 *   user preset id, deduced from a combined `<agentId>-<modeId>` preset).
 *
 * Four user switches (settings namespace `agent-memory`, default all off)
 * control behavior:
 * - `globalEnabled` / `agentEnabled`: whether the corresponding store is
 *   injected into the system prompt (`memory:global` / `memory:agent`
 *   sections, text thunks re-read the files on every assembly so editor saves
 *   take effect without a restart);
 * - `autoMemory`: the model may call the `memory_add` tool and facts are
 *   written straight to the agent store (deduped, timestamped);
 * - `askMemory`: the same tool call first asks the human through the approval
 *   seam (fail-closed when no approval service or a `never` session policy
 *   rejects), and only an `allowed-once` decision writes.
 *
 * The tool is registered only while `autoMemory || askMemory` holds, and the
 * registration follows every settings commit. Global memory is human-authored
 * through the editor; the tool always writes the calling agent's store.
 * @module @deepseek-ai/dsh-agent-memory
 */

import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, FinishReason, GenerateOptions, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import {
  appendMemory, memoryDir, readMemoryText, writeMemory,
  type MemoryAppendResult,
} from './storage.ts'

export * from './storage.ts'

/** Cordis plugin name. */
export const name = 'agent-memory'

/** Settings namespace carrying the four memory switches. */
export const SETTINGS_NAMESPACE = 'agent-memory'

/** The user-writable switch slice. */
export interface AgentMemorySettings {
  /** Inject the global memory store into the system prompt. */
  readonly globalEnabled: boolean
  /** Inject the calling agent's memory store into the system prompt. */
  readonly agentEnabled: boolean
  /** Let the model write facts to the agent store on its own judgment. */
  readonly autoMemory: boolean
  /** Ask the human before writing (implies autoMemory in UI availability). */
  readonly askMemory: boolean
}

/** Runtime schema: all four switches default to off. */
export const AgentMemorySettingsSchema: z<AgentMemorySettings> = z.object({
  globalEnabled: z.boolean().default(false),
  agentEnabled: z.boolean().default(false),
  autoMemory: z.boolean().default(false),
  askMemory: z.boolean().default(false),
})

/** System-prompt section names this plugin owns. */
export const GLOBAL_MEMORY_SECTION = 'memory:global'
export const AGENT_MEMORY_SECTION = 'memory:agent'

/** Section order: immediately after the persona, before tool/runtime prose. */
export const GLOBAL_MEMORY_ORDER = PERSONA_ORDER + 1
export const AGENT_MEMORY_ORDER = PERSONA_ORDER + 2

/** Combined preset ids are `<agentId>-<modeId>`; drop the mode to reach the agent. */
const COMBINED_PRESET_RE = /^(.+)-(?:standard|code|minimal|env-[a-z0-9-]+)$/

/**
 * Deduc the owning user-agent id from a preset id: a combined
 * `<agentId>-<modeId>` id resolves to `<agentId>`, anything else is itself.
 * @param presetId - the preset id bound to the session or agent.
 * @returns the agent id whose memory directory applies.
 */
export function agentIdOf(presetId: string): string {
  const match = COMBINED_PRESET_RE.exec(presetId)
  return match?.[1] ?? presetId
}

/** Canonical memory_add tool output. */
export interface MemoryAddValue {
  /** Whether a write landed. */
  readonly saved: boolean
  /** The agent store the write targeted. */
  readonly agentId?: string
  /** Outcome detail: the approval decision, or why nothing was written. */
  readonly outcome?: string
  /** The deduped fact that landed (or would have landed). */
  readonly content?: string
}

const MEMORY_ADD_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    saved: { type: 'boolean', required: true },
    agentId: { type: 'string' },
    outcome: { type: 'string' },
    content: { type: 'string' },
  },
} as const

const MEMORY_ADD_DESCRIPTION =
  'Add one fact to the current agent\'s long-term memory when the conversation '
  + 'reveals something the agent should remember across future sessions: stable '
  + 'preferences, work habits, durable decisions, or facts the human stated as '
  + 'lasting. Remember prose conclusions, not the raw exchange; merge related '
  + 'facts into one entry. Do not store credentials, one-off task details, or '
  + 'anything the human may have said is transient.'

/** The directive that turns selected conversation text into durable memory
 *  entries. Delivered as the final user message after the selected surface, so
 *  a model reads it as continuation rather than as a separate summarizer.
 *  Output is one memory entry per line, in the storage's bare content shape
 *  (the writer stamps and dedupes); a genuinely blank line is dropped. The
 *  rule is explicit NEVER to emit an "empty"/"none" placeholder token — the
 *  UI path writes real prose, so a placeholder is a model mistake we discard. */
const REMEMBER_INSTRUCTION =
  '你是一个长期记忆提炼引擎。用户从对话中圈选了下面这段内容，明确希望把它记入助手的长期记忆。'
  + '请把这些内容提炼成简短、稳定、可跨会话复用的记忆条目。'
  + '\n规则：'
  + '\n- 每行输出一条记忆内容本身（不带时间戳、不带 "- " 前缀、不带编号）。'
  + '\n- 用户既然圈选了它，请默认提取出其中明确、稳定的信息：称呼、偏好、习惯、约定、身份事实、项目背景。'
  + '\n- 把相关事实合并成一条；不要逐字复述，只提炼结论，但保留关键名称、数字、关系。'
  + '\n- 只有当整段内容完全是临时任务细节或含凭据、密钥时，才不输出条目（此时只输出一个真正的空行）。'
  + '\n- 用与对话片段一致的语言书写（对话是中文就用中文，是英文就用英文）。'
  + '\n- 严禁输出"空行""（空行）""无""没有""none"之类的占位文字。'

/** Result of one UI-driven remember: what AI analysis produced and wrote. */
export interface RememberValue {
  /** Whether at least one entry landed. */
  readonly saved: boolean
  /** The agent store the write targeted. */
  readonly agentId?: string
  /** Outcome detail: why nothing was written, or how many landed. */
  readonly outcome?: string
  /** The entries the analysis produced (before dedupe/stamp). */
  readonly entries?: readonly string[]
}

/**
 * Memory service: the harness-home stores, the switches, the prompt sections,
 * and the model-facing `memory_add` tool.
 */
export class AgentMemory extends Service {
  static inject = ['settings', 'systemPrompt', 'tools']

  /** Live settings scope, present once a settings provider is composed. */
  private settings: SettingsScope<AgentMemorySettings> | undefined

  /** Disposer of the currently registered `memory_add` tool, if any. */
  private toolDisposer: (() => void) | undefined

  constructor(ctx: Context, public config: object = {}) {
    super(ctx, 'agentMemory')

    // Switches, and the tool visibility that follows them.
    ctx.inject(['settings'], (settingsCtx) => {
      this.settings = settingsCtx.settings.register(
        settingsNamespace(SETTINGS_NAMESPACE),
        AgentMemorySettingsSchema,
        {},
      )
      const watch = this.settings.get()
      this.syncTool(watch)
      const disposer = this.settings.watch((next) => { this.syncTool(next) })
      settingsCtx.effect(() => () => {
        disposer()
        this.teardownTool()
        this.settings = undefined
      }, 'agent-memory: settings-scope teardown')
    })

    // Global memory: one always-registered section whose thunk re-reads the
    // store and the switch on every assembly.
    ctx.effect(() => ctx.systemPrompt.section({
      name: GLOBAL_MEMORY_SECTION,
      order: GLOBAL_MEMORY_ORDER,
      text: () => {
        if (this.settings?.get().globalEnabled !== true) return ''
        return renderMemoryText(readMemoryText())
      },
    }), 'agent-memory: global-memory section')

    // Agent memory: registered on each agent's own context, so the section
    // lands in that agent's prompt assembly only, closed over its agent id.
    // `agent/created` is a scope-filtered event (subject = the agent scope), so
    // a root listener needs `{ global: true }` to hear it. And `agent.id` is
    // the SessionId, not the preset id: the owning user-agent id comes from
    // the preset the agent joined (`composedPreset` -> `<agentId>-<modeId>`),
    // split back to `<agentId>`. Without both, the section never registers or
    // reads the wrong store, so the agent memory silently stays empty.
    ctx.on('agent/created', ({ agent }) => {
      const agentCtx = agent.ctx as Context
      const agentId = this.resolveAgentId(agent)
      agentCtx.effect(() => agentCtx.systemPrompt.section({
        name: AGENT_MEMORY_SECTION,
        order: AGENT_MEMORY_ORDER,
        text: () => {
          if (this.settings?.get().agentEnabled !== true) return ''
          return renderMemoryText(readMemoryText(agentId))
        },
      }), 'agent-memory: agent section')
    }, { global: true })
  }

  /** Global store text (editor read). */
  readGlobal(): string {
    return readMemoryText()
  }

  /** Global store save (editor write). */
  writeGlobal(text: string): void {
    writeMemory(text)
  }

  /** One agent store text (editor read). */
  readAgent(agentId: string): string {
    return readMemoryText(agentIdOf(agentId))
  }

  /** One agent store save (editor write). */
  writeAgent(agentId: string, text: string): void {
    writeMemory(text, agentIdOf(agentId))
  }

  /** Append one fact to an agent store (deduped, timestamped). */
  appendAgent(agentId: string, content: string): MemoryAppendResult {
    return appendMemory(content, agentIdOf(agentId))
  }

  /**
   * The user-agent id behind one live agent. `agent.id` is the SessionId, not
   * a preset id: the owning user agent is the preset the agent joined
   * (`composedPreset` -> `<agentId>-<modeId>`), split back to `<agentId>`.
   * @param agent - a live agent (or the slim `{ id, ctx }` shape).
   * @returns the user-agent id whose memory store applies.
   */
  resolveAgentId(agent: { id: string; ctx: Context }): string {
    const presets = this.ctx.get('agentPresets') as
      | { composedPreset(agentCtx: Context): string | undefined }
      | undefined
    const presetId = presets?.composedPreset(agent.ctx) ?? agent.id
    return agentIdOf(presetId)
  }

  /** Current switch snapshot (defaults when settings are absent). */
  switches(): AgentMemorySettings {
    return this.settings?.get() ?? {
      globalEnabled: false, agentEnabled: false, autoMemory: false, askMemory: false,
    }
  }

  /**
   * Analyze selected conversation text with the agent's own model and write the
   * resulting memory entries to the agent's store. This is the UI-driven path
   * (the memory button): the human selects a range of messages, and the model
   * condenses them into stable facts. The write always targets the calling
   * agent's store — never global — mirroring the tool's policy.
   * @param agent - the live agent whose model and store apply.
   * @param text - the selected conversation text to condense.
   * @returns whether anything landed, plus the entries and any outcome detail.
   */
  async remember(agent: Agent, text: string): Promise<RememberValue> {
    const agentId = this.resolveAgentId(agent)
    const { llm, config, signal } = this.rememberTarget(agent)
    if (llm === undefined) {
      return { saved: false, agentId, outcome: 'no llm service composed' }
    }
    if (config === undefined) {
      return { saved: false, agentId, outcome: 'no provider/model available for the agent' }
    }
    const trimmed = text.trim()
    if (trimmed === '') return { saved: false, agentId, outcome: 'empty selection' }

    const assembler = new BlockAssembler()
    const messages: Message[] = [
      createUserMessage({
        content: [{ type: 'text', text: trimmed }],
        source: { kind: 'plugin', plugin: 'dsh-agent-memory' },
      }),
      createUserMessage({
        content: [{ type: 'text', text: REMEMBER_INSTRUCTION }],
        source: { kind: 'plugin', plugin: 'dsh-agent-memory' },
      }),
    ]
    const options: GenerateOptions = {
      provider: config.provider,
      model: config.model,
      messages,
      sessionId: agent.session.id,
      ...signal === undefined ? {} : { signal },
    }
    try {
      for await (const chunk of llm.stream(options)) assembler.push(chunk)
    } catch (error: unknown) {
      return { saved: false, agentId, outcome: `analysis failed: ${String(error)}` }
    }
    const error = rememberFinishError(assembler.finish)
    if (error !== undefined) {
      return { saved: false, agentId, outcome: error }
    }
    const entries = splitEntries(assembler.blocks())
    if (entries.length === 0) {
      return { saved: false, agentId, outcome: 'nothing worth remembering' }
    }
    for (const entry of entries) this.appendAgent(agentId, entry)
    return { saved: true, agentId, entries, outcome: `remembered ${entries.length} entry` }
  }

  /**
   * Resolve the LLM service and the model target for one agent's remember call.
   * The model comes from the routed request header (the agent's real chat
   * model), falling back to the agent's own options. Consolidating this keeps
   * the remember path symmetric with {@link summarizeWithLlm} but hands the
   * AI-analysis step the model the human is actually talking to.
   */
  private rememberTarget(agent: Agent): {
    llm: { stream(options: GenerateOptions): AsyncIterable<StreamChunk> } | undefined
    config: { provider: string; model: string } | undefined
    signal: AbortSignal | undefined
  } {
    const llm = this.ctx.get('llm') as
      | { stream(options: GenerateOptions): AsyncIterable<StreamChunk> }
      | undefined
    const header = agent.session.requestHeader?.()
    const headerConfig = header?.config
    const config = headerConfig === undefined
      ? undefined
      : { provider: headerConfig.provider, model: headerConfig.model }
    return { llm, config, signal: undefined }
  }


  /** Register or drop the tool to match the switches. */
  private syncTool(settings: AgentMemorySettings): void {
    const want = settings.autoMemory || settings.askMemory
    if (want && this.toolDisposer === undefined) this.registerTool()
    else if (!want && this.toolDisposer !== undefined) this.teardownTool()
  }

  private teardownTool(): void {
    this.toolDisposer?.()
    this.toolDisposer = undefined
  }

  private registerTool(): void {
    const ctx = this.ctx
    this.toolDisposer = ctx.tools.register(defineTool({
      name: 'memory_add',
      description: MEMORY_ADD_DESCRIPTION,
      parameters: {
        text: {
          type: 'string',
          required: true,
          description: 'The stable fact to remember, in its final prose form.',
        },
      },
      output: {
        schema: MEMORY_ADD_VALUE_SCHEMA,
        render: (_args, value): ContentBlock[] => {
          const v = value as unknown as MemoryAddValue
          if (v.saved) {
            return [{ type: 'text', text: `记住：${v.content ?? ''}` }]
          }
          return [{ type: 'text', text: `未记住：${v.outcome ?? '未启用'}` }]
        },
      },
      execute: async (args: { text: string }, exec: ToolRunContext): Promise<MemoryAddValue> => {
        const switches = this.switches()
        if (!switches.autoMemory && !switches.askMemory) {
          return { saved: false, outcome: 'memory disabled' }
        }
        const agent = exec.agent
        if (agent === undefined) {
          return { saved: false, outcome: 'no calling agent' }
        }
        const agentId = this.resolveAgentId(agent)
        const text = args.text.trim()
        if (text === '') return { saved: false, outcome: 'empty fact', agentId }

        if (switches.askMemory) {
          const approval = ctx.get('approval') as
            | { request(req: unknown): Promise<ApprovalOutcome> }
            | undefined
          if (approval === undefined) {
            return { saved: false, outcome: 'no approval service', agentId }
          }
          const outcome = await approval.request({
            agent,
            toolName: 'memory_add',
            reason: `模型想把这条信息加入「${agentId}」的记忆：${shorten(text, 120)}`          })
          if (outcome !== 'allowed-once') {
            return { saved: false, outcome, agentId }
          }
        }

        const result = this.appendAgent(agentId, text)
        return {
          saved: true,
          agentId,
          content: result.content,
          outcome: result.appended ? 'appended' : result.refreshed ? 'refreshed' : 'unchanged',
        }
      },
    }))
  }
}

/** Cordis plugin entry: the memory service itself is the plugin. */
export default AgentMemory

/** Trim a long fact for a confirmation prompt. */
function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/** Map a terminal remember finish to a fail-closed outcome string. */
function rememberFinishError(finish: FinishReason): string | undefined {
  switch (finish.kind) {
    case 'error':
    case 'aborted': {
      return `analysis ${finish.kind}: ${finish.failure.message}`
    }
    case 'max-tokens': {
      return 'analysis truncated at the token cap'
    }
    default:
      return undefined
  }
}

/** Split model output text into bare memory entry lines (trimmed, blank-dropped). */
function splitEntries(blocks: readonly ContentBlock[]): string[] {
  const entries: string[] = []
  for (const block of blocks) {
    if (block.type !== 'text' || typeof block.text !== 'string') continue
    for (const raw of block.text.split(/\r?\n/)) {
      const line = stripInvisible(raw.trim().replace(/^[-*]\s+/, '').trim())
      if (line === '') continue
      // Discard obvious "nothing to remember" placeholders a model may emit
      // instead of a real entry: they are mistakes, never memory.
      if (isVacuousEntry(line)) continue
      entries.push(line)
    }
  }
  return entries
}

/**
 * Strip invisible/whitespace characters a model may emit around real prose
 * without being caught by `String.trim`: zero-width space, non-breaking space
 * variants, BOM, and the full Unicode White_Space set. This keeps a line that
 * is "visually blank but bytewise non-empty" (e.g. pure zero-width spaces)
 * from being written as a memory entry that renders as a block of blank.
 */
/** Strip invisible/whitespace characters a model may emit around real prose. */
export function stripInvisible(value: string): string {
  // Control chars (U+0000–U+001F, U+007F–U+009F), non-breaking/zero-width
  // space variants, BOM, and full-width space. Ordinary space (U+0020) is
  // deliberately outside the range so interior prose spaces survive; leading
  // and trailing whitespace is removed by .trim().
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u00AD\u1680\u2000-\u200B\u2028-\u202F\u205F-\u206F\u3000\uFEFF\uFFFD]/g, '')
    .trim()
}

/** Whether one candidate line is a vacuous "no content" placeholder. */
export function isVacuousEntry(line: string): boolean {
  const cleaned = stripInvisible(line)
  if (cleaned === '') return true
  const normalized = cleaned.toLowerCase().replace(/[\s（）()「」"'　\-*—–]+/g, '')
  return normalized === ''
    || normalized === '空行'
    || normalized === '无'
    || normalized === '没有'
    || normalized === '无内容'
    || normalized === '无值得记住的内容'
    || normalized === '暂无'
    || normalized === 'none'
    || normalized === 'no'
    || normalized === 'nothing'
    || normalized === 'na'
    || normalized === 'n/a'
}

/** Render memory prose with a labelled header for prompt injection. */
function renderMemoryText(text: string): string {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  return trimmed
}

/** Convenience: the directory the editor surfaces write into. */
export { memoryDir }
