---
name: web-schedule
description: Use when the user requests a timed reminder on the web build, asks to enable or disable the Schedule reminder feature, or when schedule_create / schedule_list / schedule_delete are reported as unknown tools. Describes the @deepseek-ai/dsh-schedule-toggle switch and the Schedule plugin tooling.
---

# Web Schedule Reminders

## Purpose

This skill documents how to enable Schedule-based proactive reminders on the web
build and how the **Settings → General → 定时计划** switch governs the feature. It
is applicable when the user requests a reminder, a scheduled notification, or a
delayed prompt, and when the Schedule tools are reported as unavailable.

## Architecture

The feature comprises two cooperating components:

- **`@deepseek-ai/dsh-schedule-toggle`** — the switch plugin. It registers a
  "定时计划 (Schedule reminders)" toggle in **Settings → General**. Enabling the
  toggle writes the `time-context` and `schedule` plugin entries into the
  profile `cordis.patch.yml`; disabling it removes those entries. The change is
  applied by `watchUserPatches` hot reload, so toggling does not require a
  server restart.
- **`@deepseek-ai/dsh-schedule`** — the reminder engine. It exposes
  `schedule_create`, `schedule_list`, and `schedule_delete` to the model,
  allowing the agent to create durable reminders that return to the live
  session as subsequent conversation turns.

## Prerequisites

Both conditions must hold; otherwise the tools are absent.

1. The toggle plugin is present in the profile's `dsh.profile.bundles`. Confirm
   in `~/.dsh/profiles/<profile>/package.json` (default profile `web`) that
   `@deepseek-ai/dsh-schedule-toggle` is listed. Its bundle patch mounts the
   plugin entry. The toggle plugin must never be added manually to the profile
   `cordis.patch.yml`, as that collides with the bundle-layer entry and causes a
   launch failure with `duplicate loader entry id: schedule-toggle`.
2. The switch is enabled: `~/.dsh/settings.yaml` contains
   `schedule-toggle.enabled: true`, and the profile `cordis.patch.yml` then
   carries the `time-context` and `schedule` entries.

Programmatic state checks:

- Read `~/.dsh/settings.yaml` → `schedule-toggle.enabled`.
- Read the profile `cordis.patch.yml` → verify that `schedule` is present.

## Tool Usage

Only the Schedule tools create reminders; the switch controls availability only.

- **`schedule_create`** — create one reminder. Supply a non-empty `prompt` and
  exactly one selector: `after_seconds` (positive whole seconds), `at` (strict
  offset RFC 3339, or `{ date, time, time_zone }`), or `every_seconds`
  (fixed-rate interval, minimum 300 seconds).
- **`schedule_list`** — list active reminders, including id, UTC target,
  scheduled or overdue state, and session-local delivery mode.
- **`schedule_delete`** — delete one active reminder by exact id.

Representative invocations:

```text
"提醒我5分钟后喝水"  → schedule_create { prompt: "喝水", after_seconds: 300 }
"每30分钟提醒我活动"  → schedule_create { prompt: "起来活动", every_seconds: 1800 }
"列出所有提醒"       → schedule_list
"取消提醒"           → schedule_delete { id: "schedule-1" }
```

## Operational Notes

- **Session scope of tool registration.** The Schedule tools register only in
  sessions created after the Schedule plugin is loaded. When the user reports
  `unknown tool "schedule_list"`, the current session predates the toggle→plugin
  load. In that case do not restart the server; direct the user to open a new
  conversation, then confirm the tools are present in the new session.
- **Toggling and hot reload.** Toggling the switch reloads the configuration
  without a restart, but the current session still does not acquire the tools; a
  new session is required.
- **Delivery semantics.** Reminder delivery is session-local: it fires only
  while the owning session is live. A cold session marks the reminder overdue
  and delivers it when the session resumes.
- **File ownership.** The profile `cordis.patch.yml` is managed by the switch. Do
  not edit it manually; do not insert the toggle plugin there.

## Recovery

If the profile patch or manifest is corrupted (for example a `duplicate loader
entry id` failure), deleting `~/.dsh/profiles/*` rebuilds the default web
profile from templates. This also removes the toggle bundle from the manifest,
so the feature reverts to the disabled state. To restore it, re-add
`@deepseek-ai/dsh-schedule-toggle` to `dsh.profile.bundles` in
`~/.dsh/profiles/web/package.json`, leave `cordis.patch.yml` as `[]`, restart
the server, and re-enable the switch.
