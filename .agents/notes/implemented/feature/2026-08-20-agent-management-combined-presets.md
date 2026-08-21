# Agent Note: Agent management with combined presets

Status: implemented

English | [中文](2026-08-20-agent-management-combined-presets.zh.md)

## Problem

An agent was inseparable from a base mode: creating one copied a mode's composition (`standard` / `code` / `minimal`) plus a persona, so "agent" and "mode" were the same axis. Users could not browse agents as identities, every agent's chats mixed together in one session list, and starting a chat from an agent with a different mode silently produced a session that no longer belonged to that agent. The new-session screen offered five choices (three modes, the meta `cordis` mode, and the user's agents) in one selector.

## Decision

**An agent is identity only.** `ui-agents` (new client package) owns the sidebar agent browser: name / language / persona on creation, with no base-mode selector. The agent preset created (`agentPresets.create` with `from: 'minimal'`) carries identity alone.

**A mode is a chat-time capability choice.** Starting a chat from an agent page opens the hero's mode pick with exactly the three shipped system modes (`standard`, `code`, `minimal`; `cordis` stays hidden). Picking one — or the default `standard` — composes a **combined preset** `<agentId>-<modeId>`: a deterministic `agentPresets.create` from the chosen mode with the agent's identity folded in, created once and reused. The session binds the combined preset, so it belongs to the agent's chat history; a bare-mode session belongs to no agent.

**One agent is one folder.** A combined preset's files live at `<agentId>/modes/<modeId>/` under the writable preset root, never as a sibling directory, so `~/.dsh/.agent-presets/<agentId>/` holds the identity files at its top and every mode's composition nested below. Discovery expands the nested directories back into the flattened `<agentId>-<modeId>` ids, keeping the session layer, the wire API, and the browser untouched; authoring resolves a combined id to its nested directory when the owning agent exists.

**Chat history is exclusive and ordered.** `agentChats` matches a session's recorded `agentPreset` against the agent id or the `<agentId>-` prefix and sorts by `updatedAt` newest first. The browser reads the full session snapshot and filters in-render, because a `useSyncExternalStore` selector closing over the selection would not re-run when the selection moves but the session list does not.

**Edit and delete cascade.** Updating an agent rewrites its combined presets too; deleting removes them first, then the agent preset. Combined presets never appear in the roster.

**One seat applies the stage.** The hero chip (ui-agent-preset) receives an `uiAgents` agent context (`pendingAgent`, `composeForPendingAgent`, `modeIdFor`, `consumePendingAgent`) so the mode pick stages the combined id, spends the context on apply, and reads as a plain mode.

## Alternatives considered

**Keep the base-mode selector and record ownership by prefix only.** Rejected: sessions started under a bare mode still escaped the agent, and the selector's five-way split remained confusing.

**Store agent ownership in a session field.** Rejected: the running session list already carries `agentPreset`; deriving ownership from the combined id keeps the durable log unchanged.

**Filter with a `useSessions` selector.** Rejected: the selector caches on its source, so switching agents with an unchanged session list kept showing the previous agent's chats.

## Consequences

The Web GUI is now organized around agents as identities, with capability chosen at chat start. The three-mode pick replaces the five-way selector. `packages/client/ui-agents/README.md` is the behavioral home; the user-global `~/.dsh/AGENTS.md` broadcasts the current layout to every agent session. Ownership is durable in the session log: a session's `agentPreset` is recorded in the header and (when switched while blank) in a trailing `agent-preset/selected` event, and `session.list` resolves cold sessions from disk, so the binding survives restarts; only the runtime selection/open state is process-bound. Note added 2026-08-21: an earlier draft of this note claimed ownership was runtime-bound; session probes after a restart proved it durable.
