# DeepSeek Harness Custom

English | [中文](README.md)

A customized distribution of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (based on release `0.1.0-rc.7`), introducing an Agent management layer built around the concept of **agents as identities**.

## Features

- **Agent management interface** (`packages/client/ui-agents`): a sidebar roster of user-defined agents, with creation, profile editing, and per-agent chat history.
- **Agent as identity**: an agent is defined by name, language, description, and persona prompt; capability is chosen at chat start (standard / PTC / minimal modes).
- **Combined presets**: chat starts compose a `<agentId>-<modeId>` preset that merges the chosen mode's tool composition with the agent's persona. Combined presets live under each agent's `modes/<mode>/` directory.
- **Direct preset binding**: sessions created from an agent page bind directly to the agent's combined preset.
- **Persona format**: the persona row contains the language directive, the working directory line, and the user's persona text verbatim.
- **Ownership persistence**: agent↔session ownership is recorded in the session log and survives restarts.
- **Session management**: rename / archive / physical delete per chat entry.

## Requirements

- Node.js >= 22
- pnpm

## Build

```bash
git clone https://github.com/iStarryDust/deepseek-harness-custom-Starry.git
cd deepseek-harness-custom-Starry
pnpm install
pnpm run build
```

## Run

```bash
pnpm dsh web
```

Open http://127.0.0.1:3080.

## Configuration

Configure an API key after first launch by editing `~/.dsh/.credentials.yaml`:

```yaml
deepseek-official:
  apiKey: sk-...
```

## Differences from upstream

| Area | Upstream rc.7 | This repository |
|---|---|---|
| `packages/client/ui-agents` | absent | added: Agent management UI |
| Sidebar | New Session / Workspace | My Agents / Create Agent / Back |
| Combined preset layout | flat directories | nested under `agent/modes/<mode>/` |
| Session creation from agent page | deferred hero binding | direct combined-preset binding |
| Persona row | persona + language directive + runtime template | language directive + working directory + persona verbatim |
| `session.remove` | injection bug | fixed |
| Settings Agent-preset entries | default row + management section | removed; management lives in the sidebar |

Upstream rc.8 changes (multimodal, subagent management, Windows PTY) are not merged.

## Notes

- Source changes require rebuilding the affected `lib/` artifacts before they take effect: host packages (`npm run build:lib:host`) need a DSH restart; client packages (`npm run build:lib:client`) take effect after a page refresh.
- If the build fails with exit code 134 (out of memory), run it with a larger heap first: `set NODE_OPTIONS=--max-old-space-size=8192` (Windows cmd).
- If TypeScript reports `Property 'x' does not exist on type 'TypertClientRemote'`, delete the `*.tsbuildinfo` incremental caches in the repository and rebuild.

## License

MIT, inherited from the upstream [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
