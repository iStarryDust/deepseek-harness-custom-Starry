# dsh-client-ui-agents

English | [中文](README.zh.md)

The agent-management surface: the sidebar's agent browser — a roster of the user's agents, the create/edit identity forms, and one agent's page showing its own chat history. An agent is identity only (name / language / persona); capabilities arrive at chat time through a **combined preset** built from a mode and the agent's persona. The package is a pure UI plugin: the host-side `apply` is empty, and the browser half ships through `exports["./client"]`, registered into the sidebar shell's `sidebar.workspaces` hole at a lower priority than the workspace browser so the agent surface shadows it.

## Why agents are identity only

An agent's creation form collects exactly three fields — name, language, and persona. No base-mode selector exists, because a mode is a chat-time capability choice, not an attribute of the agent. The agent preset that gets created (`agentPresets.create` with `from: 'minimal'`) carries only the identity; what tools a conversation gets is decided when the chat starts. This is the inverse of the original preset flow, where an agent *was* a mode plus a persona and the two could never be separated.

## The combined-preset mechanism

Starting a chat from an agent page opens the hero's mode pick with exactly the three shipped system modes (`standard`, `code`, `minimal`; the meta `cordis` mode stays hidden). Picking one — or accepting the default `standard` — composes a **combined preset**:

- The combined id is deterministic: `<agentId>-<modeId>`, e.g. `agent-mt1m0r75-standard`.
- It is created once (`agentPresets.create` with `from: <modeId>`, name `<agent name>（<mode name>）`) and reused on every later pick of the same pair, so the same (agent, mode) pair always resolves to the same session composition.
- **One agent is one folder**: a combined preset's files live at `<agentId>/modes/<modeId>/` under the writable preset root — never as a sibling directory — so `~/.dsh/.agent-presets/agent-mt1m0r75/modes/standard/` holds the standard-mode composition while the agent's identity files sit at the top of its folder. Discovery expands those nested directories back into the flattened `<agentId>-<modeId>` ids the session layer binds.
- The session binds the combined preset at creation, so it belongs to the agent's chat history.
- A bare-mode session (`standard` / `code` / `minimal` with no agent prefix) belongs to no agent and never appears in any agent's history.

The `pending` agent context is staged by `startChat`, spent when the seat applies the preset (`consumePendingAgent`), and composed through `composeForPendingAgent(modeId)`.

## Chat-history ownership and ordering

Each agent page lists only the sessions that belong to it: a session whose recorded `agentPreset` equals the agent id or starts with `<agentId>-` (any of its combined presets). Everything else — other agents' sessions, bare-mode sessions, subagent children — is excluded. The list sorts by the session's last-activity time (`updatedAt`) newest first, and entering an agent opens its most recent chat on the right. The browser reads the full session snapshot and filters in-render, because a `useSyncExternalStore` selector closing over the current selection would not re-run when the selection moves while the session list itself is unchanged.

## Cascading edit and delete

Editing an agent's identity rewrites the agent preset and every existing combined preset under its id prefix, so a persona fix lands in all of that agent's chats. Deleting an agent first removes its combined presets, then the agent preset itself — no ghost combinations are left behind. Combined presets never appear in the roster ("My Agents" lists user agents only) and cannot be entered or edited as agents.

## The surfaces

- **Roster** — the default sidebar page: a collapsible "My Agents" list. Creation is not a button here; it lives on the shell's primary control, which reads as "Create Agent" on this page and "Back" inside an agent page.
- **Agent page** — the selected agent's name with two fixed actions above its chat history: "New Chat" and "Agent Profile".
- **Create / Edit** — the identity forms. The edit form shares the create fields, prefills from the host, and carries a "Delete" action beside "Confirm".

## The conversation gate

While the browser shows the roster or the create form, a shadow occupant for the `conversation` slot keeps the right side a clean blank page. Inside an agent page the shadow is retired and the real conversation takes over, so the right column reads as the agent's own workspace.

## How it reads and writes

All roster and preset operations go through `agentPresets.list / read / create / update / remove`; opening a chat history row calls `sessions.open`, and starting a chat calls `workspaces.startSession` with the pending agent staged. The controller exposes the pending-agent face (`pendingAgent`, `composeForPendingAgent`, `modeIdFor`, `consumePendingAgent`) for the hero chip (ui-agent-preset) to route its mode pick through.

## Model Experience

Through the combined preset a later session is composed from: the mode's tool roster plus the agent's persona folded in. [`dsh-agent-presets`](../../preset/agent-presets/README.md) owns what that composition puts in front of the model.

#### KV Cache effect

No direct invalidation. Each session establishes its own prefix from its own composition; editing a persona changes what future combined presets fold in, never a running session's prefix.

## Known Limitations and Deferred Work

- **Ownership is durable in the session log.** A session's `agentPreset` is recorded in the session log — the header's `agentPreset` field, plus the `agent-preset/selected` event appended when the preset is switched while the session is blank (the event wins). The host's `session.list` resolves ownership for cold sessions straight from disk, so the binding survives restarts. Only the runtime selection/open state is not restored across restarts; a page refresh restores it.
- **Persona edits are not live.** A running session keeps the composition it began with; a persona edit applies to chats started afterwards.
