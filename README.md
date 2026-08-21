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

This repository is a customized fork that layers an **agent-as-identity** management layer on top of DeepSeek Harness (`0.1.1-rc.2`).

### Features

- **Agent management UI** (`packages/client/ui-agents`): a sidebar agent roster with create/edit identity forms and per-agent chat history.
- **Agent-as-identity**: an agent is defined by name, language, description, and persona prompt; capabilities are chosen per new session (standard / PTC / minimal modes).
- **Composed presets**: a new session composes `<agentId>-<modeId>` presets, merging the selected mode's tool set with the agent persona.
- **Direct preset binding**: sessions created from an agent page bind that agent's composed preset directly.
- **Persona format**: the persona row carries the language instruction, working-directory line, and the user's persona text.
- **Session management**: per-chat rename / archive / physical delete (via the `session.remove` RPC fix).

Clone and run from source:

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
