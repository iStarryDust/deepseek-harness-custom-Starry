/**
 * Default one-shot summarization and durable checkpoint framing.
 *
 * @module @deepseek-ai/dsh-compaction-basic/summarizer
 */

import type { Context } from '@deepseek-ai/cordis'
import { contentHasImage, createUserMessage, BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock, FinishReason, GenerateOptions, Message, TokenUsage, ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'

interface SummaryConfig {
  readonly summarizationProvider: string
  readonly summarizationModel: string
  readonly maxTokens: number
}

/** Tags wrapping the structured summary inside the landed checkpoint node. */
const SUMMARY_OPEN_TAG = '<compacted-summary>'
const SUMMARY_CLOSE_TAG = '</compacted-summary>'

/** Output language for one checkpoint, chosen from the shadowed conversation. */
export type SummaryLanguage = 'zh' | 'en'

/**
 * The summarization directive, delivered as the FINAL user message after the
 * replayed conversation rather than as a distinct summarizer system prompt.
 * Keeping the conversation's own system prompt, tools, and message prefix in
 * front of it makes the auxiliary call a genuine prefix of the last routed
 * request, so the provider's KV cache is reused instead of invalidated.
 *
 * The directive is chosen by the shadowed conversation's dominant language:
 * a Chinese conversation gets the Chinese directive (so the checkpoint lands
 * in Chinese), anything else gets the English directive (the historical
 * default). File paths, commands, error strings, identifiers, and syntax stay
 * verbatim in either language.
 */
const COMPACTION_INSTRUCTION_ZH = [
  '你现在是这个 AI 编程助手的压缩引擎。把上面这段对话浓缩成一个结构化的检查点，让另一个模型能在不丢失任何关键上下文的前提下接续这份工作。',
  '',
  '严格按照下面的 Markdown 结构输出：保留每个小节及其顺序。使用简短的要点，不要写成段落。空的小节写"(none)"——绝不要漏掉任何小节。',
  '',
  '## 主要请求与意图',
  '- [用户的原始与不断演进的目标；当措辞本身关键时逐字引用]',
  '',
  '## 关键技术概念',
  '- [涉及的技术、框架、模式与约定]',
  '',
  '## 文件与代码',
  '- [准确路径：为什么重要、关键改动或代码片段]',
  '',
  '## 错误与修复',
  '- [错误：如何解决，以及相关的用户反馈]',
  '',
  '## 待办事项',
  '- [尚未完成的明确请求]',
  '',
  '## 当前进展',
  '- [本检查点时刻准确处于进行中的内容]',
  '',
  '## 下一步',
  '- [紧接的单个动作，直接对应最近的请求；没有则写"(none)"]',
  '',
  '## 关键上下文',
  '- [决策及其理由、约束、用户偏好、未决问题、继续所需的数据]',
  '',
  '规则：',
  '- 用简体中文撰写简洁的工程要点。保留准确的路径、命令、错误字符串、标识符、数字、函数签名与语法片段原文。',
  '- 忠实地记录用户的反馈与明确指示，尤其是纠正意见。',
  '- 不要提及本次压缩请求，也不要说上下文被压缩过。',
  '- 只输出检查点文本：不要调用任何工具，也不要采取其他动作。',
  `- 如果对话里已经有 ${SUMMARY_OPEN_TAG} 块，那是之前的检查点。不要逐字照搬它：保留仍然成立的事实，丢弃过时的信息，并把更新的内容合并进同一结构下的单一汇总。`,
].join('\n')

const COMPACTION_INSTRUCTION_EN = [
  'You are now acting as a compaction engine for this AI coding assistant. Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with no loss of essential context.',
  '',
  'Output EXACTLY the Markdown structure below: keep every section, in order. Use terse bullets, not prose paragraphs. Write "(none)" for an empty section — never drop a section.',
  '',
  '## Primary Request and Intent',
  "- [the user's original and evolving goals; quote verbatim where the exact wording matters]",
  '',
  '## Key Technical Concepts',
  '- [technologies, frameworks, patterns, and conventions in play]',
  '',
  '## Files and Code',
  '- [exact path: why it matters, key changes or snippets]',
  '',
  '## Errors and Fixes',
  '- [error: how it was resolved, plus any related user feedback]',
  '',
  '## Pending Jobs',
  '- [explicitly requested work not yet completed]',
  '',
  '## Current Work',
  '- [precisely what was in progress at this checkpoint]',
  '',
  '## Next Step',
  '- [the single next action, directly in line with the most recent request, or "(none)"]',
  '',
  '## Critical Context',
  '- [decisions and their rationale, constraints, user preferences, open questions, data needed to continue]',
  '',
  'Rules:',
  '- Write concise English engineering prose. Preserve exact file paths, commands, error strings, identifiers, numeric values, function signatures, and syntax fragments.',
  '- Capture user feedback and explicit instructions faithfully, especially corrections.',
  '- Do NOT mention this summarization request or that the context was compacted.',
  '- Output only the checkpoint text: do not call any tool or take any other action.',
  `- If the conversation already contains a ${SUMMARY_OPEN_TAG} block, it is a PRIOR checkpoint. Do not copy it forward verbatim: preserve still-true facts, drop stale ones, and merge newer information into a single consolidated summary under the same structure.`,
].join('\n')

/** Select the directive for the conversation's dominant language. */
export function compactionInstruction(language: SummaryLanguage): string {
  return language === 'zh' ? COMPACTION_INSTRUCTION_ZH : COMPACTION_INSTRUCTION_EN
}

/** Framing that makes the replacement user message established context. */
const CHECKPOINT_PREAMBLE_EN =
  'This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.'

const CHECKPOINT_PREAMBLE_ZH =
  '这是一份自动生成的检查点，浓缩了更早的一段对话以释放上下文。请把这里捕获的上下文当作既定背景并在其之上继续，无需复述。直接从事后接续的消息继续任务，不要提及本检查点。'

/** Select the framing preamble for the conversation's dominant language. */
export function checkpointPreamble(language: SummaryLanguage): string {
  return language === 'zh' ? CHECKPOINT_PREAMBLE_ZH : CHECKPOINT_PREAMBLE_EN
}

/** Whether a code point is a CJK ideograph (any supported extension). */
function isCjk(code: number): boolean {
  return (code >= 0x3400 && code <= 0x4DBF) // CJK Extension A
    || (code >= 0x4E00 && code <= 0x9FFF) // CJK Unified Ideographs
    || (code >= 0xF900 && code <= 0xFAFF) // CJK Compatibility Ideographs
    || (code >= 0x20000 && code <= 0x2FA1F) // CJK Extensions B+ (astral)
}

/**
 * Detect the dominant language of a conversation surface, using only the human
 * user's own messages (role 'user' with source kind 'user'). Tool results and
 * producer-injected context also project in the user role, but those are
 * machine-generated English (command walls, error dumps, system context), so
 * counting them would dilute the user's actual language; they are excluded. A
 * meaningful share of CJK ideographs is treated as Chinese, otherwise English
 * (the historical default). The threshold keeps a short quoted Chinese snippet
 * inside an otherwise-English exchange from flipping the verdict.
 * @param messages - shadowed conversation messages, in surface order.
 * @returns 'zh' when the human user's own text is predominately CJK, else 'en'.
 */
export function detectSummaryLanguage(messages: readonly Message[]): SummaryLanguage {
  let han = 0
  let latin = 0
  for (const message of messages) {
    // Tool results and injected producer context ride the user role but are
    // machine-produced (usually English); only the human user's own input
    // carries the conversation's real language.
    if (message.role !== 'user' || message.source.kind !== 'user') continue
    for (const block of message.content) {
      if (block.type !== 'text' || typeof block.text !== 'string') continue
      const text = block.text
      for (let index = 0; index < text.length; index += 1) {
        const code = text.codePointAt(index) ?? 0
        if (isCjk(code)) han += 1
        else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) latin += 1
      }
    }
  }
  return han > 0 && han >= latin * 0.2 ? 'zh' : 'en'
}

/**
 * The replayed conversation surface the summarizer condenses. Reproducing the
 * last routed request's system prompt, tools, and leading messages verbatim
 * lets the auxiliary call reuse the provider's warm prefix cache; the trailing
 * compaction instruction is then the only novel input.
 */
export interface SummarizationInput {
  /** The conversation's own system prompt, reused for prefix-cache alignment; absent for a system-less request. */
  readonly system?: string
  /** The conversation's tool schemas, reused for prefix-cache alignment; absent when the request carried none. */
  readonly tools?: readonly ToolSchema[]
  /** The shadowed region, in surface order, that precedes the compaction instruction. */
  readonly messages: readonly Message[]
}

/** Safe summary content plus the exact auxiliary call envelope recorded with it. */
export type SummaryResult = {
  summary: ContentBlock[]
  provider: string
  model: string
  maxTokens?: number
  /** Provider-reported usage for this summarization request. */
  usage?: TokenUsage
  /**
   * Language the directive was issued in, derived from the shadowed surface.
   * Absent for a custom summarizer override that did not report it; the
   * checkpoint then framers in English.
   */
  language?: SummaryLanguage
} & (
  | {
    /** Complete provider output before the text-only summary projection. */
    rawOutput: ContentBlock[]
    /** Identifies exactly one call through this context's `ctx.llm.stream()`. */
    llmStreamCall: true
  }
  | {
    /** Optional complete output from an unmarked template, remote, or other summarizer. */
    rawOutput?: ContentBlock[]
    /** An unmarked result does not identify a call through this context's LLM seam. */
    llmStreamCall?: never
  }
)

/**
 * Run the default cache-reusing `ctx.llm.stream()` summarization call: replay
 * the conversation prefix, then append the compaction instruction as the final
 * user message so the provider's warm prefix cache is reused.
 * @param ctx - context providing the LLM service.
 * @param config - resolved backend configuration.
 * @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
 * @param agent - supplies routed-model history, fallback model, and session id.
 * @param signal - optional cancellation forwarded to the adapter.
 * @returns safe text-only summary blocks and the exact call envelope and output.
 */
export async function summarizeWithLlm(
  ctx: Context,
  config: SummaryConfig,
  input: SummarizationInput,
  agent: Agent,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const latest = agent.session.requestHeader()?.config
  const configured = config.summarizationProvider.length === 0
    ? undefined
    : { provider: config.summarizationProvider, model: config.summarizationModel }
  const agentTarget = agent.options.provider !== undefined
    && agent.options.provider.length > 0
    && agent.options.model !== undefined
    && agent.options.model.length > 0
    ? { provider: agent.options.provider, model: agent.options.model }
    : undefined
  const target = configured ?? latest ?? agentTarget
  if (target === undefined) {
    throw new Error(
      'no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields',
    )
  }

  const language = detectSummaryLanguage(input.messages)
  const assembler = new BlockAssembler()
  const messages: Message[] = [
    ...input.messages,
    createUserMessage({
      content: [{ type: 'text', text: compactionInstruction(language) }],
      source: { kind: 'plugin', plugin: 'dsh-compaction-basic' },
    }),
  ]
  const options: GenerateOptions = {
    provider: target.provider,
    model: target.model,
    messages,
    ...input.system === undefined ? {} : { system: input.system },
    ...input.tools === undefined ? {} : { tools: [...input.tools] },
    maxTokens: config.maxTokens,
    sessionId: agent.session.id,
    purpose: 'compaction',
    ...signal === undefined ? {} : { signal },
  }
  for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
  const error = finishError(assembler.finish)
  if (error !== undefined) throw error

  const rawOutput = assembler.blocks()
  const summary = summaryText(rawOutput)
  if (!summary.some(block => block.text.trim().length > 0)) {
    throw new Error('summarization produced no text summary content')
  }
  return {
    summary,
    rawOutput,
    llmStreamCall: true,
    provider: options.provider,
    model: options.model,
    maxTokens: config.maxTokens,
    language,
    ...(assembler.usage === undefined ? {} : { usage: assembler.usage }),
  }
}

/**
 * Wrap raw summary blocks in the durable checkpoint framing.
 * @param summary - safe text-only model output.
 * @param language - language the directive was issued in, for the preamble.
 * @returns content for the synthesized replacement user message.
 */
export function frameSummary(summary: readonly ContentBlock[], language: SummaryLanguage = 'en'): ContentBlock[] {
  return [
    { type: 'text', text: `${checkpointPreamble(language)}\n\n${SUMMARY_OPEN_TAG}` },
    ...summary,
    { type: 'text', text: SUMMARY_CLOSE_TAG },
  ]
}

/** Map a terminal summarization finish to its fail-closed error. */
function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'error':
    case 'aborted': {
      const error = new Error(finish.failure.message) as Error & { code?: string }
      error.code = finish.failure.code
      return error
    }
    case 'max-tokens': {
      const error = new Error('summarization truncated at the token cap (incomplete checkpoint)') as Error & { code?: string }
      error.code = 'MAX_TOKENS'
      return error
    }
    default:
      return undefined
  }
}

/** Reject visual output and keep only text before synthesizing a user message. */
function summaryText(
  blocks: readonly ContentBlock[],
): Array<Extract<ContentBlock, { type: 'text' }>> {
  if (contentHasImage(blocks)) {
    throw new LlmError('compaction summary cannot contain image output', 'UNSUPPORTED_CONTENT')
  }
  return blocks.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
}
