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
- Optional native Linux and VS Code notifications for high usage, app-server-visible Codex completion, and input/approval events. Completion notifications identify the chat, project, and Git branch when Codex provides them.
- Actionable completion notifications: click a native Linux completion notification or select **Open Chat** in a VS Code notification to return to the exact completed Codex chat.
- Reset-credit action with a confirmation prompt when Codex reports reset credits are available. When per-credit details are available, the extension explicitly uses the available credit closest to expiration.
- Configurable refresh interval, warning threshold, and executable path.

## Reset credits

Codex Usage Status does more than display when usage windows reset. When Codex reports reset credits for your account, the hover tooltip shows each credit's title, status, grant time, expiration time, scope, and description. Older Codex versions that provide only the available count are labeled accordingly.

The extension also exposes `Codex Usage: Use Reset Credit` in the Command Palette and details Quick Pick. The command asks for confirmation, explicitly uses the available credit closest to expiration, then refreshes usage so you can see the new state immediately. Credits without an expiration are used after expiring credits. When an older Codex version does not provide per-credit IDs, Codex chooses the credit automatically.

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
| `codexUsage.notifyTurnComplete` | `true` | Notify for visible turn completions with chat identity and an **Open Chat** action. |
| `codexUsage.notifyNeedsInput` | `true` | Notify when this app-server connection is asked for input or approval. |
| `codexUsage.notificationMode` | `native` | Use Linux desktop notifications, VS Code notifications, or both. |

## Notifications

Codex Usage Status refreshes usage on an interval and notifies once when a reported 5-hour or 7-day window crosses `codexUsage.warnAtPercent`. Missing windows display as `N/A` and do not trigger alerts. The alert re-arms after usage drops below the threshold.

On Linux, `native` mode sends one actionable desktop notification through `notify-send` and falls back to a VS Code notification when native delivery is unavailable. Clicking the body of a native completion notification invokes its **Open Chat** action. `vscode` mode presents **Open Chat** as a notification button. `both` intentionally sends a passive native notification plus an actionable VS Code notification.

Completion notifications use the Codex thread name, workspace folder, and Git branch when available. When Codex does not provide a name, the notification uses a short, non-color thread identifier so parallel chats remain distinguishable without relying on color alone.

Completion and input notifications fire for events visible to this extension's app-server connection. The official Codex extension may use a separate private app-server process, so cross-panel notifications depend on whether Codex exposes those events to this companion connection. Exact-chat navigation is a best-effort integration with the current official Codex IDE route; if that route is unavailable, Codex Usage Status opens the Codex sidebar instead.

## Privacy

This extension runs locally. It starts `codex app-server` and reads the same account usage data available to local Codex clients. It does not send usage data to a third-party service.

## Development

```sh
npm install
npm run compile
npm test
npm run package
```
