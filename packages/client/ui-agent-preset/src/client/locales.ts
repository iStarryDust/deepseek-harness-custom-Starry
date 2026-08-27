/** Locale bundles for the agent-preset settings row, hero chip, header label, and management section. */

/** Locale keys these surfaces render. */
export type AgentPresetSettingsKey =
  | 'title' | 'description' | 'loading' | 'error' | 'userTrust' | 'seatHint' | 'headerHint'
  | 'nav' | 'sectionIntro' | 'builtIn' | 'setDefault' | 'view'
  | 'presetStandardName' | 'presetStandardDescription'
  | 'presetCodeName' | 'presetCodeDescription'
  | 'presetMinimalName' | 'presetMinimalDescription'
  | 'presetCordisName' | 'presetCordisDescription'
  | 'defineModeName' | 'defineModeDescription' | 'defineNameLabel' | 'defineNamePlaceholder'
  | 'defineDescriptionLabel' | 'defineDescriptionPlaceholder'
  | 'defineGroupIntro' | 'defineCreate' | 'defineCreating'
  | 'defineAnalyze' | 'defineAnalyzing' | 'defineAnalyzeEmpty'
  | 'defineNameRequired' | 'defineEmptyGroups' | 'defineFailed'
  | 'capShellName' | 'capShellDescription'
  | 'capFilesName' | 'capFilesDescription'
  | 'capFileSearchName' | 'capFileSearchDescription'
  | 'capAskUserName' | 'capAskUserDescription'
  | 'capTodoName' | 'capTodoDescription'
  | 'capJobsName' | 'capJobsDescription'
  | 'capSkillsName' | 'capSkillsDescription'
  | 'capGoalsName' | 'capGoalsDescription'
  | 'capWebName' | 'capWebDescription'
  | 'capBrowserName' | 'capBrowserDescription'
  | 'capPlanName' | 'capPlanDescription'
  | 'capCompactionName' | 'capCompactionDescription'
  | 'capSubagentsName' | 'capSubagentsDescription'
  | 'capWorkflowsName' | 'capWorkflowsDescription'
  | 'capRalphName' | 'capRalphDescription'
  | 'duplicate' | 'duplicateUnavailable' | 'delete' | 'presetId' | 'presetIdPlaceholder' | 'copyOf'
  | 'displayName' | 'displayNamePlaceholder'
  | 'inUse' | 'noDescription' | 'builtInGroup' | 'customGroup'
  | 'brokenBadge' | 'brokenNoCopy'
  | 'composition' | 'cancel' | 'close' | 'retry'
  | 'copyTitle' | 'copyIntro' | 'create' | 'creating' | 'creatorDraft'
  | 'openLocation' | 'showLocation' | 'revealedPathLabel'
  | 'idRequired' | 'idInvalid' | 'idTaken'
  | 'deleteTitle' | 'deleteDescription' | 'deleteConfirm' | 'deleting'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent-preset surface copy (hero chip, header label). */
    'settings.agentPreset': AgentPresetSettingsKey
  }
}

/** English copy. */
export const en: Record<AgentPresetSettingsKey, string> = {
  title: 'Agent preset',
  description: 'Applies to sessions you start from now on. Running sessions keep the preset they began with.',
  loading: 'Loading presets…',
  error: 'Could not load agent presets.',
  userTrust: 'Custom',
  seatHint: 'Agent preset for the session you are about to start',
  headerHint: 'The agent preset this session runs, fixed when it started',
  nav: 'Agent presets',
  sectionIntro:
    'A preset is the plugin composition one session\'s agent runs — its tools, prompt, and capabilities. '
    + 'Duplicate an existing one and make it yours, or let the agent draft one for you in Creator mode.',
  builtIn: 'Built-in',
  setDefault: 'Set as default',
  view: 'View',
  presetStandardName: 'Standard mode',
  presetStandardDescription:
    'Full coding agent with file editing, shell, file and web search, skills, planning, goals, subagents, and workflows.',
  presetCodeName: 'PTC mode',
  presetCodeDescription:
    'All Standard mode capabilities, with tools exposed through the Code Mode SDK so the model can combine multi-step operations in one TypeScript program.',
  presetMinimalName: 'Minimal mode',
  presetMinimalDescription:
    'Two-tool coding agent with persistent bash and str_replace_editor.',
  presetCordisName: 'Creator mode',
  presetCordisDescription:
    'Built for creating custom agent presets, with all Standard mode capabilities plus runtime inspection, plugin experiments, and preset-authoring guidance.',
  defineModeName: 'Define mode',
  defineModeDescription:
    'Define the working environment this agent needs for the conversation; only the tools it requires are loaded.',
  defineNameLabel: 'Environment name',
  defineNamePlaceholder: 'e.g. Game development',
  defineDescriptionLabel: 'Description',
  defineDescriptionPlaceholder: 'e.g. Build and test a game, needing shell, file editing, and web search.',
  defineGroupIntro: 'Choose the capabilities this environment needs',
  defineAnalyze: 'Analyze with the model',
  defineAnalyzing: 'Analyzing…',
  defineAnalyzeEmpty: 'Describe the environment first, then analyze it.',
  defineCreate: 'Create & use',
  defineCreating: 'Creating…',
  defineNameRequired: 'Give the environment a name.',
  defineEmptyGroups: 'Select at least one capability.',
  defineFailed: 'Could not compose the environment.',
  capShellName: 'Shell',
  capShellDescription: 'Run bash / PowerShell commands, including a persistent shell.',
  capFilesName: 'File editing',
  capFilesDescription: 'Read and write files and directories in the workspace.',
  capFileSearchName: 'File search',
  capFileSearchDescription: 'Search for files and content across the workspace.',
  capAskUserName: 'Ask the user',
  capAskUserDescription: 'Ask the human a question to resolve a choice or ambiguity.',
  capTodoName: 'To-do list',
  capTodoDescription: 'Keep a structured task list and track progress across a turn.',
  capJobsName: 'Background jobs',
  capJobsDescription: 'Collect, inspect, and stop long-running background commands.',
  capSkillsName: 'Skills',
  capSkillsDescription: 'Load and run repository and global instruction skills.',
  capGoalsName: 'Goals',
  capGoalsDescription: 'Track a long-running completion objective across autonomous rounds.',
  capWebName: 'Web search',
  capWebDescription: 'Search the web for current information and cite sources.',
  capBrowserName: 'Browser',
  capBrowserDescription: 'Open, render, and interact with web pages in a built-in browser.',
  capPlanName: 'Plan mode',
  capPlanDescription: 'Plan before implementing, in a plan-only mode the model must exit.',
  capCompactionName: 'Context compaction',
  capCompactionDescription: 'Compact a long conversation so the model keeps a working memory.',
  capSubagentsName: 'Sub-agents',
  capSubagentsDescription: 'Spawn and fork child sub-agents for parallel or delegated work.',
  capWorkflowsName: 'Workflows',
  capWorkflowsDescription: 'Run multi-step coordinated workflows across the delegation engine.',
  capRalphName: 'Ralph loop',
  capRalphDescription: 'Run a fresh-agent iterative loop toward one immutable objective.',
  duplicate: 'Duplicate',
  duplicateUnavailable: 'This deployment has no writable preset directory',
  delete: 'Delete',
  presetId: 'Identifier',
  presetIdPlaceholder: 'my-agent',
  displayName: 'Name',
  displayNamePlaceholder: 'Shown in the picker; defaults to the identifier',
  inUse: 'In use',
  builtInGroup: 'Built-in',
  customGroup: 'Custom',
  noDescription: 'No description.',
  brokenBadge: 'Failed to load',
  brokenNoCopy: 'A preset that failed to load cannot be duplicated',
  copyOf: 'Copied from',
  composition: 'Composition (agent.cordis.yml)',
  cancel: 'Cancel',
  close: 'Close',
  retry: 'Retry',
  copyTitle: 'Duplicate preset',
  copyIntro:
    'The whole preset is copied on this machine. The identifier becomes its directory name and cannot '
    + 'be changed later; everything else is edited in the preset\'s own files.',
  create: 'Create',
  creating: 'Creating…',
  creatorDraft: 'Draft a custom preset with Creator mode',
  openLocation: 'Open folder',
  showLocation: 'Show location',
  revealedPathLabel: 'Preset files:',
  idRequired: 'Give the preset an identifier.',
  idInvalid: 'Use lowercase letters, digits, and hyphens, starting with a letter or digit.',
  idTaken: 'A preset with this identifier already exists.',
  deleteTitle: 'Delete this preset?',
  deleteDescription:
    'The preset directory is deleted. Sessions already running on it keep working; new sessions cannot select it.',
  deleteConfirm: 'Delete',
  deleting: 'Deleting…',
}

/** Simplified Chinese copy. */
export const zh: Record<AgentPresetSettingsKey, string> = {
  title: 'Agent 预设',
  description: '对此后新建的会话生效。运行中的会话保持它开始时的预设。',
  loading: '正在加载预设…',
  error: '无法加载 Agent 预设。',
  userTrust: '自定义',
  seatHint: '即将开始的这个会话所用的 Agent 预设',
  headerHint: '本会话运行的 Agent 预设，开始时即固定',
  nav: 'Agent 预设',
  sectionIntro: '预设即一个会话的 Agent 所运行的插件组装 —— 它的工具、提示词与能力。复制一份既有预设改成自己的，或用「创造模式」让 Agent 帮你创建。',
  builtIn: '内置',
  setDefault: '设为默认',
  view: '查看',
  presetStandardName: '标准模式',
  presetStandardDescription: '功能完整的编码 Agent，支持文件编辑、Shell、文件与网页检索、Skills、计划、目标、子代理和工作流。',
  presetCodeName: 'PTC 模式',
  presetCodeDescription: '具备标准模式的全部能力，并通过 Code Mode SDK 呈现工具，让模型用一个 TypeScript 程序组合多步操作。',
  presetMinimalName: '极简模式',
  presetMinimalDescription: '仅提供持久 bash 与 str_replace_editor 的双工具编码 Agent。',
  presetCordisName: '创造模式',
  presetCordisDescription: '用于创建自定义 Agent preset：具备标准模式的全部能力，并提供运行时检查、插件实验和 preset 创作指导。',
  defineModeName: '定义模式',
  defineModeDescription: '为该 Agent 定义本次对话所需的工作环境，只加载它需要的能力，而不是全部工具。',
  defineNameLabel: '环境名称',
  defineNamePlaceholder: '例如：开发游戏环境',
  defineDescriptionLabel: '描述',
  defineDescriptionPlaceholder: '例如：需要 shell、文件编辑与网页检索来开发和测试游戏。',
  defineGroupIntro: '选择该环境需要的能力',
  defineAnalyze: '用模型分析',
  defineAnalyzing: '正在分析…',
  defineAnalyzeEmpty: '请先填写描述，再让模型分析。',
  defineCreate: '创建并使用',
  defineCreating: '正在创建…',
  defineNameRequired: '请填写环境名称。',
  defineEmptyGroups: '请至少勾选一项能力。',
  defineFailed: '无法创建该环境。',
  capShellName: '终端',
  capShellDescription: '运行 bash / PowerShell 命令，并支持持久 shell。',
  capFilesName: '文件读写',
  capFilesDescription: '在工作区中读写文件和目录。',
  capFileSearchName: '文件检索',
  capFileSearchDescription: '在工作区中检索文件和内容。',
  capAskUserName: '提问用户',
  capAskUserDescription: '向用户提问，以解决需要用户决定的选择或歧义。',
  capTodoName: '待办清单',
  capTodoDescription: '维护结构化任务列表，并在回合间跟踪进度。',
  capJobsName: '后台任务',
  capJobsDescription: '收集、查看并停止长时间运行的后台命令。',
  capSkillsName: '技能',
  capSkillsDescription: '加载并运行仓库与全局指令技能。',
  capGoalsName: '目标',
  capGoalsDescription: '跨自主回合跟踪一个长期完成目标。',
  capWebName: '网页检索',
  capWebDescription: '检索网页获取最新信息并引用来源。',
  capBrowserName: '浏览器',
  capBrowserDescription: '在内置浏览器中打开、渲染并交互网页。',
  capPlanName: '计划模式',
  capPlanDescription: '先计划再实现，模型必须退出的纯计划模式。',
  capCompactionName: '上下文压缩',
  capCompactionDescription: '压缩很长的对话，让模型保持可用的工作记忆。',
  capSubagentsName: '子代理',
  capSubagentsDescription: '分叉、启动并协调子代理，用于并行或委派工作。',
  capWorkflowsName: '工作流',
  capWorkflowsDescription: '在委派引擎上运行多步协调工作流。',
  capRalphName: 'Ralph 循环',
  capRalphDescription: '朝一个不可变目标运行全新的独立循环迭代。',
  duplicate: '复制',
  duplicateUnavailable: '此部署未配置可写的预设目录',
  delete: '删除',
  presetId: '标识符',
  presetIdPlaceholder: 'my-agent',
  displayName: '名称',
  displayNamePlaceholder: '选择器中显示的名字，缺省用标识符',
  inUse: '当前使用',
  builtInGroup: '内置',
  customGroup: '自定义',
  noDescription: '暂无描述。',
  brokenBadge: '加载失败',
  brokenNoCopy: '预设加载失败，不能复制',
  copyOf: '复制自',
  composition: '组装（agent.cordis.yml）',
  cancel: '取消',
  close: '关闭',
  retry: '重试',
  copyTitle: '复制预设',
  copyIntro: '整个预设会在本机复制一份。标识符将成为目录名，事后无法更改；其余内容之后直接在预设自己的文件里编辑。',
  create: '创建',
  creating: '正在创建…',
  creatorDraft: '用「创造模式」创作自定义预设',
  openLocation: '打开目录',
  showLocation: '查看路径',
  revealedPathLabel: '预设文件：',
  idRequired: '请填写标识符。',
  idInvalid: '只能使用小写字母、数字与连字符，且以字母或数字开头。',
  idTaken: '该标识符已被占用。',
  deleteTitle: '删除该预设？',
  deleteDescription: '预设目录将被删除。已在其上运行的会话不受影响；新会话将无法再选择它。',
  deleteConfirm: '删除',
  deleting: '正在删除…',
}

/** Preset roster fields needed to resolve Web display copy. */
export interface PresetDisplaySource {
  /** Stable preset id. */
  readonly id: string
  /** Whether the deployment ships the preset or the user owns it. */
  readonly trust: 'system' | 'user'
  /** Unlocalized name published by the preset. */
  readonly name?: string
  /** Unlocalized description published by the preset. */
  readonly description?: string
}

/** Display copy resolved for the active Web locale. */
export interface PresetDisplayText {
  /** Localized built-in name or the preset's own fallback name. */
  readonly name: string
  /** Localized built-in description or the preset's own description. */
  readonly description?: string
}

interface PresetLocaleKeys {
  readonly name: AgentPresetSettingsKey
  readonly description: AgentPresetSettingsKey
}

const BUILT_IN_PRESET_KEYS: Readonly<Partial<Record<string, PresetLocaleKeys>>> = {
  standard: { name: 'presetStandardName', description: 'presetStandardDescription' },
  code: { name: 'presetCodeName', description: 'presetCodeDescription' },
  minimal: { name: 'presetMinimalName', description: 'presetMinimalDescription' },
  cordis: { name: 'presetCordisName', description: 'presetCordisDescription' },
}

/**
 * Resolve preset display copy without making user-authored metadata translatable.
 * @param preset - roster row whose copy is being rendered.
 * @param t - active Web locale lookup.
 * @returns localized copy for a known shipped preset, otherwise file metadata.
 */
export function presetDisplayText(
  preset: PresetDisplaySource,
  t: (key: AgentPresetSettingsKey) => string,
): PresetDisplayText {
  const keys = preset.trust === 'system' ? BUILT_IN_PRESET_KEYS[preset.id] : undefined
  if (keys !== undefined) return { name: t(keys.name), description: t(keys.description) }
  return {
    name: preset.name ?? preset.id,
    ...preset.description === undefined ? {} : { description: preset.description },
  }
}

/** One capability group's localized copy, or the Host's own fallback. */
export interface CapabilityDisplayText {
  /** Localized group name, or the Host's English default. */
  readonly name: string
  /** Localized group description, or the Host's English default. */
  readonly description: string
}

/** Localized keys for the environment capability groups, by group id. */
const CAPABILITY_KEYS: Readonly<Partial<Record<string, PresetLocaleKeys>>> = {
  shell: { name: 'capShellName', description: 'capShellDescription' },
  files: { name: 'capFilesName', description: 'capFilesDescription' },
  'file-search': { name: 'capFileSearchName', description: 'capFileSearchDescription' },
  'ask-user': { name: 'capAskUserName', description: 'capAskUserDescription' },
  todo: { name: 'capTodoName', description: 'capTodoDescription' },
  jobs: { name: 'capJobsName', description: 'capJobsDescription' },
  skills: { name: 'capSkillsName', description: 'capSkillsDescription' },
  goals: { name: 'capGoalsName', description: 'capGoalsDescription' },
  web: { name: 'capWebName', description: 'capWebDescription' },
  browser: { name: 'capBrowserName', description: 'capBrowserDescription' },
  plan: { name: 'capPlanName', description: 'capPlanDescription' },
  compaction: { name: 'capCompactionName', description: 'capCompactionDescription' },
  subagents: { name: 'capSubagentsName', description: 'capSubagentsDescription' },
  workflows: { name: 'capWorkflowsName', description: 'capWorkflowsDescription' },
  ralph: { name: 'capRalphName', description: 'capRalphDescription' },
}

/**
 * Resolve a capability group's display copy for the active Web locale, falling
 * back to the Host's English default when no key is published for a group.
 * @param group - the capability group row from `agentPreset.capabilities`.
 * @param t - active Web locale lookup.
 * @returns localized copy for a known group, otherwise the Host's text.
 */
export function capabilityDisplayText(
  group: { id: string; name: string; description: string },
  t: (key: AgentPresetSettingsKey) => string,
): CapabilityDisplayText {
  const keys = CAPABILITY_KEYS[group.id]
  if (keys === undefined) return { name: group.name, description: group.description }
  return { name: t(keys.name), description: t(keys.description) }
}
