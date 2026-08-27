# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Custom distribution (iStarryDust fork)

This is a customized fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (**`0.1.1-rc.2`**), adding an **agent-as-identity** management layer on top of the official release.

### What's different from upstream

| Area | Upstream DeepSeek Harness | This repository |
|---|---|---|
| `packages/client/ui-agents` | — | **New**: agent management UI (sidebar roster, create/edit forms, per-agent chat history) |
| Agent identity | fixed per process | **agent-as-identity**: name / language / description / persona per agent; capability chosen per new session (standard / PTC / minimal) |
| Preset layout | flat directory | nested under `agent/modes/<mode>/`; new session composes `<agentId>-<modeId>` presets |
| Session from agent page | delayed hero binding | **direct composed-preset binding** |
| Persona row | persona + language + runtime template | language instruction + working-directory line + persona text |
| `session.remove` | injected bug | **fixed** |
| Settings agent-preset entry | default row + management section | moved into the sidebar agent list |
| `packages/web/browser` | — | **New**: built-in browser plugin (Playwright Chromium under `~/.dsh/browser`; the agent opens and interacts with pages via `browser_open` / `browser_interact`) |
| `packages/compaction` | abstract seam | **Enhanced**: a turn-tail compact trigger (`ui-compact`), the `CompactionEngine` seam (`ctx.compaction`), tool-result pruning, and a `/compact` command |
| `packages/preset/agent-memory` | — | **New**: long-term agent memory — markdown stores under `<dshHome>/agent-memory`, four switches (global / agent / auto / ask), prompt injection, a `memory_add` tool, and a UI memory button that condenses selected messages with the agent's own model |
| `packages/extensions/dsh-schedule-toggle` | — | **New**: a **定时提醒 (Schedule reminders)** switch on the web Settings → General page; toggles the `time-context` + `schedule` plugins through the profile `cordis.patch.yml` (hot-reloaded, no restart). Ships agent skills `web-schedule`, `web-browser`, and `agent-memory` for the schedule / built-in-browser / memory workflows |
| `packages/preset/agent-presets` | full `standard` tool set | **New: "Define mode"** — per-agent on-demand environment. Tick the capabilities a conversation needs (shell / file editing / file search / ask-the-user / to-dos / background jobs / skills / goals / web search / browser / plan mode / compaction / sub-agents / workflows / Ralph loop etc., with split groups as independently toggleable sub-capabilities) in the Web UI; the host mints a one-off combined preset (`<agentId>-env-<slug>`) and binds it to the blank session. The composition is a **strict subset** of `standard`, and the host can analyze a description over the session's own model route to assist the capability picks |

It also inherits everything from upstream `0.1.1-rc.2` — including the **unified image request pipeline** (normalized attachments, route-owned request versions, DeepSeek Files lifecycle).

### Run from this fork

```sh
git clone https://github.com/iStarryDust/deepseek-harness-custom-Starry.git
cd deepseek-harness-custom-Starry
pnpm install
pnpm run build
pnpm dsh web
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
