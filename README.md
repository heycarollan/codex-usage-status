# Codex Usage Status

[![VS Code Marketplace](https://badgen.net/vs-marketplace/v/synapticraft.codex-usage-status)](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status)

Shows account-level Codex usage in the VS Code status bar, including reset timing, available reset credits, and a guarded action to use a reset credit without leaving your editor.

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status), or search for `Codex Usage Status` in the Extensions view.

The extension talks to the local Codex app-server and reads:

- `account/rateLimits/read` for the usage windows Codex currently reports.
- `account/usage/read` for daily token usage summaries in the details view.

## Features

- Status bar display: `Codex: 5h N/A · 7d 9%` when Codex reports only a 7-day window. A 5-hour percentage appears automatically when the API provides that window.
- Readable hover tooltip with separate usage windows, reset times, per-credit grant and expiration details, account, and token sections.
- Quick Pick details view for Codex and model-specific buckets.
- Manual refresh and app-server restart commands.
- Configurable VS Code and native Linux notifications for high usage, input/approval events, and completed turns. Completion notifications identify the chat, project, and Git branch when Codex provides them.
- Reset-credit action with a confirmation prompt when Codex reports reset credits are available. When per-credit details are available, the extension explicitly uses the available credit closest to expiration.
- Configurable refresh interval, warning threshold, and executable path.
- Dedicated status-bar pulse button opens the extension's Settings page; the usage display opens informational details.

## Reset credits

Codex Usage Status does more than display when usage windows reset. When Codex reports reset credits for your account, the hover tooltip shows each credit's title, status, grant time, expiration time, scope, and description. Older Codex versions that provide only the available count are labeled accordingly.

The extension also exposes `Codex Usage: Use Reset Credit` in the Command Palette and details Quick Pick. The command asks for confirmation, explicitly uses the available credit closest to expiration, then refreshes usage so you can see the new state immediately. Credits without an expiration are used after expiring credits. When an older Codex version does not provide per-credit IDs, Codex chooses the credit automatically.

## Commands

- `Codex Usage: Refresh`
- `Codex Usage: Show Details`
- `Codex Usage: Restart App Server`
- `Codex Usage: Use Reset Credit`
- `Codex Usage: Open Settings`
- `Codex Usage: Open Logs`

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
| `codexUsage.notifyTurnComplete` | `true` | Notify for visible turn completions with the available chat identity. |
| `codexUsage.notifyNeedsInput` | `true` | Notify when this app-server connection is asked for input or approval. |
| `codexUsage.notificationMode` | `vscode` | Use VS Code notifications, native Linux notifications, or both. |

## Notifications

Codex Usage Status refreshes usage on an interval and notifies once when a reported 5-hour or 7-day window crosses `codexUsage.warnAtPercent`. Missing windows display as `N/A` and do not trigger alerts. The alert re-arms after usage drops below the threshold.

The default `vscode` mode uses VS Code's bottom-right notification UI. In `native` mode, an unfocused VS Code window uses a Linux desktop notification and falls back to VS Code when native delivery is unavailable. `both` sends both while VS Code is unfocused.

Completion notifications use the Codex thread name, workspace folder, and Git branch when available. When Codex does not provide a name, the notification uses a short, non-color thread identifier so parallel chats remain distinguishable without relying on color alone.

Completion and input notifications fire for events visible to this extension's app-server connection. The official Codex extension may use a separate private app-server process, so cross-panel notifications depend on whether Codex exposes those events to this companion connection.

Codex Usage Status does not offer an exact-chat click action. The official Codex extension does not currently document a public command or URI for opening an existing thread by ID, and relying on its private route caused unreliable navigation. The notification still includes the best available chat, project, and branch identity so the completed work can be found without depending on that private interface.

Click the dedicated status-bar pulse to open every extension setting, or use **Open Settings** directly from the usage tooltip. Click the usage display for informational account and bucket details. Refresh, reset-credit use, app-server restart, logs, and settings remain explicit commands in the Command Palette; reset-credit use still requires confirmation.

## Privacy

This extension runs locally. It starts `codex app-server` and reads the same account usage data available to local Codex clients. It does not send usage data to a third-party service.

## Development

```sh
npm install
npm run compile
npm test
npm run package
```
