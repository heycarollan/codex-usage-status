# Codex Usage Status

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/synapticraft.codex-usage-status?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status)

Shows account-level Codex usage in the VS Code status bar, including reset timing, available reset credits, and a guarded action to use a reset credit without leaving your editor.

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status), or search for `Codex Usage Status` in the Extensions view.

The extension talks to the local Codex app-server and reads:

- `account/rateLimits/read` for the 5-hour and 7-day rolling usage windows.
- `account/usage/read` for daily token usage summaries in the details view.

## Features

- Status bar display: `Codex: 5h 7% · 7d 9%`
- Readable hover tooltip with separate usage windows, reset times, reset credits, account, and token sections.
- Quick Pick details view for Codex and model-specific buckets.
- Manual refresh and app-server restart commands.
- Optional native Linux and VS Code notifications for high usage, app-server-visible Codex completion, and input/approval events.
- Reset-credit action with a confirmation prompt when Codex reports reset credits are available, so you can apply one from VS Code instead of only seeing that it exists.
- Configurable refresh interval, warning threshold, and executable path.

## Reset credits

Codex Usage Status does more than display when your 5-hour and 7-day windows reset. When Codex reports reset credits for your account, the extension shows how many are available and exposes `Codex Usage: Use Reset Credit` in the Command Palette and details Quick Pick. The command asks for confirmation before consuming a reset credit, then refreshes usage so you can see the new state immediately.

## Commands

- `Codex Usage: Refresh`
- `Codex Usage: Show Details`
- `Codex Usage: Restart App Server`
- `Codex Usage: Use Reset Credit`
- `Codex Usage: Open Settings`

## Requirements

- VS Code, Cursor, Windsurf, or another VS Code-compatible editor.
- Codex CLI installed and available as `codex`, or configured with `codexUsage.codexExecutable`.
- A Codex login that works with `codex app-server`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codexUsage.refreshIntervalSeconds` | `10` | How often to refresh usage. |
| `codexUsage.codexExecutable` | `codex` | Path or command name for the Codex CLI. |
| `codexUsage.showExtraBuckets` | `true` | Show model-specific buckets like Codex Spark. |
| `codexUsage.statusFormat` | `compact` | Show used percent or remaining percent. |
| `codexUsage.warnAtPercent` | `90` | Highlight the status bar at this usage percentage. |
| `codexUsage.requestTimeoutMs` | `12000` | Timeout for app-server requests. |
| `codexUsage.notifyUsageWarnings` | `true` | Notify when 5-hour or 7-day usage crosses the warning threshold. |
| `codexUsage.notifyTurnComplete` | `true` | Notify for turn completion events visible to this app-server connection. |
| `codexUsage.notifyNeedsInput` | `true` | Notify when this app-server connection is asked for input or approval. |
| `codexUsage.notificationMode` | `native` | Use Linux desktop notifications, VS Code notifications, or both. |

## Notifications

Codex Usage Status refreshes usage on an interval and notifies once when the 5-hour or 7-day window crosses `codexUsage.warnAtPercent`. The alert re-arms after usage drops below the threshold. On Linux, `native` mode sends desktop notifications with `notify-send` and falls back to VS Code if native notifications are unavailable. Usage and input/approval notifications also keep VS Code action buttons available.

Completion and input notifications fire for events visible to this extension's app-server connection. The official Codex extension may use a separate private app-server process, so cross-panel notifications depend on whether Codex exposes those events to this companion connection.

## Privacy

This extension runs locally. It starts `codex app-server` and reads the same account usage data available to local Codex clients. It does not send usage data to a third-party service.

## Development

```sh
npm install
npm run compile
npm test
npm run package
```
