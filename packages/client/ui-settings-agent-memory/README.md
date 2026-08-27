# @deepseek-ai/dsh-client-ui-settings-agent-memory

English | [中文](README.zh.md)

The agent-memory settings page (browser half). It contributes one entry to the settings shell's `settings.section` slot (id `agent-memory`, label `Agent Memory`) and renders the four memory switches plus the global-memory editor. It never owns the stores — it moves switch state over the `agent-memory` settings namespace scope and the global document over the `agentMemory` wire face, both owned by [`dsh-agent-memory`](../../preset/agent-memory/README.md).

## What the page shows

- **Switch rows** — `globalEnabled`, `agentEnabled`, `autoMemory`, `askMemory`, each with a short hint. `askMemory` is only enabled once `autoMemory` is on (the UI disables it with a hint otherwise).
- **Global memory editor** — a textarea bound to the global store's draft. The editor shows `- [YYYY-MM-DD HH:mm] content` lines alongside the `# title` header text; a save writes the whole document through the wire. It is only the global store — per-agent stores are not editable here.

## Data flow

The `MemorySettingsController` holds a `createSnapshotStore` for the page state and:

- subscribes to the `agent-memory` settings namespace scope (switches ride the durable Host section in loopback, process-local in a remote browser's memory mode — exactly like the welcome notice), parsing a malformed section as all-off via `decodeMemorySection()`;
- loads the global document on activation (`agentMemory.readGlobal`) and refreshes the editor after each write (`saveGlobal` via `agentMemory.writeGlobal`).

Switch toggles are written through `scope.set(field, next)`; the section renders whatever the scope resolves. The locale namespace is `settings.agentMemory`, keyed off the zh dictionary.

## Model Experience

None. The page renders the switch state and the global document; it touches no prompt, message, schema, stream, or tool result. The four switches change how memory is injected (see [`dsh-agent-memory`](../../preset/agent-memory/README.md)), but this page only moves those switches and the global document across the wire.

#### KV Cache effect

None; the page never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Per-agent memory is not editable here** — the page exposes only the global store editor; an agent's own store is shown read-only in the target agent's settings (or not at all). In-line editing of a selected agent's memory is deferred.
- **Switch equality is not immediate** — an optimized `load` follows the scope once and derives the switches from the snapshot; a scope that resolves late can briefly show `loading`.
- **Global-only editor** — the section deliberately exposes one editor; per-agent editor surfaces and a memory history list are deferred.
