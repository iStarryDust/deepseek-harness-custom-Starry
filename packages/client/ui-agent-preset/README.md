# dsh-client-ui-agent-preset

English | [中文](README.zh.md)

The agent-preset surfaces: a chip on the new-session screen choosing the next session's **mode**, and a read-only label in the session header reporting which preset a session already runs. A General-settings default row and a roster-management settings section existed once, but were removed (2026-08-21): agent management lives in the sidebar (ui-agents), and a default preset that could point at an agent body misled more than it helped.

## Why it is a new-session choice

A session's preset is fixed when the session is created — the host refuses to adopt an existing session under a different one, because that session's history was produced under the first preset's tools. So this surface cannot be a live switch, and it says so: the chip's pick applies to the session about to start, while running sessions keep the composition they began with.

## The new-session chip

The chip sits beside the workspace picker on the new-session screen. It lives there rather than in the composer because that is where the choice is still open: a control that spends most of its life disabled belongs on the screen where it still works.

The chip offers **chat-time modes** only — the shipped system presets minus the meta `cordis` mode. Locally authored agents never appear here; the four shipped ids (`standard`, `code`, `minimal`, `cordis`) are what the pick reads, and `cordis` stays hidden because it is the meta preset offered to preset authors, not a mode a conversation can run under.

When a chat starts from an agent page, the `uiAgents` agent context routes the pick through a **combined preset**: the mode the user picks — or the default `standard` when the chip is left alone — is composed into `<agentId>-<modeId>` (mode composition plus the agent's persona), and that combined id is what gets staged and applied. The chip still reads as a plain mode (`modeIdFor` maps a combined id back to its mode for display), while the session that results belongs to the agent's chat history. The agent context is spent on apply (`consumePendingAgent`), so the next new session opens on the deployment default again.

The chip opens on the deployment default and its pick is *staged* — the screen precedes the session it would apply to. The stage reaches a session when one becomes current and is still blank, which covers both the session the workspace connect created and the blank one it reused; riding along on `sessions.create` would miss the second. It is spent on first use, so the next new session opens on the default again, exactly like the workspace picker beside it.

A session that has started is refused rather than queued: the host answers `agent-preset-locked`, and the stage is dropped instead of waiting for a session that will never accept it.

## The session-header label

The second surface, beside the session title: the preset THIS session runs, as static chrome. A control there would promise a switch the host refuses outright. It reads the preset from the session's own summary and resolves the display name against the roster. Forwarded `agent-preset/selected` owner events fold committed blank-session switches into that shared summary in every tab; the initiating tab may already have applied the RPC echo, and the merge is idempotent.

## What it reads and writes

Options and the current default both come from one `agentPreset.list` call. The roster already reports which id a session with no explicit choice gets, so the surfaces need no settings-schema introspection; the default lives in the `agent-presets` settings namespace's `default` field, which the host resolves at creation.

A locally authored preset is exactly as privileged as the plugins it names, so the list marks `user` rows rather than presenting every preset as shipped and vetted.

Preset files publish one unlocalized `name` and `description`, which Web uses for every `user` row and unknown `system` row. For the four shipped ids (`standard`, `code`, `minimal`, and `cordis`), Web resolves both fields from its active locale only when the roster marks the row `system`; an identically named `user` preset keeps its file metadata.

The surfaces re-read on `settings/changed` for the agent-presets namespace and on `connection/reset`: the roster is a live directory and the default is a settings field, so an external edit or a reconnect can both move it.

## When the surfaces are absent

A deployment that composes no presets answers with an empty roster, and the chip and the label both render nothing — every session then shares the host composition, and there is nothing to choose between. A session that records no preset shows no label and reads no roster.

## Model Experience

Indirectly, through the preset a later session is composed from; [`dsh-agent-presets`](../../preset/agent-presets/README.md) owns what that composition puts in front of the model.

#### KV Cache effect

No direct invalidation. Changing the default never touches a running session's prefix; a session created afterwards establishes its own prefix from its own composition.

## Known Limitations and Deferred Work

- **A preset without metadata is listed by id** — display text is optional, and a combined preset's name is composed from the agent name and mode name when either is absent.
- **The label names the preset, not the agent** — a combined preset reads as its mode; the agent it belongs to is the sidebar's business.
- **Composition edits are invisible to the page** — the files are edited outside the browser and nothing on the wire announces a file change, so the surfaces re-read on their own actions, `settings/changed`, and `connection/reset`, not on every disk edit.
