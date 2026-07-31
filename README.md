# Codex Companion

[![VS Code Marketplace](https://badgen.net/vs-marketplace/v/synapticraft.codex-usage-status)](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status)
[![GitHub release](https://badgen.net/github/release/heycarollan/codex-usage-status)](https://github.com/heycarollan/codex-usage-status/releases/latest)

Codex Companion makes Codex easier to monitor and reach: use the VS Code extension for usage, notifications, chat navigation, reset credits, and visual Remote setup, or use the official standalone Codex build as an always-available Linux Remote host without VS Code.

## Choose your setup

### Linux Remote Control without VS Code

You do not need this VS Code extension—or another desktop application—to use a Linux computer as a ChatGPT Remote host. Codex's official standalone installer includes the managed background app-server required by `codex remote-control start`.

Copy and paste this block in a Linux terminal:

```sh
curl -fsSL https://chatgpt.com/codex/install.sh | sh
~/.local/bin/codex login
~/.local/bin/codex remote-control start
~/.local/bin/codex remote-control pair
```

The final command prints a short-lived manual code. Enter it in **Remote** in the ChatGPT mobile app. The Linux host then uses OpenAI's internet relay, so the phone can start and control Codex chats from outside the local network. Stop the managed host with:

```sh
~/.local/bin/codex remote-control stop
```

The host must stay awake and online. The daemonized `start` command currently requires the official standalone Codex installation; npm-installed and VS Code-bundled Codex binaries can expose the remote-control app-server API but cannot supply that managed daemon by themselves.

`codex remote-control` is currently an experimental Codex command. OpenAI's command reference documents `start`, `stop`, and `pair`, but the general Remote setup guide still describes desktop-app setup and says CLI/IDE setup is unavailable. Treat this Linux path as pre-release until the full mobile pairing flow has been verified for your account and rollout.

See OpenAI's [Remote connections documentation](https://learn.chatgpt.com/docs/remote-connections) for account, mobile-app, workspace, and rollout requirements.

### VS Code extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status), or search for `Codex Companion`, `Codex Usage`, or `Codex Remote Control` in the Extensions view.

The extension talks to the local Codex app-server and reads:

- `account/rateLimits/read` for the usage windows Codex currently reports.
- `account/usage/read` for daily token usage summaries in the settings editor.

## VS Code features

- Status bar display: `Codex: 5h N/A · 7d 9%` when Codex reports only a 7-day window. A 5-hour percentage appears automatically when the API provides that window.
- A dedicated **Remote** status-bar button beside usage. It shows connection state and opens the Remote Control section directly—no Command Palette step required.
- Readable hover tooltip with separate usage windows, reset times, per-credit grant and expiration details, account, and token sections.
- Unified Codex Companion editor with live account, token, bucket, and reset-credit details.
- Manual refresh and app-server restart commands.
- Configurable VS Code and native Linux notifications for high usage, input/approval events, and completed turns. Completion notifications identify the chat, project, and Git branch when Codex provides them.
- A configurable completion action that opens the exact completed local chat, opens the general Codex sidebar, or stays hidden. Exact-chat switching uses the OpenAI extension's current thread resource and is marked experimental until OpenAI documents a public API.
- Reset-credit action with a confirmation prompt when Codex reports reset credits are available. When per-credit details are available, the extension explicitly uses the available credit closest to expiration.
- Opt-in ChatGPT Remote setup using Codex's official secure internet relay. Create and copy a short-lived manual pairing code, see connection state, and revoke paired controller devices from the settings editor.
- Configurable refresh interval, warning threshold, and executable source or path.
- The status-bar usage display and its tooltip action open the unified settings editor.

## Reset credits

When Codex reports reset credits for your account, the hover tooltip shows each credit's title, status, grant time, expiration time, scope, and description. Older Codex versions that provide only the available count are labeled accordingly.

The settings editor includes a **Use reset credit** button with the available count, status, scope, grant time, expiration, and short credit description. The action asks for confirmation, explicitly uses the available credit closest to expiration, then refreshes usage immediately. Credits without an expiration are used after expiring credits. When an older Codex version does not provide per-credit IDs, Codex chooses the credit automatically.

## Commands

- `Codex Companion: Refresh Usage`
- `Codex Companion: Restart App Server`
- `Codex Companion: Use Reset Credit`
- `Codex Companion: Open Settings`
- `Codex Companion: Open Logs`
- `Codex Companion: Set Up Remote Control`

## Remote control

Remote control is disabled by default. After installation, Codex Companion shows one-time setup guidance and highlights the new **Remote** button beside the usage display. Select that button at any time to open the existing settings page directly at its Remote Control section. Turn on **Enable remote access**, select **Create pairing code**, and copy the short-lived code into **Remote** in the ChatGPT mobile app. Once paired, ChatGPT provides the full Codex remote experience over OpenAI's internet relay: start or continue chats, send and steer instructions, answer questions, review outputs and diffs, and approve or reject requested actions.

The extension does not create a public listener, expose the raw app-server, or operate a separate relay. It calls Codex's experimental `remoteControl/*` app-server methods and shows only the local setup and device-management controls. Pairing codes stay in memory until claimed or expired and are never written to extension logs. Paired devices can be revoked individually.

The host computer must remain awake and online with VS Code running. Remote Control availability can depend on the installed Codex version, ChatGPT mobile rollout, account or workspace eligibility, and administrator policy. The app-server methods are experimental, and OpenAI's general Remote guide does not yet describe IDE-based setup, so this feature needs real-device pairing verification before release. See OpenAI's [Remote connections documentation](https://learn.chatgpt.com/docs/remote-connections).

## Requirements

- VS Code, Cursor, Windsurf, or another VS Code-compatible editor.
- Codex CLI installed and available as `codex`, configured with `codexUsage.codexExecutable`, or installed official [OpenAI Codex](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt) extension.
- A Codex login that works with `codex app-server`.
- For remote control, a Codex version exposing the experimental `remoteControl/*` app-server methods and ChatGPT Remote access on the paired account.

In Remote SSH, dev containers, and WSL, the `extension` executable source mode resolves the Codex extension and binary in the extension host environment. Install the official Codex extension in that environment; if its bundled executable cannot be resolved, select the `path` executable source and set `codexUsage.codexExecutable` explicitly.

## Settings

Click the Codex status-bar usage display to open **Codex Companion**. It combines all extension preferences with live usage, account, token, bucket, and reset-credit information. Refresh, restart, logs, and guarded reset-credit use are available from the same editor; the former Quick Pick popup is no longer used.

| Setting | Default | Description |
| --- | --- | --- |
| `codexUsage.codexExecutableSource` | `path` | Use the configured path, or automatically use the CLI bundled with the official OpenAI Codex extension. |
| `codexUsage.codexExecutable` | `codex` | Path or command name for the Codex CLI. |
| `codexUsage.refreshIntervalSeconds` | `10` | How often to refresh usage. |
| `codexUsage.showExtraBuckets` | `true` | Show model-specific buckets like Codex Spark. |
| `codexUsage.statusFormat` | `compact` | Show used percent or remaining percent. |
| `codexUsage.warnAtPercent` | `90` | Highlight the status bar at this usage percentage. |
| `codexUsage.requestTimeoutMs` | `12000` | Timeout for app-server requests. |
| `codexUsage.notifyUsageWarnings` | `true` | Notify when 5-hour or 7-day usage crosses the warning threshold. |
| `codexUsage.notifyTurnComplete` | `true` | Notify for visible turn completions with the available chat identity. |
| `codexUsage.notifyNeedsInput` | `true` | Notify when this app-server connection is asked for input or approval. |
| `codexUsage.notificationMode` | `vscode` | Use VS Code notifications, native Linux notifications, or both. |
| `codexUsage.completionChatAction` | `exact` | Open the exact completed chat (experimental), open the Codex sidebar, or show no chat action. |
| `codexUsage.remoteControlEnabled` | `false` | Opt in to reconnecting through OpenAI's remote-control relay while VS Code runs. |

## Notifications

Codex Companion refreshes usage on an interval and notifies once when a reported 5-hour or 7-day window crosses `codexUsage.warnAtPercent`. Missing windows display as `N/A` and do not trigger alerts. The alert re-arms after usage drops below the threshold.

The default `vscode` mode uses VS Code's bottom-right notification UI. In `native` mode, an unfocused VS Code window uses a Linux desktop notification and falls back to VS Code when native delivery is unavailable. `both` sends both while VS Code is unfocused.

Completion notifications use the Codex thread name, workspace folder, and Git branch when available. When Codex does not provide a name, the notification uses a short, non-color thread identifier so parallel chats remain distinguishable without relying on color alone. Choose **Go to Chat** to open the completed local thread.

Completion and input notifications fire for events visible to this extension's app-server connection. The official Codex extension may use a separate private app-server process, so cross-panel notifications depend on whether Codex exposes those events to this companion connection.

Exact-chat switching uses the `openai-codex://route/local/<threadId>` resource registered by the installed OpenAI extension. This is the resource format the current extension uses for local conversation editors, but it is not a documented public integration API and may change. Set `codexUsage.completionChatAction` to `sidebar` for the supported general-sidebar command or `none` to remove the action.

Click the usage display or **Open Settings** in the tooltip to open the unified settings editor. Refresh, reset-credit use, app-server restart, and logs remain explicit Command Palette commands; reset-credit use still requires confirmation.

## Privacy

This extension runs locally. It starts `codex app-server` and reads the same account usage data available to local Codex clients. It does not send usage data to a third-party service. When remote control is explicitly enabled, Codex connects to OpenAI's remote-control relay and the paired ChatGPT client controls the local Codex session under the account's existing authentication, approval, and workspace policies.

Built by [Synapticraft](https://synapticraft-studio.com/services/apps-plugin-creation.html), a studio for practical apps, plugins, websites, and automation.

## Development

```sh
npm install
npm run compile
npm test
npm run package
```
