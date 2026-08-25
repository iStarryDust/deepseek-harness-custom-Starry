# @deepseek-ai/dsh-schedule-toggle

## Overview

The `@deepseek-ai/dsh-schedule-toggle` package provides a **"定时计划 (Schedule
reminders)" switch** on the **Settings → General** page of the web build. The
switch controls the Schedule reminder plugin by writing to or removing entries
from the profile `cordis.patch.yml`. Because `watchUserPatches` hot-reloads
configuration changes, toggling the switch does not require a server restart.

- **Enabled:** appends the `time-context` and `schedule` plugin entries to
  `$DSH_HOME/profiles/<profile>/cordis.patch.yml` (default profile `web`).
- **Disabled:** removes those entries, restoring the file to `[]`.

> For the agent-facing workflow, see
> [`../../.agents/skills/web-schedule/SKILL.md`](../../../.agents/skills/web-schedule/SKILL.md).

## Design

The feature separates concerns across two layers to prevent duplicate entries:

1. **The toggle plugin itself** is mounted through the **bundle** mechanism. The
   package declares `dsh.bundle.patch` (`cordis.patch.yml`) and is added to the
   profile manifest's `dsh.profile.bundles`
   (`~/.dsh/profiles/<profile>/package.json`). Because the bundle patch inserts
   the plugin entry, the plugin must **never** be written to the profile's user
   `cordis.patch.yml`; doing so collides with the bundle-layer entry and the
   process fails to start with `duplicate loader entry id: schedule-toggle`.
2. **The `schedule` and `time-context` plugins** are written by the switch into
   the profile's user `cordis.patch.yml`. This file is owned by this switch and
   contains only these controlled entries.

`cordis.patch.yml` (user layer) contents:

- **Disabled:** `[]`
- **Enabled:** an `- insert:` block containing the `time-context` and `schedule`
  entries.

## Installation

1. Add `"@deepseek-ai/dsh-schedule-toggle": "workspace:^"` to the
   `dependencies` of `apps/cli/package.json` (registers the package with the
   source-path resolver).
2. Run `pnpm install` to create the workspace link.
3. Add `@deepseek-ai/dsh-schedule-toggle` to the `dsh.profile.bundles` array in
   `~/.dsh/profiles/<profile>/package.json`.
4. Keep `~/.dsh/profiles/<profile>/cordis.patch.yml` as `[]`; do not add the
   plugin there manually.
5. Restart `dsh web`. The switch appears under **Settings → General**.

## Configuration

The Host half registers the `schedule-toggle` settings namespace:

```ts
interface ScheduleToggleConfig {
  /** Whether the Schedule reminder feature is enabled. */
  enabled: boolean
  /** Target profile name, resolved as $DSH_HOME/profiles/<profile>. Defaults to 'web'. */
  profile: string
}
```

- The value is persisted in the DSH settings document
  (`~/.dsh/settings.yaml`), which is the single source of truth.
- The plugin synchronizes the patch file once on registration, reconciling the
  file with the stored value.
- Paths are derived via `dshHomePath()` from `$DSH_HOME` (default `~/.dsh`);
  no machine-specific absolute path is hard-coded.

## Client Half

The browser half registers the switch row into the `settings.general.item` slot
(the row list of the General settings page) and reads and writes the namespace
through `ctx.settingsScope.bind`. The `useSyncExternalStore` callbacks bind the
scope's `this` explicitly; passing class-method references unbound would read
`this.store` as `undefined` and crash the row.

## Safety and Boundaries

- **Constrained file adoption.** The switch only rewrites a patch file that is
  absent, an empty `[]`, or one that contains only controlled entries. A file
  that has been modified by hand with unrelated content is left untouched, and
  the sync reports the current state instead of overwriting it.
- **Session-scoped tools.** The Schedule tools register only in sessions created
  after the Schedule plugin is loaded. After enabling the switch, the current
  session may not yet expose the `schedule_*` tools; a new session is required.
- **Session-local delivery.** Reminders fire only while the owning session is
  live. A cold session marks the reminder overdue and delivers it on resume.

## Development

```sh
pnpm --filter @deepseek-ai/dsh-schedule-toggle bundle
pnpm --filter @deepseek-ai/dsh-schedule-toggle watch
```
