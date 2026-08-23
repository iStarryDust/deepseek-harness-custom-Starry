# @deepseek-ai/dsh-agent-memory

English | [中文](README.zh.md)

Long-term memory for the DeepSeek Harness: two plain markdown stores under the harness home, four user switches, system-prompt injection, a model-facing `memory_add` tool, and a UI-driven `remember()` path. Together they let an agent keep stable facts across sessions without holding them in the conversation surface.

## Storage layout

The package owns one segment under the harness home, `<dshHome>/agent-memory` (a sibling of `.agent-presets`, resolved through `dshHomePath` so `$DSH_HOME` overrides and cross-platform homes both land correctly):

| Store | Path | Shared by |
|---|---|---|
| Global | `<dshHome>/agent-memory/global/memory.md` | every agent |
| Agent | `<dshHome>/agent-memory/<agentId>/memory.md` | one agent (one directory per agent) |

File shape: `# <title>` header lines are free text (the user edits them), and every memory entry is one `- [YYYY-MM-DD HH:mm] content` line. The timestamp is the entry's primary metadata: re-saving an entry refreshes its stamp, and a re-remembered identical fact refreshes instead of duplicating. Reads/writes are synchronous on purpose — prompt assembly calls the section thunk with no await point, and the files are tiny.

The agent id is **not** the `SessionId`. It is the user preset id, deduced from the combined `<agentId>-<modeId>` preset the agent joined (`composedPreset` → split back to `<agentId>`). `agentIdOf()` and `resolveAgentId()` own that split; the package invariant companion (`/invariant`, `dsh-agent-memory-invariant`) audits the layout at install time.

## Settings switches

Namespace `agent-memory` (all default **off**):

| Switch | Effect |
|---|---|
| `globalEnabled` | inject the global store into every system prompt (`memory:global`) |
| `agentEnabled` | inject this agent's store into its own system prompt (`memory:agent`) |
| `autoMemory` | the model may call `memory_add` and facts go straight to the agent store |
| `askMemory` | the same tool call first asks the human through the approval seam (fail-closed when no approval service or a `never` session policy rejects); only an `allowed-once` decision writes |

The `memory:global` / `memory:agent` section thunks re-read the store on every assembly, so editor saves take effect without a restart. The tool is registered only while `autoMemory || askMemory` holds, and follows every settings commit.

## Service API (`ctx.agentMemory`)

Public members exposed by the service (the plugin itself is `AgentMemory`):

| Member | Semantics |
|---|---|
| `readGlobal()` | global store text (editor read) |
| `writeGlobal(text)` | global store save (editor write) |
| `readAgent(agentId)` | one agent store text (editor read) |
| `writeAgent(agentId, text)` | one agent store save (editor write) |
| `appendAgent(agentId, content)` | append one fact to an agent store (deduped, timestamped) |
| `switches()` | current switch snapshot (defaults when settings are absent) |
| `remember(agent, text)` | UI-driven path: analyze selected conversation text with the agent's own model and write the resulting entries to the agent's store |
| `resolveAgentId(agent)` | the user-agent id behind one live agent |

### Write policy

Both the `memory_add` tool and `remember()` write **only** the calling agent's store — never global. Global memory is human-authored through the editor; the model-facing paths never touch it.

## The `memory_add` tool

Registered while `autoMemory || askMemory` holds. Takes one `text` parameter (a stable fact in final prose form), asks the human first when `askMemory` is on, and appends the deduped fact to the calling agent's store. It returns `{ saved, agentId?, outcome?, content? }`; the renderer shows `记住：…` on a save and `未记住：…` otherwise. It is told to remember prose conclusions, merge related facts, and never store credentials or one-off task details.

## Model Experience (the `remember()` UI path)

The UI memory button (`dsh-client-ui-compact`) collects the checked messages and sends them through the `agentMemory.remember` RPC. The host `remember()` resolves the agent's own LLM (`ctx.llm.stream()` with the agent's routed request header model) and condenses the selected text into one memory entry per output line. Blank lines and obvious "nothing to remember" placeholders are dropped (`isVacuousEntry`), and invisible/whitespace-only output is stripped (`stripInvisible`) so a visually-blank-but-bytewise-non-empty line never lands as a block of blanks. The write always targets the calling agent's store.

### Token effect

The remember path itself produces the model call; how many tokens it costs is bounded by the agent's own generation cap. This is not a compaction — it never rewrites the conversation surface.

## Known Limitations and Deferred Work

- **Injections are opt-in** — memory is only read into the prompt when a switch is on; the stores are inert otherwise.
- **Global memory is human-only** — there is no model-facing global write; the tool and the remember path both stay on the agent store by design.
- **No cross-agent sharing** — one agent's memories never surface in another agent's prompt.
- **Editor text is free-form** — header lines are not validated; only `- [timestamp] …` lines count as entries for dedupe.
