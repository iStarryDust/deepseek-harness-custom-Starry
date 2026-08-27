# @deepseek-ai/dsh-client-ui-compact

English | [中文](README.zh.md)

Web turn-tail meta controls: contributes one entry to `conversation.chat.turnTailMeta` — the small icon action seat between the closing message clock and its run statistics in the settled turn-tail row.

The compact trigger dispatches the host `/compact` command through the existing [command chain](../../interaction/commands/README.md) (`remote.commands.execute`), so admission, the AI summarization, the range choice, and the durable lifecycle card all stay with [`dsh-compaction-basic`](../../compaction/compaction-basic/README.md) and [`dsh-command-compact`](../../compaction/command-compact/README.md); this package owns only the button and its transient feedback. While the command is in flight the trigger spins and ignores repeat clicks; an admitted command renders its own `/compact` card (nothing to add here), an admission failure shows the host's detail inline for a few seconds, and the button returns to idle either way.

The second button is the memory entry: it renders with the `IconAgentPresetOutline16` glyph. Clicking opens a selection dialog listing the current session's selectable user/assistant messages; after checking the ones worth keeping, 「记忆」 sends the checked text through the `agentMemory.remember` RPC to the host, where the session's own model condenses the exchange into stable memory entries written to the agent's long-term store (`<dshHome>/agent-memory/<agentId>/memory.md`). The dialog supports the empty state, cancel, and inline failure copy; its styling is a lightweight inline first pass, polished later.

Both buttons carry the same icon-action chrome as the copy/branch controls and a hover tooltip (`压缩消息` / `记忆`). Copy lives in the package's own `compact` locale namespace; styling uses tokens only.

## Model Experience

None, as this package renders a human-triggered compact command with host-owned outcomes and touches no prompt, message, schema, stream, or tool result. The compaction itself stays with [`dsh-compaction-basic`](../../compaction/compaction-basic/README.md). The memory button's AI analysis happens host-side (see [`dsh-agent-memory`](../../preset/agent-memory/README.md)); this package only collects the checked text and forwards it.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Compact is the no-argument form** — the host command takes no range or intensity parameters, so the button cannot yet ask for a whole-conversation squeeze or a custom span. A stronger mode needs a host-side programming surface over `compactRegion` before the UI can offer it.
- **Memory dialog styling is a first pass** — the selection window uses inline styles to get the flow working; deeper integration with the theme token system, message paging, and cross-page selection is deferred.
