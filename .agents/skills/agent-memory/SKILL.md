---
name: agent-memory
description: Use when the user asks about or wants to manage memory (global/agent/auto/ask), or when the agent should decide how to record important facts via memory_add.
---

# Agent Memory

## Switches (Settings → Agent记忆)

- **全局记忆 (global)** — shared across all Agents; injected into the system prompt.
- **Agent记忆 (agent)** — current Agent's own memory; injected into the system prompt.
- **自动记忆 (autoMemory)** — the agent judges importance itself and adds facts to Agent memory without asking the user.
- **询问记忆 (askMemory)** — before the agent auto-adds a fact, it asks the user to confirm (approval). Requires autoMemory.

## Tool

- **`memory_add`** — add one fact to the current Agent's long-term memory: stable preferences, work habits, durable decisions, or facts the user stated as lasting. Store prose conclusions, not the raw exchange; merge related facts into one entry. Never store credentials, one-off task details, or anything the user flagged as transient.
- Registered only while `autoMemory || askMemory`; the tool always writes the calling Agent's store.

## Notes

- Facts inject through the system prompt (memory sections); the editor edits them directly.
- The four switches persist in `~/.dsh/settings.yaml`.
